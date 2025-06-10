// vault.js
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, './vault-script/token.env') });
const vault = require('node-vault')({
  apiVersion: 'v1',
  endpoint: 'http://vault:8200', // หรือ URL ของ Vault
  token: process.env.VAULT_TOKEN     // อาจดึงจาก Vault Agent sink หรือ ENV
});

async function getDBCreds() {
  try {
    const result = await vault.read('database/creds/my-role');
    return {
      user: result.data.username,
      pass: result.data.password
    };
  } catch (err) {
    console.error('❌ Failed to read from Vault:', err.message);
    throw err;
  }
}

module.exports = { getDBCreds };
