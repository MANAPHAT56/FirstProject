// router.js
const express = require('express');
const router = express.Router();
// Callback เมื่อผู้ใช้ล็อกอินสำเร็จ
const axios = require('axios');
const querystring = require('querystring');
router.get('/auth/google/callback', async (req, res, next) => {
  try {
    const code = req.query.code; // รับ authorization code จาก query string
    const codeVerifier = req.cookies.codeverifier;
    console.log(req.cookies.codeverifier);
    // console.log(codeVerifier);
    // const user =  req.cookies.user;
    // console.log(user);
    if (!codeVerifier) {
      throw new Error('Missing code verifier'); // ตรวจสอบว่ามี code_verifier หรือไม่
    }
    // แลกเปลี่ยนโค้ดเป็นโทเคน
    const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', querystring.stringify({
      code: code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: process.env.GOOGLE_CALLBACK_URL,
      grant_type: 'authorization_code',
      code_verifier: codeVerifier, // ส่ง code_verifier ที่นี่
    }),// ต้องตั้งค่าให้ถูกต้อง
{
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    // ดึงข้อมูล token
    const { access_token, id_token } = tokenResponse.data;
     console.log(access_token);
    // ใช้ access_token ดึงข้อมูลผู้ใช้
    const userInfo = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` }
    });
    console.log(userInfo.data);
    res.cookie('user',userInfo.data, { 
      httpOnly: true,  // คุกกี้นี้จะไม่สามารถเข้าถึงได้จาก JavaScript ในฝั่ง client
      secure:false,  // ใช้ secure cookie เมื่อเป็น production 
      maxAge: 3600000,
      samesite : "lax"
    });   
    // res.cookie('refreshToken',"hetrhew", { httpOnly: true,secure:false, maxAge: 604800000 });
    console.log(req.cookies.user);
    // เก็บข้อมูลผู้ใช้ใน session หรือ database
    // req.session.user = userInfo.data;
    // req.user=req.session.user;
    // console.log(req.session.user);
    // รีไดเร็กต์ไปหน้า dashboard
    console.log(1);
    console.log(req.cookies.user);
    console.log(req.cookies); 
    console.log("Codeverify"+codeVerifier);
    res.redirect('/dashboard');
  } catch (err) {
    console.error(err);
    console.log(1);
    console.log("wrong")
    console.log("Codeverify"+codeVerifier);
    res.redirect('/'); // รีไดเร็กต์กลับไปหน้าแรกถ้ามีข้อผิดพลาด
  }
});
// fetch("http://localhost:5000/auth/google/callback", { credentials: "include" })
//   .then(res => res.json())
//   .then(data => {
//     if (data.success) window.location.href = "/dashboard";
//   });
// router.get('/auth/google/callback', passport.authenticate('google', {
//   failureRedirect: '/',
// }), (req, res) => {
//   console.log(req.user)
//   res.redirect('/dashboard');  // รีไดเรกไปที่หน้า dashboard หลังจากล็อกอินสำเร็จ
// });

// หน้า Dashboard ที่ต้องการให้ผู้ใช้ล็อกอินก่อน
router.get('/dashboard', (req, res) => {
  const userCookie = req.cookies.user;
  console.log(req.cookies.user);  
  console.log(req.cookies);
  // if (!req.isAuthenticated()) {
  //   return res.redirect('/');
  // }
//   res.redirect('/');
//   console.log(userCookie);
// });
  console.log("kuy");
  res.render('dashboard', { user: userCookie }); 
});

// หน้า Login
router.get('/', (req, res) => {
  res.render('front.ejs');
});

module.exports = router;
