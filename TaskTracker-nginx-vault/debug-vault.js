// debug-vault.js
const vaultService = require('./vault');

async function debugVault() {
  console.log('🔍 Starting Vault debugging...');
  console.log('='.repeat(50));
  
  try {
    // 1. Check environment variables
    console.log('📋 Environment Variables:');
    console.log('VAULT_ADDR:', process.env.VAULT_ADDR);
    console.log('VAULT_TOKEN:', process.env.VAULT_TOKEN ? '***SET***' : 'NOT SET');
    console.log('VAULT_NAMESPACE:', process.env.VAULT_NAMESPACE || 'NOT SET');
    console.log('');
    
    // 2. Test Vault connection
    console.log('🔗 Testing Vault connection...');
    await vaultService.debugVaultConfig();
    console.log('');
    
    // 3. Try to get credentials
    console.log('🔑 Testing credential retrieval...');
    const credentials = await vaultService.getDynamicCredentials('my-role');
    console.log('✅ Credentials retrieved successfully:', {
      username: credentials.username,
      hasPassword: !!credentials.password,
      leaseId: credentials.leaseId,
      ttl: credentials.ttl
    });
    
    // 4. Clean up
    if (credentials.leaseId) {
      console.log('🗑️ Cleaning up lease...');
      await vaultService.revokeLease(credentials.leaseId);
    }
    
    console.log('✅ Debug completed successfully!');
    
  } catch (error) {
    console.error('❌ Debug failed:', error.message);
    
    // Provide troubleshooting steps
    console.log('\n🔧 Troubleshooting Steps:');
    console.log('1. Check if Vault server is running');
    console.log('2. Verify VAULT_ADDR is correct');
    console.log('3. Verify VAULT_TOKEN has proper permissions');
    console.log('4. Check if database engine is mounted');
    console.log('5. Verify database role "my-role" exists');
    console.log('6. Check database connection configuration');
    
    process.exit(1);
  }
}

// Run debug if this file is executed directly
if (require.main === module) {
  debugVault();
}

module.exports = debugVault;