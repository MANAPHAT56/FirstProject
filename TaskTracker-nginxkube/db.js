// db.js
const path = require('path');  // เพิ่มบรรท
const mysql = require('mysql2');
// สร้าง connection pool
const pool = mysql.createPool({
  host:  process.env.myapp-env.MYSQL_HOST, // ชื่อ service ของ MySQL ใน docker-compose
  user: process.env.myapp-env.MYSQL_USER,
  password: process.env.myapp-env.MYSQL_ROOT_PASSWORD,
  database: process.env.myapp-env.MYSQL_DATABASE,
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
  
    // แสดงข้อมูลการเชื่อมต่อ (โดยไม่แสดง password)
    console.log('✅ Connected to MySQL successfully!');
    console.log('📌 Connection Details:', {
      host: pool.config.connectionConfig.host,
      user: pool.config.connectionConfig.user,
      database: pool.config.connectionConfig.database,
      port: pool.config.connectionConfig.port
    });
  
    connection.release();
  });

// ส่งออก pool เพื่อเอาไปใช้ query ในไฟล์อื่น ๆ
module.exports = pool;
