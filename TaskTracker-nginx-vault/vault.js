const { client: vaultClient } = require('./testjs/vault');
const logger = require('./testjs/logger');

class VaultService {
  constructor() {
    this.dbCredentialsCache = new Map();
    this.leaseRenewalTimers = new Map();
    this.isInitialized = false;
  }

  async initialize() {
    try {
      console.log('🔄 Initializing Vault connection...');
      
      // Test Vault connection
      const healthCheck = await vaultClient.status();
      console.log('✅ Vault status:', healthCheck);
      
      // Test authentication
      const authCheck = await vaultClient.read('auth/token/lookup-self');
      console.log('✅ Vault auth status:', {
        policies: authCheck.data.policies,
        ttl: authCheck.data.ttl
      });
      
      this.isInitialized = true;
      console.log('✅ Vault service initialized successfully');
      
    } catch (error) {
      console.error('❌ Vault initialization failed:', {
        message: error.message,
        code: error.code,
        response: error.response?.data
      });
      throw error;
    }
  }

  async getDynamicCredentials(role = 'my-role') {
    try {
      // Initialize if not done
      if (!this.isInitialized) {
        await this.initialize();
      }

      console.log(`🔄 Getting dynamic credentials for role: ${role}`);
      
      const path = `database/creds/${role}`;
      console.log(`📍 Reading from Vault path: ${path}`);
      
      const response = await vaultClient.read(path);
      
      if (!response || !response.data) {
        throw new Error(`No data returned from Vault path: ${path}`);
      }

      if (!response.data.username || !response.data.password) {
        throw new Error(`Invalid credentials format from Vault: ${JSON.stringify(response.data)}`);
      }
      
      const now = Date.now();
      const credentials = {
        username: response.data.username,
        password: response.data.password,
        leaseId: response.lease_id,
        leaseDuration: response.lease_duration || 60, // Default 1 hour
        ttl: response.lease_duration || 60,
        createdAt: now
      };

      console.log('✅ Dynamic credentials retrieved successfully:', {
        username: credentials.username,
        leaseId: credentials.leaseId,
        leaseDuration: credentials.leaseDuration,
        ttl: credentials.ttl
      });

      // Cache credentials
      this.dbCredentialsCache.set(role, credentials);

      return credentials;
      
    } catch (error) {
      console.error('❌ Failed to get dynamic credentials:', {
        message: error.message,
        code: error.code,
        response: error.response?.data,
        stack: error.stack
      });
      
      // Try to provide more specific error messages
      if (error.message.includes('403')) {
        throw new Error(`Access denied to Vault path. Check policies and permissions for role: ${role}`);
      } else if (error.message.includes('404')) {
        throw new Error(`Vault path not found: database/creds/${role}. Check if database engine and role are configured.`);
      } else if (error.message.includes('ECONNREFUSED')) {
        throw new Error('Cannot connect to Vault server. Check if Vault is running and accessible.');
      } else if (error.message.includes('ENOTFOUND')) {
        throw new Error('Vault server hostname not found. Check VAULT_ADDR configuration.');
      } else {
        throw new Error(`Failed to retrieve database credentials: ${error.message}`);
      }
    }
  }

  async testDatabaseEngine(role = 'my-role') {
    try {
      console.log('🔍 Testing database engine configuration...');
      
      // List database connections
      const connections = await vaultClient.list('database/config');
      console.log('📋 Available database connections:', connections.data.keys);
      
      // List database roles
      const roles = await vaultClient.list('database/roles');
      console.log('📋 Available database roles:', roles.data.keys);
      
      // Check if our role exists
      if (!roles.data.keys.includes(role)) {
        throw new Error(`Database role '${role}' not found. Available roles: ${roles.data.keys.join(', ')}`);
      }
      
      // Get role configuration
      const roleConfig = await vaultClient.read(`database/roles/${role}`);
      console.log('⚙️ Role configuration:', roleConfig.data);
      
      return true;
      
    } catch (error) {
      console.error('❌ Database engine test failed:', error.message);
      throw error;
    }
  }

  async renewLease(leaseId) {
    try {
      const response = await vaultClient.write('sys/leases/renew', {
        lease_id: leaseId,
        increment: 3600 // Renew for 1 hour
      });

      logger.info('Lease renewed successfully', {
        leaseId,
        newLeaseDuration: response.lease_duration
      });

      return response;
    } catch (error) {
      logger.error('Failed to renew lease:', error.message);
      throw error;
    }
  }

  async revokeLease(leaseId) {
    try {
      if (!leaseId) {
        console.warn('⚠️ No lease ID provided for revocation');
        return;
      }

      await vaultClient.write('sys/leases/revoke', {
        lease_id: leaseId
      });

      // Clear renewal timer
      const timer = this.leaseRenewalTimers.get(leaseId);
      if (timer) {
        clearTimeout(timer);
        this.leaseRenewalTimers.delete(leaseId);
      }

      console.log('✅ Lease revoked successfully:', leaseId);
    } catch (error) {
      console.error('❌ Failed to revoke lease:', error.message);
      // Don't throw error for revocation failures during cleanup
    }
  }

  getCachedCredentials(role = 'my-role') {
    return this.dbCredentialsCache.get(role);
  }

  clearCache() {
    this.dbCredentialsCache.clear();
    
    // Clear all renewal timers
    this.leaseRenewalTimers.forEach(timer => clearTimeout(timer));
    this.leaseRenewalTimers.clear();
  }

  // Debug method to check Vault configuration
  async debugVaultConfig() {
    try {
      console.log('🔍 Debugging Vault configuration...');
      
    //   Check Vault status
      const status = await vaultClient.status();
      console.log('Vault Status:', status);
      
    //   Check authentication
      const auth = await vaultClient.read('auth/token/lookup-self');
      console.log('Auth Info:', {
        policies: auth.data.policies,
        ttl: auth.data.ttl,
        renewable: auth.data.renewable
      });
      
      // Check database engine
    //   const engines = await vaultClient.read('sys/mounts');
    //   const databaseEngine = engines.data['database/'];
    //   console.log('Database Engine:', databaseEngine);
      
    //   if (!databaseEngine) {
    //     throw new Error('Database engine not mounted at database/');
    //   }
      
      // Test database engine
    //   await this.testDatabaseEngine();
      
      console.log('✅ Vault configuration looks good');
      
    } catch (error) {
      console.error('❌ Vault configuration debug failed:', error.message);
      throw error;
    }
  }
}

module.exports = new VaultService();