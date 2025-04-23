// const { createClient } = require('redis');
// const client= createClient({
//     // url: 'redis://localhost:6379'
//     url: 'localhost://redis:6379'
//   });
//   client.on('error', (err) => console.error('Redis Client Error', err));
//   client.connect()
//     .then(() => {
//       console.log('Connected to Redis');
//     })
//     .catch((err) => {
//       console.error('Failed to connect to Redis:', err);
//     });
//   // module.exports = { app, connection };
//   module.exports = client;
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