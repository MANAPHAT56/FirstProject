// db.js
const mysql = require('mysql2/promise');
const path = require('path');
const { getDBCreds } = require('./vault'); // ยังคง require เหมือนเดิม

// ตรวจสอบให้แน่ใจว่า dotenv โหลดถูกต้องสำหรับไฟล์นี้
require('dotenv').config({ path: path.resolve(__dirname, './vaults/file_secrets/config.env') });

let pool; // กำหนด pool เป็น null เริ่มต้น

async function initializePool() {
    // ตรวจสอบว่า pool ได้ถูก initialized ไปแล้วหรือไม่
    if (pool) {
        console.log('Database pool already initialized.');
        return;
    }

    try {
        // 1. ดึงข้อมูล credential จาก Vault แบบ Asynchronous
        const creds = await getDBCreds(); // <--- ต้อง await ตรงนี้!

        // 2. กำหนดค่าสำหรับ pool โดยใช้ข้อมูลจาก Vault และ .env
        const dbConfig = {
            host: process.env.DB_HOST, // ควรมีอยู่ใน config.env หรือ .env หลัก
            user: creds.user,          // ได้จาก Vault
            password: creds.pass,      // ได้จาก Vault
            database: process.env.DB_MYDB, // ควรมีอยู่ใน config.env หรือ .env หลัก
            port: 3306,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0
        };

        // 3. สร้าง Connection Pool
        pool = mysql.createPool(dbConfig);

        // 4. ทดสอบการเชื่อมต่อ
        // สำหรับ mysql2/promise, pool.getConnection() ก็เป็น async/await ได้
        const connection = await pool.getConnection();
        connection.release(); // คืน connection ทันทีหลังจากทดสอบ

        console.log('✅ Connected to MySQL successfully!');
        console.log('📌 Connection Details:', {
            host: dbConfig.host,
            user: dbConfig.user,
            database: dbConfig.database,
            port: dbConfig.port
        });

    } catch (err) {
        console.error('❌ Failed to initialize MySQL Pool:', err.message);
        // แสดงข้อมูล Creds ที่พยายามใช้ (ไม่ควรแสดง password ใน log production)
        // console.error('Attempted creds:', { user: creds ? creds.user : 'N/A' });
        throw err; // โยน Error เพื่อให้ app.js จับได้
    }
}

function getPool() {
    if (!pool) {
        throw new Error('Database pool has not been initialized. Call initializePool() first in your main application file (e.g., app.js) before requiring modules that depend on it.');
    }
    return pool;
}

module.exports = {
    initializePool,
    getPool
};