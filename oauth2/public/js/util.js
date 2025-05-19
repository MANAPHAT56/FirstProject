// // utils.js

// // สร้างสตริงแบบสุ่มสำหรับใช้เป็น code_verifier
// export function generateRandomString(length) {
//     const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
//     let result = '';
//     const randomValues = new Uint8Array(length);
//     crypto.getRandomValues(randomValues);
//     randomValues.forEach((value) => {
//       result += charset[value % charset.length];
//     });
//     return result;
//   }
  
//   // ฟังก์ชัน SHA-256
//   export async function sha256(plain) {
//     const encoder = new TextEncoder();
//     const data = encoder.encode(plain);
//     const hash = await crypto.subtle.digest('SHA-256', data);
//     return new Uint8Array(hash);
//   }
  
//   // แปลงจาก ArrayBuffer เป็น base64 URL
//   export function base64UrlEncode(arrayBuffer) {
//     const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
//     return base64.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
//   }
  