// แทนที่ import 'newrelic';
const rateLimit = require("express-rate-limit");
const newrelic = require('newrelic');
const jwt = require('jsonwebtoken');
const path = require("path");
const cookieParser=require('cookie-parser');
const express = require("express");
const router1 = require("./router/router");
const router2=require("./router/router2")
const cors=require('cors');
const app= express();
const connection=require('./db');
const session = require('express-session');
app.use(session({secret: "kuy", resave: false, saveUninitialized:true}));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, './public')));
app.use(express.urlencoded({extended:false}));
app.set('view engine','ejs');
app.set('views',path.join(__dirname,"view"));
const https = require('https');
const fs = require('fs');
require('dotenv').config();
app.use(cors({ // ตั้งค่าให้ถูกต้องกับโดเมนของ frontend
    methods: ['GET', 'POST'],
    credentials: true
  }));
app.use(express.json());
const limiter = rateLimit({
  windowMs: 1000*60, // 1 นาที
  max: 50, // จำกัด 100 requests ต่อ IP
  message: "Too many requests, please try again later.", // ข้อความแจ้งเมื่อโดนบล็อก
  standardHeaders: true, // คืน rate limit ไปยัง `RateLimit-*` ใน headers 
  legacyHeaders: false, // ปิด `X-RateLimit-*` ใน headers 
  handler: (req, res) => {
    console.log(`⛔ Blocked: ${req.ip}`);
    res.status(429).json({ error: "Too many requests, please try again later." });
  }
});
app.use((req, res, next) => {
  console.log(`🔍 Request from: ${req.ip} - ${req.method} ${req.url}`);
  next();
});
app.use( limiter);
app.use('/',router1);
app.use('/',router2);
app.use(session({
  secret: "kuy",
  resave: false,
  saveUninitialized: true,
}));
// const options = {
//   key: fs.readFileSync("./tls.key"),        // ✅ ใส่ path ของ private key
//   cert: fs.readFileSync("./tls.crt"),       // ✅ ใส่ path ของ certificate
//   // key: fs.readFileSync("./OpenSSL-Win64/bin/privatekey.pem"),  // ใช้ private key ของคุณ
//   // cert: fs.readFileSync("./OpenSSL-Win64/bin/certificate.pem"),  // ใช้ certificate ของคุณ
//   // ca: fs.readFileSync("./OpenSSL-Win64/bin/certificate.csr"), // ใช้ CA cert (ถ้ามี)
//   // passphrase: '18081978'
// };  

// ตั้งค่า Rate Limiting (100 requests ต่อ IP ต่อ 1 นาที)

// ใช้ Rate Limiting กับทุก API ที่อยู่ใต้ "/api/"
// https.createServer(options, app).listen(5000, () => {
//   console.log('Server is running on HTTPS');
// });
app.listen(5000, () => {
  console.log("Server running on HTTP port 5000");
});
// // Middleware
// app.use(passport.initialize());
// app.use(passport.session());
// passport.use(
//   new GoogleStrategy(
//     {
//       clientID: process.env.GOOGLE_CLIENT_ID,   
//       clientSecret: process.env.GOOGLE_CLIENT_SECRET,
//       callbackURL: process.env.GOOGLE_CALLBACK_URL,
//     },
//     (accessToken, refreshToken, profile, done) => {
//       // ลองเช็คว่า accessToken และ refreshToken เป็น null หรือไม่
//       console.log('🔑 AccessToken:', accessToken); // อาจเป็น undefined ถ้าคุณไม่ได้ร้องขอ scope ที่ต้องการ
//       console.log('🔄 RefreshToken:', refreshToken); // อาจเป็น undefined ถ้า scope ไม่รองรับ refresh
//       console.log('👤 Profile:', profile); // นี่คือสิ่งสำคัญที่สุด

//       // แม้ไม่มี accessToken/refreshToken ก็ยังทำงานได้
//       return done(null, profile);
//     }
//   )
// );
// passport.serializeUser((user, done) => {
//   done(null, user);
// });
// passport.deserializeUser((user, done) => {
//   done(null, user);
// });
// document.addEventListener('DOMContentLoaded', () => {
//     const taskInput = document.getElementById('task');
//     const addTaskButton = document.getElementById('add-task');
//     const taskList = document.getElementById('tasks');

//     function addTask() {
//         const taskText = taskInput.value.trim();
//         if (taskText === '') return;

//         const li = document.createElement('li');
//         li.textContent = taskText;

//         const deleteButton = document.createElement('button');
//         deleteButton.textContent = 'Delete';
//         deleteButton.addEventListener('click', () => {
//             taskList.removeChild(li);
//         });

//         li.appendChild(deleteButton);
//         taskList.appendChild(li);
//         taskInput.value = '';
//     }

//     addTaskButton.addEventListener('click', addTask);

//     // Allow pressing Enter to add task
//     taskInput.addEventListener('keypress', (e) => {
//         if (e.key === 'Enter') {
//             addTask();
//         }
//     });
// });