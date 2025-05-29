
const redis = require('redis');
const client = redis.createClient({
  url: 'redis://redis-container:6379'
});

client.on('connect', () => {
  console.log('Connected to Redis');
});

client.on('error', (err) => {
  console.error('Redis Client Error:', err);
});

client.connect();  // ตรวจสอบว่าเชื่อมต่อก่อนใช้งาน Redis
module.exports = client;