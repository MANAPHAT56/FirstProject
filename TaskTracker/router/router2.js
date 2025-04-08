  const path = require("path");
  const express=require("express");
  const router=express.Router();
  const connection  = require('../db.js');
  const client= require("../redis.js");
  const bcrypt=require("bcryptjs");
  const jwt = require('jsonwebtoken');
  const secretKey = "your-secret-key";
  const axios = require('axios');
  const querystring = require('querystring');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const CryptoJS = require("crypto-js");
const authenticateJWT = (req, res, next) => {
  const token = req.cookies.token || req.headers.authorization?.split(' ')[1];
  const refreshToken = req.cookies.refreshToken;

  if (!token) {
    // ตรวจสอบ refresh token หากไม่มี access token
    if (refreshToken) {
      return jwt.verify(refreshToken, secretKey, (err, user) => {
        if (err) {
          console.error('Invalid refresh token:', err);
          return res.redirect('/login');
        }

        // สร้าง access token ใหม่
        const { username, id } = user;
        const newToken = jwt.sign({ username, id }, secretKey, { expiresIn: '1m' });

        // ตั้งค่า cookie ใหม่
        res.cookie('token', newToken, { httpOnly: true, secure: false, sameSite: 'Strict', maxAge: 300000 });
        req.user = user;

        return next(); // ดำเนินการต่อ
      });
    } else {
      return res.redirect('/login');
    }
  }

  // ตรวจสอบ access token
  jwt.verify(token, secretKey, (err, user) => {
    if (err) {
      console.error('Invalid access token:', err);
      if (refreshToken) {
        return jwt.verify(refreshToken, secretKey, (err, user) => {
          if (err) {
            console.error('Invalid refresh token:', err);
            return res.redirect('/login');
          }
          // สร้าง access token ใหม่
          const { username, id } = user;
          const newToken = jwt.sign({ username, id }, secretKey, { expiresIn: '1m' });

          // ตั้งค่า cookie ใหม่
          res.cookie('token', newToken, { httpOnly: true, secure: false, sameSite: 'Strict', maxAge: 300000 });
          req.user = user;

          return next(); // ดำเนินการต่อ
        });
      } else {
        return res.redirect('/login');
      }
    }

    // หาก access token ถูกต้อง
    req.user = user;
    console.log(req.user);
    next();
  });
};
router.get("/coupons",authenticateJWT,async (req,res,next)=>{
  const coupons= await client.get("coupons")
  if(!coupons){
    connection.query(`SELECT * FROM stores`, (err, results) => {
      if (err) {
        console.log("ejrttj");
          return res.redirect('/login'); // Handle errors;
      }
      // Render the EJS template with the data
      client.setEx('coupons', 3600, JSON.stringify(results));
      console.log(results);
      console.log("KUY");
      res.render('../view/Coupons.ejs', { stores: results });
  });
  }else{
    console.log("hi");
    res.render('../view/Coupons.ejs', { stores: JSON.parse(coupons) });
  }
    });
router.get('/store/:id', async (req, res) => {
      const storeId = req.params.id; // ดึง id จาก URL
      try {
          // ค้นหาข้อมูลร้านค้าจากฐานข้อมูล
          connection.query('SELECT * FROM coupons WHERE storesid = ?;', [storeId], async (err, results) =>{
            if (results.length === 0) {
              res.render('store', { coupons: results });
          }
  
          // ส่งข้อมูลไปที่หน้า EJS
          res.render('store', { coupons: results });
          });
      } catch (error) {
          console.error(error);
          res.status(500).send('Internal Server Error');
      }
  });
  router.post('/coupon/:id',authenticateJWT, (req, res) => {
    const couponId = req.params.id;

    try {
        // ค้นหาข้อมูลคูปอง
        connection.query('SELECT * FROM coupons WHERE id = ?', [couponId], (err, couponResults) => {
            if (err) {
                console.error(err);
                return res.status(500).send('Database error');
            }
            if (couponResults.length === 0) {
                return res.status(404).send('Coupon not found');
            }

            // ดึงค่า storeId จากคูปอง
            const storeId = couponResults[0].storesid;

            // ค้นหาชื่อร้านค้าจาก storeId
            connection.query('SELECT name FROM stores WHERE id = ?', [storeId], (err, storeResults) => {
                if (err) {
                    console.error(err);
                    return res.status(500).send('Database error');
                }
                if (storeResults.length === 0) {
                    return res.status(404).send('Store not found');
                }

                // ส่งข้อมูลไปที่หน้า EJS
                res.render('../view/coupondetail.ejs', { 
                    coupondt: couponResults, // ข้อมูลคูปอง
                    storeName: storeResults[0].name // ชื่อร้านค้า
                });
            });
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
});
router.post('/couponafter/:id',authenticateJWT, (req, res) => {
  const couponId = req.params.id;

  try {
      // ค้นหาข้อมูลคูปอง
      connection.query('SELECT * FROM coupons WHERE id = ?', [couponId], (err, couponResults) => {
          if (err) {
              console.error(err);
              return res.status(500).send('Database error');
          }
          if (couponResults.length === 0) {
              return res.status(404).send('Coupon not found');
          }

          // ดึงค่า storeId จากคูปอง
          const storeId = couponResults[0].storesid;

          // ค้นหาชื่อร้านค้าจาก storeId
          connection.query('SELECT name FROM stores WHERE id = ?', [storeId], (err, storeResults) => {
              if (err) {
                  console.error(err);
                  return res.status(500).send('Database error');
              }
              if (storeResults.length === 0) {
                  return res.status(404).send('Store not found');
              }
              // ส่งข้อมูลไปที่หน้า EJS
              res.render('../view/coupondtafter.ejs', { 
                  coupondt: couponResults, // ข้อมูลคูปอง
                  storeName: storeResults[0].name // ชื่อร้านค้า
              });
          });
      });
  } catch (error) {
      console.error(error);
      res.status(500).send('Internal Server Error');
  }
});
router.post('/redeem-coupon',authenticateJWT,async (req,res)=>{
  // const datauser=await client.get('users');
  // const datauser1=JSON.parse(datauser);
  // if(datauser1[0].point<=)
   const { couponId, couponImg, couponName } = req.body;
  connection.query(`SELECT P_required FROM coupons WHERE id=?;`, [couponId], (err, results) => {
    if (err) {
      console.error('Error inserting task:', err);
        return res.status(500).send('Error adding task');
    }else{
    const pointcoupon=results[0].P_required;
    console.log(results);
    console.log(pointcoupon+5);
  connection.query(`SELECT point FROM user WHERE name=?;`, [req.user.username], (err, resultsuser) => {
    if (err) {
      console.error('Error inserting task:', err);
        return res.status(500).send('Error adding task');
    }else{
    console.log(resultsuser)
    console.log(resultsuser[0].point-pointcoupon);
    if(resultsuser[0].point<pointcoupon){
      return  res.status(400).json({ error: "Your point is not enough " });
    }else{
      console.log(req.user.id)
      let afterpoint= resultsuser[0].point-pointcoupon;
      client.del('point', (err, response) => {
        if (err) {
            console.log('Error deleting key:', err);
        } else {
            console.log("Key deleted successfully:", response);
        }
    });
      connection.query('UPDATE user SET point = ? WHERE id = ?;',[afterpoint,req.user.id],(err,results)=>{
        if(err){
          console.log(err); 
          return res.redirect('/login');
        }
          else{
           
   connection.query(`INSERT INTO  \`${req.user.username}\` (name,couponid,img) VALUES (?,?,?)`, [couponName,couponId,couponImg], (err, results) => {
    if (err) {
      console.error('Error inserting task:', err);
        return res.status(500).send('Error adding task');
    }
    client.del('users', (err, response) => {
      if (err) {
          console.log('Error deleting key:', err);
      } else {
          console.log('Key deleted successfully:', response);
      }
  });
  return res.status(200).json({message:"Exchange Coupon SUCCESSFUL"});
});
          }
      });
    }
  }
});
}});
});
router.post('/usecouponja/:id',authenticateJWT,async(req,res)=>{
  console.log("**********");
  const id = req.params.id;
  const userName = req.user.username;
  connection.query(`SELECT ExpiredAt FROM \`${userName}\` WHERE id = ?`, [id], (err, results) => {
      if (err) {
          console.error(err);
          return res.status(500).send('Database error');
      }
  
      let expireAt;
      console.log(results[0].expireAt+"fmmmf");
      console.log("**********");
      if (results.length === 0 || !results[0].expiredAt) {
          // ❗ยังไม่มี expiredAt: กำหนดใหม่ + update เข้า DB
          expireAt = new Date(Date.now() + 3 * 60 * 1000); // 3 นาที
          console.log(expireAt);
          const updateQuery = `UPDATE \`${userName}\` SET ExpiredAt = ?, Active = 'yes' WHERE id = ?`;
          connection.query(updateQuery, [expireAt, id], (err2, result2) => {
              if (err2) {
                  console.error(err2);
                  return res.status(500).send('Update error');
              }
              // ลบ key redis
              client.del('users', (err3, response) => {
                  if (err3) console.log("Redis error", err3);
                  else console.log("Key deleted:", response);
              });
                console.log(result2);
              res.render('qrcoupon', { couponId: id, expireAt });
          });
      } else {
          // ❗มี expiredAt แล้ว
          expireAt = results[0].expiredAt;
          console.log(expireAt+"    c2");
          const updateQuery =  `UPDATE \`${userName}\` SET ExpiredAt = ?, Active = 'yes' WHERE id = ?`;
          connection.query(updateQuery, [expireAt,id], (err2, result2) => {
              if (err2) {
                  console.error(err2);
                  return res.status(500).send('Update error');
              }
  
              client.del('users', (err3, response) => {
                  if (err3) console.log("Redis error", err3);
                  else console.log("Key deleted:", response);
              });
               console.log(results2+"brhr");
              res.render('qrcoupon', { couponId: id, expireAt });
          });
      }
  });
  
  });
router.post('/deletecoupon/:id', authenticateJWT, async (req, res) => {
  const couponId = req.params.id;
  const userName = req.user.username;
  // คำสั่ง SQL เพื่อลบคูปองที่หมดอายุ
  const deleteQuery = `DELETE FROM \`${userName}\` WHERE id = ${couponId}`;
  connection.query(deleteQuery, (err, results) => {
      if (err) {
          return res.status(500).json({ error: 'เกิดข้อผิดพลาดในการลบคูปอง.' });
      }
      // ล้างข้อมูลใน Cache (ถ้าจำเป็น)
      client.del('users', (err, response) => {
          if (err) {
              console.log('Error deleting key:', err);
          } else {
              console.log("Key deleted successfully:", response);
          }
      });
      // ส่งคำตอบกลับไปยังฝั่ง Client
      return res.redirect('/tasks');
  });
});
module.exports = router;