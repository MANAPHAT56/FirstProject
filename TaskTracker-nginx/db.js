// db.js
const mysql = require('mysql2');

// สร้าง connection pool
const pool = mysql.createPool({
  host: 'mysql-container', // ชื่อ service ของ MySQL ใน docker-compose
  user: 'root',
  password: 'mypassword',
  database: 'my_db',
  port: 3306,
  waitForConnections: true,
  connectionLimit: 10,   // จำนวน connection สูงสุดใน pool
  queueLimit: 0          // ไม่จำกัดจำนวน queue ที่รอ connection
});

// ทดสอบการเชื่อมต่อทันทีเมื่อไฟล์นี้ถูกรัน
pool.getConnection((err, connection) => {
  if (err) {
    console.error('Error connecting to MySQL:', err.stack);
    return;
  }
  console.log('Connected to MySQL successfully');
  connection.release(); // ปล่อย connection กลับไปใน pool
});

// ส่งออก pool เพื่อเอาไปใช้ query ในไฟล์อื่น ๆ
module.exports = pool;
