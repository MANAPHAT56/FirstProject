const jwt = require('jsonwebtoken');
const path = require("path");
const cookieParser = require('cookie-parser');
const express = require("express");
const cors = require('cors');
const session = require('express-session');
const https = require('https');
const fs = require('fs');
const dotenv = require('dotenv');
const promClient = require('prom-client');

console.log("Starting application...");
require('dotenv').config({ path: path.resolve(__dirname, './router/.env') });
const app = express();
const {getClient,initializeClient} = require('./redis.js');
// Import Vault services และ database functions
const vaultService = require('./vault.js');
const databaseService = require('./db.js');
const { testConnection } = require('./testjs/vault');

// --- Middleware ---
app.set('trust proxy', true);
app.use(cookieParser());
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, "view"));

app.use(cors({
    methods: ['GET', 'POST'],
    credentials: true,
}));

// --- Logging requests ---
app.use((req, res, next) => {
    console.log(`🔍 Request from: ${req.ip} - ${req.method} ${req.url}`);
    next();
});

//--- Prometheus Metrics (commented เหมือนโค้ดเดิม) ---
if (promClient.register.getSingleMetric('process_cpu_user_seconds_total') == undefined) {
    promClient.collectDefaultMetrics();
}

const httpRequestDurationMicroseconds = new promClient.Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.005, 0.01, 0.05, 0.1, 0.5, 1, 3, 5, 10],
});

// --- Start Server Function ---
async function startServer() {
    let server;

    try {
        console.log("client redis");
        await initializeClient();
        const client = await getClient();
        // 1. Test Vault Connection
        console.log('🔐 Testing Vault connection...');
        const vaultHealthy = await testConnection();
        if (!vaultHealthy) {
            throw new Error('Vault connection failed');
        }
        console.log('✅ Vault connection successful.');

        // 2. Initialize Database with Vault credentials
        console.log('🗄️ Initializing database with Vault credentials...');
        await databaseService.createConnection();
        console.log('✅ Database connection initialized successfully.');

        // 3. Import Routers AFTER vault and database are initialized
        // Pass the databaseService instance to your routers
        const router1 = require("./router/router")(databaseService,client);
        const router2 = require("./router/router2")(databaseService,client);

        // Health check route for vault และ database
        app.get('/health', async (req, res) => {
            try {
                const health = {
                    status: 'healthy',
                    timestamp: new Date().toISOString(),
                    services: {
                        vault: await testConnection(),
                        database: await databaseService.healthCheck()
                    }
                };

                const isHealthy = health.services.vault && 
                                 health.services.database.status === 'healthy';

                res.status(isHealthy ? 200 : 503).json(health);
            } catch (error) {
                console.error('Health check failed:', error.message);
                res.status(503).json({
                    status: 'unhealthy',
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });

        // Vault specific health check
        app.get('/health/vault', async (req, res) => {
            try {
                const isHealthy = await testConnection();
                res.json({
                    vault: {
                        status: isHealthy ? 'healthy' : 'unhealthy',
                        endpoint: process.env.VAULT_ADDR
                    }
                });
            } catch (error) {
                res.status(503).json({
                    vault: {
                        status: 'unhealthy',
                        error: error.message
                    }
                });
            }
        });

        // 4. Register Routes
        app.use('/', router1);
        app.use('/', router2);

        // เส้นทางสำหรับ metrics (commented เหมือนโค้ดเดิม)
        app.get('/metrics', async (req, res) => {
            res.set('Content-Type', promClient.register.contentType);
            res.end(await promClient.register.metrics());
        });

        // 5. Start HTTP Server
        const HTTP_PORT = process.env.HTTP_PORT || 5000;
        server = app.listen(HTTP_PORT, () => {
            console.log(`🚀 Server running on HTTP port ${HTTP_PORT}`);
        });

        // --- Graceful Shutdown ---
        const handleShutdown = async (signal) => {
            console.log(`${signal} signal received: Initiating graceful shutdown...`);

            const GRACEFUL_SHUTDOWN_TIMEOUT_MS = (parseInt(process.env.GRACEFUL_SHUTDOWN_TIMEOUT_SECONDS || '15')) * 1000;

            server.close({ timeout: GRACEFUL_SHUTDOWN_TIMEOUT_MS }, async (err) => {
                if (err) {
                    console.error('❌ Error closing HTTP server:', err.message);
                } else {
                    console.log('HTTP server closed.');
                }
                
                // Shutdown database และ vault services
                await databaseService.close();
                vaultService.clearCache();
                console.log('Application terminated gracefully.');
                
                process.exit(err ? 1 : 0); 
            });

            setTimeout(() => {
                console.error('⚠️ Graceful shutdown timed out. Forcing exit.');
                process.exit(1);
            }, GRACEFUL_SHUTDOWN_TIMEOUT_MS + 5000);
        };

        process.on('SIGTERM', () => handleShutdown('SIGTERM'));
        process.on('SIGINT', () => handleShutdown('SIGINT'));

    } catch (err) {
        console.error('❌ Failed to start server:', err);
        process.exit(1);
    }
}

// Start the server
if (require.main === module) {
    startServer();
}

module.exports = app;


