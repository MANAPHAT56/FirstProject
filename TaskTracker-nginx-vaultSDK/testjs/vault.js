const vault = require('node-vault');
const logger = require('./logger');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../vault-script/vault.env') });

const vaultClient = vault({
  apiVersion: 'v1',
  endpoint: 'http://vault:8200',
  token: process.env.VAULT_TOKEN
});

// Test vault connection
const testVaultConnection = async () => {
  try {
    const health = await vaultClient.health();
    logger.info('Vault connection successful', { health });
    return true;
  } catch (error) {
    logger.error('Vault connection failed:', error.message);
    return false;
  }
};

module.exports = {
  client: vaultClient,
  testConnection: testVaultConnection
};