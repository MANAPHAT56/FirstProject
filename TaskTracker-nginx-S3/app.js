// const rateLimit = require("express-rate-limit");
const newrelic = require('newrelic');
const jwt = require('jsonwebtoken');
const path = require("path");
const cookieParser = require('cookie-parser');
const express = require("express");
const router1 = require("./router/router");
const router2 = require("./router/router2");
const cors = require('cors');
const session = require('express-session');
const https = require('https');
const fs = require('fs');
const dotenv = require('dotenv');
const promClient = require('prom-client');

dotenv.config();

const app = express();
app.disable('x-powered-by');
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
  origin: 'https://toteja1.co',
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
app.use('/', router1);
app.use('/', router2);

// เส้นทางสำหรับ metrics
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', promClient.register.contentType);
  res.end(await promClient.register.metrics());
});

// ตอนนี้ใช้ HTTP ก่อน
app.listen(5000, () => {
  console.log("Server running on HTTP port 5000");
});
