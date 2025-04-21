// // ฟังก์ชันเพื่อส่งคำขอรีเฟรช Token ไปที่เซิร์ฟเวอร์
// import axios from 'axios'
// async function refreshAccessToken() {
//     try {
//       const response = await axios.get('/refresh-token', { withCredentials: true });  // ใช้ withCredentials เพื่อส่ง Cookie
//       if (response.status === 200) {
//         const newToken = response.data.accessToken;
//         console.log('Access token refreshed:', newToken);
//         window.location.reload();  // รีเฟรชหน้าใหม่หลังจากรีเฟรช Token
//       }else{
//         console.log("kuy");
//       }
//     } catch (err) {
//       console.error('Error refreshing token', err);
//       window.location.href = '/login';  // หากไม่สามารถรีเฟรช Token ได้
//     }
//   }
  
//   // ตรวจสอบ Token เมื่อโหลดหน้า
//   window.onload = () => {
//     refreshAccessToken();  // ตรวจสอบการรีเฟรช Token หากจำเป็น
//   };
  
//   // ตรวจสอบการหมดอายุของ Access Token เมื่อเปลี่ยนเส้นทาง
//   window.addEventListener('popstate', refreshAccessToken);
//   window.addEventListener('hashchange', refreshAccessToken);
  