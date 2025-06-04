
const redis = require('redis');
const client = redis.createClient({
  socket: {
    host: 'redis-service',
    port: 6379,
    reconnectStrategy: (retries) => {
      console.log(`Reconnecting attempt: ${retries}`);
      return Math.min(retries * 100, 5000);
    }
  }
});

client.on('ready', () => console.log('Redis is ready'));
client.on('reconnecting', () => console.log('Redis reconnecting'));
client.on('end', () => console.log('Redis connection closed'));