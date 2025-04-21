// // db.js
// const mysql = require('mysql2');

// const connection = mysql.createConnection({
//   host: 'localhost',
//   user: 'root',
//   database: 'my_db',
//   port: '3306'// รหัสผ่าน MySQL
// });
// connection.connect(err => {
//   if (err) {
//     console.error('Error connecting to MySQL:', err.stack);
//     return;
//   }
//   console.log('Connected to MySQL as id ' + connection.threadId);
// });

// module.exports = connection;
const mysql = require('mysql2');

const pool = mysql.createPool({
  host: 'mysql-service',
  password: 'mypassword',
  // host: 'localhost',
  user: 'root',
  database: 'my_db',
  port: 3306,
  waitForConnections: true,
  connectionLimit: 10, // กำหนดจำนวน connection สูงสุด
  queueLimit: 0,
});

pool.getConnection((err, connection) => {
  if (err) {
    console.error('Error connecting to MySQL:', err.stack);
    return;
  }
  console.log('Connected to MySQL');
  connection.release(); // ปล่อย connection กลับไปที่ pool
});

module.exports = pool;
