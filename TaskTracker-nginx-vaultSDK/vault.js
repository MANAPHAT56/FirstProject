const { client: vaultClient } = require('./testjs/vault');
const logger = require('./testjs/logger');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, './vault-script/vault.env') });

class VaultService {
  constructor() {
    this.dbCredentialsCache = new Map();
    this.leaseRenewalTimers = new Map();
    this.isInitialized = false;
    this.currentToken = null;
    this.tokenRenewalTimer = null;
    
    // Secret ID rotation properties
    this.currentSecretId = null;
    this.secretIdRenewalTimer = null;
    this.secretIdCreatedAt = null;
    this.secretIdTtl = null;
  }

  async initialize() {
    try {
      console.log('🔄 Initializing Vault connection with AppRole...');
      
      // Authenticate with AppRole first
      await this.authenticateWithAppRole();
      
      // Test Vault connection
      const healthCheck = await vaultClient.status();
      console.log('✅ Vault status:', healthCheck);
      
      // Test authentication
      const authCheck = await vaultClient.read('auth/token/lookup-self');
      console.log('✅ Vault auth status:', {
        policies: authCheck.data.policies,
        ttl: authCheck.data.ttl,
        renewable: authCheck.data.renewable
      });
      
      // Start token renewal if renewable
      if (authCheck.data.renewable && authCheck.data.ttl > 0) {
        this.startTokenRenewal(authCheck.data.ttl);
      }
      
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

  async authenticateWithAppRole() {
    try {
      const roleId = process.env.VAULT_ROLE_ID;
      let secretId = process.env.VAULT_SECRET_ID;

      if (!roleId) {
        throw new Error('VAULT_ROLE_ID environment variable is required');
      }

      if (!secretId) {
        throw new Error('VAULT_SECRET_ID environment variable is required');
      }

      // Use current secret ID if available and not expired
      if (this.currentSecretId && !this.isSecretIdExpired()) {
        secretId = this.currentSecretId;
        console.log('🔄 Using cached Secret ID...');
      } else {
        // Store the original secret ID for first use
        this.currentSecretId = secretId;
      }

      console.log('🔐 Authenticating with AppRole...');
      console.log('📍 Role ID:', roleId.substring(0, 8) + '...');
      console.log('📍 Secret ID:', secretId.substring(0, 8) + '...');

      const authResponse = await vaultClient.write('auth/approle/login', {
        role_id: roleId,
        secret_id: secretId
      });

      if (!authResponse || !authResponse.auth || !authResponse.auth.client_token) {
        throw new Error('Invalid AppRole authentication response');
      }

      // Set the token for subsequent requests
      this.currentToken = authResponse.auth.client_token;
      vaultClient.token = this.currentToken;

      console.log('✅ AppRole authentication successful');
      console.log('📋 Token policies:', authResponse.auth.policies);
      console.log('⏰ Token TTL:', authResponse.auth.lease_duration, 'seconds');

      // Check and schedule Secret ID rotation if supported
      await this.checkAndScheduleSecretIdRotation();

      return authResponse;

    } catch (error) {
      console.error('❌ AppRole authentication failed:', {
        message: error.message,
        code: error.code,
        response: error.response?.data
      });

      // If authentication fails with current secret ID, try to rotate
      if (error.message.includes('403') && this.currentSecretId !== process.env.VAULT_SECRET_ID) {
        console.log('🔄 Authentication with cached Secret ID failed, trying to rotate...');
        try {
          await this.rotateSecretId();
          return await this.authenticateWithAppRole();
        } catch (rotateError) {
          console.error('❌ Secret ID rotation failed:', rotateError.message);
        }
      }

      // Provide specific error messages
      if (error.message.includes('403')) {
        throw new Error('AppRole authentication denied. Check role_id and secret_id validity.');
      } else if (error.message.includes('400')) {
        throw new Error('Invalid AppRole credentials format. Check VAULT_ROLE_ID and VAULT_SECRET_ID.');
      } else if (error.message.includes('404')) {
        throw new Error('AppRole auth method not found. Check if AppRole is enabled in Vault.');
      }
      
      throw error;
    }
  }

  async checkAndScheduleSecretIdRotation() {
    try {
      // Get AppRole role information to check Secret ID TTL
      const roleName = process.env.VAULT_ROLE_NAME || 'myapp';
      const roleInfo = await vaultClient.read(`auth/approle/role/${roleName}`);
      
      if (roleInfo && roleInfo.data && roleInfo.data.secret_id_ttl) {
        const secretIdTtl = parseInt(roleInfo.data.secret_id_ttl);
        
        // Only schedule rotation if TTL > 0 (not unlimited)
        if (secretIdTtl > 0) {
          this.secretIdTtl = secretIdTtl;
          this.secretIdCreatedAt = Date.now();
          
          console.log('📋 Secret ID TTL detected:', secretIdTtl, 'seconds');
          this.scheduleSecretIdRotation(secretIdTtl);
        } else {
          console.log('📋 Secret ID has unlimited TTL, no rotation needed');
        }
      }
    } catch (error) {
      console.warn('⚠️ Could not check Secret ID TTL:', error.message);
      // Don't fail initialization if we can't check Secret ID TTL
    }
  }

  scheduleSecretIdRotation(ttl) {
    // Clear existing timer
    if (this.secretIdRenewalTimer) {
      clearTimeout(this.secretIdRenewalTimer);
    }

    // Rotate at 80% of TTL to ensure we have time for the operation
    const rotationTime = (ttl * 0.8) * 1000; // Convert to milliseconds
    
    console.log(`⏰ Scheduling Secret ID rotation in ${ttl * 0.8} seconds`);

    this.secretIdRenewalTimer = setTimeout(async () => {
      try {
        console.log('🔄 Rotating Secret ID...');
        await this.rotateSecretId();
        
        // Re-authenticate with new Secret ID
        await this.authenticateWithAppRole();
        
        console.log('✅ Secret ID rotated and re-authenticated successfully');
        
        // Schedule next rotation
        if (this.secretIdTtl > 0) {
          this.scheduleSecretIdRotation(this.secretIdTtl);
        }

      } catch (error) {
        console.error('❌ Secret ID rotation failed:', error.message);
        
        // Try to continue with current Secret ID
        console.log('⚠️ Continuing with current Secret ID...');
        
        // Schedule a retry in 5 minutes
        setTimeout(() => {
          this.scheduleSecretIdRotation(300); // Retry in 5 minutes
        }, 5 * 60 * 1000);
      }
    }, rotationTime);
  }

  async rotateSecretId() {
    try {
      const roleId = process.env.VAULT_ROLE_ID;
      const roleName = process.env.VAULT_ROLE_NAME || 'myapp';
      
      if (!roleId) {
        throw new Error('VAULT_ROLE_ID environment variable is required for Secret ID rotation');
      }

      console.log('🔄 Generating new Secret ID...');
      
      // Generate new Secret ID
      const newSecretResponse = await vaultClient.write(`auth/approle/role/${roleName}/secret-id`, {});
      
      if (!newSecretResponse || !newSecretResponse.data || !newSecretResponse.data.secret_id) {
        throw new Error('Failed to generate new Secret ID');
      }

      const newSecretId = newSecretResponse.data.secret_id;
      console.log('✅ New Secret ID generated:', newSecretId.substring(0, 8) + '...');

      // Destroy old Secret ID if it exists and is different
      if (this.currentSecretId && this.currentSecretId !== process.env.VAULT_SECRET_ID) {
        try {
          await this.destroySecretId(this.currentSecretId);
        } catch (destroyError) {
          console.warn('⚠️ Failed to destroy old Secret ID:', destroyError.message);
          // Don't fail rotation if old Secret ID can't be destroyed
        }
      }

      // Update current Secret ID
      this.currentSecretId = newSecretId;
      this.secretIdCreatedAt = Date.now();
      
      return newSecretId;

    } catch (error) {
      console.error('❌ Secret ID rotation failed:', {
        message: error.message,
        code: error.code,
        response: error.response?.data
      });
      
      // Provide specific error messages
      if (error.message.includes('403')) {
        throw new Error('Permission denied for Secret ID rotation. Check token policies.');
      } else if (error.message.includes('404')) {
        throw new Error('AppRole role not found for Secret ID rotation.');
      }
      
      throw error;
    }
  }

  async destroySecretId(secretId) {
    try {
      const roleName = process.env.VAULT_ROLE_NAME || 'myapp';
      
      // First, get the accessor for the Secret ID
      const secretIdList = await vaultClient.list(`auth/approle/role/${roleName}/secret-id`);
      
      if (secretIdList && secretIdList.data && secretIdList.data.keys) {
        // Find the accessor for our Secret ID (this is a simplified approach)
        // In production, you might want to store the accessor when creating the Secret ID
        for (const accessor of secretIdList.data.keys) {
          try {
            await vaultClient.write(`auth/approle/role/${roleName}/secret-id/destroy`, {
              secret_id: secretId
            });
            
            console.log('✅ Old Secret ID destroyed successfully');
            break;
          } catch (destroyError) {
            // Continue trying other methods or ignore if already destroyed
            continue;
          }
        }
      }
    } catch (error) {
      console.warn('⚠️ Could not destroy Secret ID:', error.message);
      // Don't throw error as this is cleanup
    }
  }

  isSecretIdExpired() {
    if (!this.secretIdCreatedAt || !this.secretIdTtl) {
      return false; // Unknown expiration, assume valid
    }
    
    const now = Date.now();
    const expirationTime = this.secretIdCreatedAt + (this.secretIdTtl * 1000);
    
    return now >= expirationTime;
  }

  startTokenRenewal(ttl) {
    // Clear existing timer
    if (this.tokenRenewalTimer) {
      clearTimeout(this.tokenRenewalTimer);
    }

    // Renew at 50% of TTL
    const renewalTime = (ttl * 0.5) * 1000; // Convert to milliseconds
    
    console.log(`⏰ Scheduling token renewal in ${ttl * 0.5} seconds`);

    this.tokenRenewalTimer = setTimeout(async () => {
      try {
        console.log('🔄 Renewing Vault token...');
        
        const renewResponse = await vaultClient.write('auth/token/renew-self', {
          increment: ttl // Renew for same duration
        });

        console.log('✅ Token renewed successfully');
        console.log('⏰ New TTL:', renewResponse.auth.lease_duration, 'seconds');

        // Schedule next renewal
        this.startTokenRenewal(renewResponse.auth.lease_duration);

      } catch (error) {
        console.error('❌ Token renewal failed:', error.message);
        console.log('🔄 Re-authenticating with AppRole...');
        
        try {
          await this.authenticateWithAppRole();
          const authCheck = await vaultClient.read('auth/token/lookup-self');
          if (authCheck.data.renewable) {
            this.startTokenRenewal(authCheck.data.ttl);
          }
        } catch (reAuthError) {
          console.error('❌ Re-authentication failed:', reAuthError.message);
          this.isInitialized = false;
        }
      }
    }, renewalTime);
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
        leaseDuration: response.lease_duration || 60,
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
      
      // Check if it's an authentication error and retry
      if (error.message.includes('403') || error.message.includes('permission denied')) {
        console.log('🔄 Authentication may have expired, re-initializing...');
        this.isInitialized = false;
        
        try {
          await this.initialize();
          return await this.getDynamicCredentials(role);
        } catch (retryError) {
          throw new Error(`Failed to re-authenticate and retry: ${retryError.message}`);
        }
      }
      
      // Provide specific error messages
      if (error.message.includes('404')) {
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
      
      // Ensure we're authenticated
      if (!this.isInitialized) {
        await this.initialize();
      }
      
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
    
    // Clear token renewal timer
    if (this.tokenRenewalTimer) {
      clearTimeout(this.tokenRenewalTimer);
      this.tokenRenewalTimer = null;
    }
    
    // Clear Secret ID renewal timer
    if (this.secretIdRenewalTimer) {
      clearTimeout(this.secretIdRenewalTimer);
      this.secretIdRenewalTimer = null;
    }
  }

  // Debug method to check Vault configuration
  async debugVaultConfig() {
    try {
      console.log('🔍 Debugging Vault configuration...');
      
      // Ensure we're authenticated
      if (!this.isInitialized) {
        await this.initialize();
      }
      
      // Check Vault status
      const status = await vaultClient.status();
      console.log('Vault Status:', status);
      
      // Check authentication
      const auth = await vaultClient.read('auth/token/lookup-self');
      console.log('Auth Info:', {
        policies: auth.data.policies,
        ttl: auth.data.ttl,
        renewable: auth.data.renewable
      });
      
      // Check AppRole configuration and Secret ID status
      try {
        const roleName = process.env.VAULT_ROLE_NAME || 'myapp';
        const roleInfo = await vaultClient.read(`auth/approle/role/${roleName}`);
        console.log('AppRole Config:', {
          ...roleInfo.data,
          secret_id_ttl: roleInfo.data.secret_id_ttl,
          secret_id_num_uses: roleInfo.data.secret_id_num_uses
        });
        
        // Show Secret ID rotation status
        if (this.secretIdTtl) {
          const timeLeft = this.secretIdCreatedAt + (this.secretIdTtl * 1000) - Date.now();
          console.log('Secret ID Status:', {
            ttl: this.secretIdTtl,
            timeLeft: Math.max(0, Math.floor(timeLeft / 1000)),
            expired: this.isSecretIdExpired()
          });
        }
        
      } catch (error) {
        console.warn('Could not read AppRole config:', error.message);
      }
      
      // Check database engine
      const engines = await vaultClient.read('sys/mounts');
      const databaseEngine = engines.data['database/'];
      console.log('Database Engine:', databaseEngine);
      
      if (!databaseEngine) {
        throw new Error('Database engine not mounted at database/');
      }
      
      // Test database engine
      await this.testDatabaseEngine();
      
      console.log('✅ Vault configuration looks good');
      
    } catch (error) {
      console.error('❌ Vault configuration debug failed:', error.message);
      throw error;
    }
  }

  // Get Secret ID rotation status
  getSecretIdStatus() {
    if (!this.secretIdTtl || !this.secretIdCreatedAt) {
      return {
        hasRotation: false,
        message: 'Secret ID rotation not configured or unlimited TTL'
      };
    }
    
    const now = Date.now();
    const expirationTime = this.secretIdCreatedAt + (this.secretIdTtl * 1000);
    const timeLeft = Math.max(0, expirationTime - now);
    
    return {
      hasRotation: true,
      ttl: this.secretIdTtl,
      createdAt: new Date(this.secretIdCreatedAt).toISOString(),
      expiresAt: new Date(expirationTime).toISOString(),
      timeLeftSeconds: Math.floor(timeLeft / 1000),
      expired: timeLeft === 0
    };
  }

  // Cleanup method
  async cleanup() {
    console.log('🧹 Cleaning up Vault service...');
    
    // Revoke current Secret ID if it's not the original one
    if (this.currentSecretId && this.currentSecretId !== process.env.VAULT_SECRET_ID) {
      try {
        await this.destroySecretId(this.currentSecretId);
      } catch (error) {
        console.warn('⚠️ Could not destroy Secret ID during cleanup:', error.message);
      }
    }
    
    this.clearCache();
    this.isInitialized = false;
    this.currentToken = null;
    this.currentSecretId = null;
    this.secretIdCreatedAt = null;
    this.secretIdTtl = null;
    
    console.log('✅ Vault service cleanup completed');
  }
}

module.exports = new VaultService();