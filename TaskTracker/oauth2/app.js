// app.js
require('dotenv').config();
const express = require('express');
const passport = require('passport');
const session = require('express-session');
const path = require('path');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const cors = require('cors'); // ✅ เพิ่ม CORS
// เรียกใช้งาน router
const app = express();
const authRouter = require('./router');
// แยก routes ไปยัง router.js

// Middleware สำหรับ JSON Parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ใช้ cookie-parser ก่อน passport
app.use(cookieParser());

// กำหนดการตั้งค่าของ Session
app.use(session({
  secret: process.env.SESSION_SECRET, // รหัสลับสำหรับการเข้ารหัสข้อมูลใน session
  resave: false,
  saveUninitialized: true,
  cookie: {
    secure: false, // ให้รองรับ HTTP
    httpOnly: true,
    maxAge: 1000 * 60 * 60,
    samesite : "none"
  }
}));

// เริ่มต้น Passport
app.use(passport.initialize());
app.use(passport.session());
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, "view"));

// ตั้งค่า static file สำหรับหน้าเว็บ Front-end
app.use(express.static(path.join(__dirname, 'public')));
app.use('/', authRouter);

// เริ่มต้นเซิร์ฟเวอร์
app.listen(3000, () => {
  console.log('Server is running on http://localhost:3000');
  console.log(process.env.GOOGLE_CLIENT_ID);
});
