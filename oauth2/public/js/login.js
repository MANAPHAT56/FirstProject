// /public/js/login.js
// สร้างสตริงแบบสุ่มสำหรับใช้เป็น code_verifier
function generateRandomString(length) {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    const randomValues = new Uint8Array(length);
    crypto.getRandomValues(randomValues); // ใช้ crypto API ในเบราว์เซอร์
    randomValues.forEach((value) => {
      result += charset[value % charset.length];
    });
    return result;
  }
  
  // ฟังก์ชัน SHA-256
  async function sha256(plain) {
    const encoder = new TextEncoder();
    const data = encoder.encode(plain);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return new Uint8Array(hash);
  }
  
  // แปลงจาก ArrayBuffer เป็น base64 URL
  function base64UrlEncode(arrayBuffer) {
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
    return base64.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  }
  
  // ข้อมูลที่ใช้ใน OAuth
  const clientId = '575897144741-oahon6knnlh0a6tvifopuqrvt3bq4b74.apps.googleusercontent.com';
  const redirectUri = 'http://localhost:3000/auth/google/callback';
  const authorizationUrl = 'https://accounts.google.com/o/oauth2/v2/auth';
  
  // ฟังก์ชันเมื่อผู้ใช้คลิกปุ่ม Login
  document.getElementById('login').addEventListener('click', async () => {
    console.log('Button clicked!');
  
    // สร้าง code_verifier แบบสุ่ม
    const codeVerifier = generateRandomString(128);
    localStorage.setItem('code_verifier', codeVerifier);
  
    // สร้าง code_challenge จาก code_verifier
    const codeChallenge = base64UrlEncode(await sha256(codeVerifier));
    document.cookie = `codeverifier=${codeVerifier}; path=/; secure=false; max-age=30000; httpOnly:true`;
    // สร้าง URL สำหรับการขอการอนุมัติ
    const authUrl = `${authorizationUrl}?` + new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: 'openid email profile',
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',   
      state: codeVerifier 
    });

    // เปลี่ยนหน้าต่างไปยัง URL การอนุมัติ 
    console.log(authUrl);
    window.location.href = authUrl;

  });
  