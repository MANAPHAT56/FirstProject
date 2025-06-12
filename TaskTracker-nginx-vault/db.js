// db.js - Enhanced with credential rotation
const mysql = require('mysql2/promise');
const path = require('path');
const vaultService = require('./vault.js');

class DatabaseService {
  constructor() {
    this.pool = null;
    this.currentCredentials = null;
    this.refreshTimer = null;
    this.isRefreshing = false;
    this.pendingQueries = [];
  }

  async createConnection() {
    try {
      console.log('🔄 Creating new database connection with fresh Vault credentials...');
      
      // Get fresh credentials from Vault
      let credentials;
      try {
        credentials = await vaultService.getDynamicCredentials();
      } catch (vaultError) {
        console.error('❌ Failed to get Vault credentials:', vaultError.message);
        
        // Try debug if first attempt fails
        console.log('🔍 Running Vault diagnostics...');
        try {
          await vaultService.debugVaultConfig();
        } catch (debugError) {
          console.error('❌ Vault diagnostics failed:', debugError.message);
        }
        
        throw new Error(`Vault credential retrieval failed: ${vaultError.message}`);
      }
      
      // Close old pool gracefully
      if (this.pool) {
        console.log('🔒 Closing existing database pool...');
        await this.pool.end();
      }

      // Create new pool with fresh credentials
      this.pool = mysql.createPool({
        host: 'mysql-container',
        port: 3306,
        user: credentials.username,
        password: credentials.password,
        database: 'my_db',
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        acquireTimeout: 60000,
        timeout: 60000
      });

      // Revoke old credentials if exists
      if (this.currentCredentials && this.currentCredentials.leaseId) {
        try {
          await vaultService.revokeLease(this.currentCredentials.leaseId);
          console.log('✅ Old credentials revoked successfully');
        } catch (error) {
          console.error('⚠️ Failed to revoke old credentials:', error.message);
        }
      }

      this.currentCredentials = credentials;

      console.log('✅ Database connection pool created', {
        username: credentials.username,
        host: 'mysql-container',
        leaseId: credentials.leaseId
      });

      // Setup credential refresh timer
      this.setupCredentialRefresh();

      return this.pool;
    } catch (error) {
      console.error('❌ Failed to create database connection:', error.message);
      throw error;
    }
  }

  setupCredentialRefresh() {
    // Clear existing timer
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }

    // ตรวจสอบว่ามี ttl หรือไม่
    if (!this.currentCredentials || !this.currentCredentials.ttl) {
      console.error('❌ Missing TTL in credentials, cannot setup refresh timer');
      return;
    }

    // Calculate refresh time (refresh 10 seconds before expiry)
    const refreshInterval = Math.max(5000, (this.currentCredentials.ttl - 10) * 1000);
    
    console.log(`⏰ Setting up credential refresh in ${refreshInterval/1000} seconds`);

    this.refreshTimer = setTimeout(async () => {
      try {
        await this.refreshCredentials();
      } catch (error) {
        console.error('❌ Scheduled credential refresh failed:', error.message);
        // Retry in 5 seconds
        setTimeout(() => this.refreshCredentials().catch(console.error), 5000);
      }
    }, refreshInterval);
  }

  async refreshCredentials() {
    if (this.isRefreshing) {
      console.log('⏳ Credential refresh already in progress, skipping...');
      return;
    }

    this.isRefreshing = true;
    console.log('🔄 Starting scheduled credential refresh...');

    try {
      // Create new connection with fresh credentials
      await this.createConnection();
      console.log('✅ Credential refresh completed successfully');
      
      // Process any pending queries
      this.processPendingQueries();
      
    } catch (error) {
      console.error('❌ Credential refresh failed:', error.message);
      throw error;
    } finally {
      this.isRefreshing = false;
    }
  }

  async getConnection() {
    if (!this.pool) {
      await this.createConnection();
    }
    return this.pool;
  }

  async query(sql, params = []) {
    // If refresh is in progress, queue the query
    if (this.isRefreshing) {
      return new Promise((resolve, reject) => {
        this.pendingQueries.push({ sql, params, resolve, reject });
      });
    }

    try {
      const pool = await this.getConnection();
      const [rows] = await pool.execute(sql, params);
      return rows;
    } catch (error) {
      console.error('❌ Database query failed:', error.message, error.code);
      
      // If access denied, try to refresh credentials immediately
      if (error.code === 'ER_ACCESS_DENIED_ERROR' || error.code === 'ECONNREFUSED') {
        console.log('🔑 Connection error detected, forcing credential refresh...');
        
        try {
          await this.refreshCredentials();
          
          // Retry query with new connection
          const pool = await this.getConnection();
          const [rows] = await pool.execute(sql, params);
          return rows;
        } catch (refreshError) {
          console.error('❌ Failed to refresh credentials and retry query:', refreshError.message);
          throw refreshError;
        }
      }
      
      throw error;
    }
  }

  processPendingQueries() {
    console.log(`📋 Processing ${this.pendingQueries.length} pending queries...`);
    
    const queries = [...this.pendingQueries];
    this.pendingQueries = [];

    queries.forEach(async ({ sql, params, resolve, reject }) => {
      try {
        const result = await this.query(sql, params);
        resolve(result);
      } catch (error) {
        reject(error);
      }
    });
  }

  async healthCheck() {
    try {
      await this.query('SELECT 1 as health_check');
      return { 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        credentials: {
          username: this.currentCredentials?.username,
          expiresIn: this.currentCredentials ? 
            Math.max(0, this.currentCredentials.ttl - Math.floor((Date.now() - this.currentCredentials.createdAt) / 1000)) : 0
        }
      };
    } catch (error) {
      return { 
        status: 'unhealthy', 
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  async close() {
    console.log('🔒 Closing database service...');
    
    // Clear refresh timer
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }

    // Close pool
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }

    // Revoke current credentials
    if (this.currentCredentials && this.currentCredentials.leaseId) {
      try {
        await vaultService.revokeLease(this.currentCredentials.leaseId);
        console.log('✅ Database credentials revoked successfully');
      } catch (error) {
        console.error('⚠️ Failed to revoke lease during cleanup:', error.message);
      }
    }

    // Reject pending queries
    this.pendingQueries.forEach(({ reject }) => {
      reject(new Error('Database service is closing'));
    });
    this.pendingQueries = [];
    
    console.log('✅ Database service closed successfully');
  }

  // Method to manually trigger credential refresh (useful for testing)
  async forceRefresh() {
    console.log('🔄 Manual credential refresh triggered...');
    await this.refreshCredentials();
  }

  // Get credential status
  getCredentialStatus() {
    if (!this.currentCredentials) {
      return { status: 'no_credentials' };
    }

    const createdAt = this.currentCredentials.createdAt;
    const ttl = this.currentCredentials.ttl;
    const now = Date.now();
    const elapsed = Math.floor((now - createdAt) / 1000);
    const remaining = Math.max(0, ttl - elapsed);

    return {
      status: 'active',
      username: this.currentCredentials.username,
      leaseId: this.currentCredentials.leaseId,
      ttl: ttl,
      elapsed: elapsed,
      remaining: remaining,
      willRefreshIn: Math.max(0, remaining - 10)
    };
  }
}

module.exports = new DatabaseService();