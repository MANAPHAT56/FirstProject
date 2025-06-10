// const rateLimit = require("express-rate-limit");
// const newrelic = require('newrelic');
const jwt = require('jsonwebtoken');
const path = require("path");
const cookieParser = require('cookie-parser');
const express = require("express");
// const router1 = require("./router/router"); // Remove direct require here
// const router2 = require("./router/router2"); // Remove direct require here
const cors = require('cors');
const session = require('express-session');
const https = require('https');
const fs = require('fs');
const dotenv = require('dotenv');
const promClient = require('prom-client');
console.log("HIHIHIHIH");
dotenv.config();

const app = express();
const { initializePool, getPool } = require('./db.js');
const { initializeClient, getClient } = require('./redis.js');

// --- Middleware ---
// app.use(session({
//   secret: "kuy",
//   resave: false,
//   saveUninitialized: true,
// }));
app.set('trust proxy', true);
app.use(cookieParser());
// app.use(express.static(path.join(__dirname, './public')));
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

// --- Prometheus Metrics ---
// ป้องกัน duplicate metrics
if (promClient.register.getSingleMetric('process_cpu_user_seconds_total') == undefined) {
  promClient.collectDefaultMetrics();
}

// สร้าง Histogram metric สำหรับเก็บเวลาตอบสนอง
const httpRequestDurationMicroseconds = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.05, 0.1, 0.5, 1, 3, 5, 10], // 5ms,10ms,50ms,100ms,500ms,1s,3s,5s,10s
});

// Middleware สำหรับวัด request timing
app.use((req, res, next) => {
  const end = httpRequestDurationMicroseconds.startTimer();
  res.on('finish', () => {
    end({
      method: req.method,
      route: req.route ? req.route.path : req.path, // บางครั้ง req.route อาจจะ undefined
      status_code: res.statusCode
    });
  });
  next();
});

// ถ้าจะใช้ HTTPS ให้ uncomment ข้างล่าง
// https.createServer(options, app).listen(5000, () => {
//   console.log('Server is running on HTTPS port 5000');
// });

// --- Routes ---
async function startServer() {
    try {
        // 1. Initialize Database Pool
        await initializePool();
        const pool = getPool(); // Get the initialized pool instance
        console.log('✅ Database pool initialized successfully.');

        // --- NEW: Inspecting Pool Data ---
        try {
            console.log('\n--- Inspecting MySQL Pool ---');
            // Log the pool object itself (shows connection details, but not actual data)
            // console.log('Pool object:', pool); 
            // This will show properties of the pool like connectionLimit, etc.

            // Execute a simple query to verify connection and fetch some data
            // Replace 'your_table_name' with an actual table in your DB, e.g., 'user' or 'stores'
            // LIMIT 10 to avoid fetching too much data
            const [rows, fields] = await pool.query('SELECT * FROM user LIMIT 5'); 
            console.log('Sample data from "user" table:');
            console.table(rows); // Use console.table for better readability of tabular data

            // You can also check pool status (e.g., active connections)
            console.log('Pool status (getPool.getConnection().threadId might be useful if logged directly inside db.js):');
            // For mysql2, pool.stats might not be directly available, but you can check connection status
            // console.log('Connections in pool:', pool.getConnection().connection.state); // This is not how you get connection state directly
            // For actual connection stats, you'd typically need to access internal properties or use events/metrics
            // For basic check, successful query implies connection is fine.
            console.log('--- End MySQL Pool Inspection ---\n');

        } catch (dbInspectError) {
            console.error('⚠️ Error inspecting database pool:', dbInspectError.message);
            // Don't exit if inspection fails, as the main app might still work
        }
        // --- END NEW: Inspecting Pool Data ---


        await initializeClient();
        const redisClient = getClient(); // ดึง Redis client instance ที่ initialize แล้ว
        console.log('✅ Redis client initialized successfully.');

        // 3. Import Routers AFTER database and Redis are initialized
        const router1 = require("./router/router")(pool, redisClient);
        const router2 = require("./router/router2")(pool, redisClient);

        // 4. Register Routes
        app.use('/', router1);
        app.use('/', router2);

        // เส้นทางสำหรับ metrics
        app.get('/metrics', async (req, res) => {
            res.set('Content-Type', promClient.register.contentType);
            res.end(await promClient.register.metrics());
        });

        // 5. Start HTTP Server
        app.listen(5000, () => {
            console.log("🚀 Server running on HTTP port 5000");
        });

    } catch (err) {
        console.error('❌ Failed to start server:', err);
        process.exit(1); // Exit the process if initialization fails
    }
}
startServer();