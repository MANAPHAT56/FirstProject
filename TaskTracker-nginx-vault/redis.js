const redis = require('redis');

let client = null; // Declare client as null initially

/**
 * Initializes the Redis client and establishes a connection.
 * @returns {Promise<void>} A promise that resolves when the client is connected.
 */
async function initializeClient() {
    if (client && client.isReady) { // Check if client already exists and is ready
        console.log('Redis client already initialized and connected.');
        return;
    }

    // Create the client
    client = redis.createClient({
        url: 'redis://redis-container:6379'
    });

    // Set up error handling and connection messages
    client.on('connect', () => {
        console.log('Connected to Redis');
    });

    client.on('error', (err) => {
        console.error('Redis Client Error:', err);
    });

    // Connect the client and wait for it to be ready
    try {
        await client.connect();
        console.log('Redis client connected successfully.');
    } catch (err) {
        console.error('Failed to connect to Redis:', err);
        throw err; // Re-throw the error to be caught by the calling function (e.g., in app.js)
    }
}

/**
 * Returns the initialized Redis client instance.
 * Throws an error if the client has not been initialized.
 * @returns {redis.RedisClientType} The Redis client instance.
 */
function getClient() {
    if (!client || !client.isReady) {
        throw new Error('Redis client has not been initialized or is not ready. Call initializeClient() first.');
    }
    return client;
}

module.exports = {
    initializeClient,
    getClient
};