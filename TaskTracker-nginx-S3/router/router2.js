const path = require("path");
const express = require("express");
const router = express.Router();
const connection = require('../db.js');
const client = require("../redis.js");
const bcrypt = require("bcryptjs");
const jwt = require('jsonwebtoken');
const secretKey = "your-secret-key";
const axios = require('axios');
const util = require('util');
const query = util.promisify(connection.query).bind(connection);

const authenticateJWT = (req, res, next) => {
  const token = req.cookies.token || req.headers.authorization?.split(' ')[1];
  const refreshToken = req.cookies.refreshToken;

  if (!token) {
    if (refreshToken) {
      return jwt.verify(refreshToken, secretKey, (err, user) => {
        if (err) {
          return res.redirect('/login');
        }
        const { username, id } = user;
        const newToken = jwt.sign({ username, id }, secretKey, { expiresIn: '1m' });
        res.cookie('token', newToken, { httpOnly: true, secure: false, sameSite: 'Strict', maxAge: 300000 });
        req.user = user;
        return next();
      });
    } else {
      return res.redirect('/login');
    }
  }

  jwt.verify(token, secretKey, (err, user) => {
    if (err) {
      if (refreshToken) {
        return jwt.verify(refreshToken, secretKey, (err, user) => {
          if (err) {
            return res.redirect('/login');
          }
          const { username, id } = user;
          const newToken = jwt.sign({ username, id }, secretKey, { expiresIn: '1m' });
          res.cookie('token', newToken, { httpOnly: true, secure: false, sameSite: 'Strict', maxAge: 300000 });
          req.user = user;
          return next();
        });
      } else {
        return res.redirect('/login');
      }
    }
    req.user = user;
    next();
  });
};

router.get("/coupons", authenticateJWT, async (req, res, next) => {
  const coupons = await client.get("coupons");
  if (!coupons) {
    connection.query(`SELECT * FROM stores`, (err, results) => {
      if (err) return res.redirect('/login');
      client.setEx('coupons', 3600, JSON.stringify(results));
      res.render('../view/Coupons.ejs', { stores: results });
    });
  } else {
    res.render('../view/Coupons.ejs', { stores: JSON.parse(coupons) });
  }
});

router.get('/store/:id', async (req, res) => {
  const storeId = req.params.id;
  try {
    const results = await query('SELECT * FROM coupons WHERE storesid = ?', [storeId]);
    res.render('store', { coupons: results });
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});


router.post('/coupon/:id', authenticateJWT, (req, res) => {
  const couponId = req.params.id;
    connection.query('SELECT * FROM coupons WHERE id = ?', [couponId], (err, couponResults) => {
      if (err || couponResults.length === 0) return res.status(500).send('Database error');
      const storeId = couponResults[0].storesid;
      connection.query('SELECT name FROM stores WHERE id = ?', [storeId], (err, storeResults) => {
        if (err || storeResults.length === 0) return res.status(500).send('Database error');
        res.render('../view/coupondetail.ejs', {
          coupondt: couponResults,
          storeName: storeResults[0].name
        });
      });
    });

});

router.post('/couponafter/:id', authenticateJWT, (req, res) => {
  const couponId = req.params.id;

    connection.query('SELECT * FROM coupons WHERE id = ?', [couponId], (err, couponResults) => {
      if (err || couponResults.length === 0) return res.status(500).send('Database error');
      const storeId = couponResults[0].storesid;
      connection.query('SELECT name FROM stores WHERE id = ?', [storeId], (err, storeResults) => {
        if (err || storeResults.length === 0) return res.status(500).send('Database error');
        res.render('../view/coupondtafter.ejs', {
          coupondt: couponResults,
          storeName: storeResults[0].name
        });
      });
    });
});

router.post('/redeem-coupon', authenticateJWT, async (req, res) => {
  try {
    const { couponId, couponImg, couponName } = req.body;

    // 1. ดึงข้อมูล coupon
    const couponResults = await query(`SELECT P_required FROM coupons WHERE id = ?`, [couponId]);
    const pointRequired = couponResults[0]?.P_required;
    if (!pointRequired) return res.status(400).send('Coupon not found');

    // 2. ดึง point ของผู้ใช้
    const userResults = await query(`SELECT point FROM user WHERE name = ?`, [req.user.username]);
    const userPoint = userResults[0]?.point;
    if (userPoint === undefined) return res.status(404).send('User not found');
    if (userPoint < pointRequired) return res.status(400).json({ error: "Your point is not enough" });

    const newPoint = userPoint - pointRequired;

    // 3. ล้างแคช
    client.del('point');

    // 4. อัปเดต point
    await query(`UPDATE user SET point = ? WHERE id = ?`, [newPoint, req.user.id]);

    // 5. เพิ่มข้อมูล coupon ที่แลกในตารางของผู้ใช้
    await query(`INSERT INTO \`${req.user.username}\` (name, couponid, img) VALUES (?, ?, ?)`,
      [couponName, couponId, couponImg]
    );

    client.del('users');

    return res.status(200).json({ message: "Exchange Coupon SUCCESSFUL" });

  } catch (err) {
    console.error(err);
    return res.status(500).send('Internal server error');
  }
});

router.post('/usecoupon/:id', authenticateJWT, async (req, res) => {
  const id = req.params.id;
  const userName = req.user.username;
  let expireAt;
  connection.query(`SELECT ExpiredAt FROM \`${userName}\` WHERE id = ?`, [id], (err, results) => {
    if (err) return res.status(500).send('Database error');
    if (results.length === 0 || !results[0].ExpiredAt) {
      expireAt = new Date(Date.now() + 3 * 60 * 1000);
      const updateQuery = `UPDATE \`${userName}\` SET ExpiredAt = ?, Active = 'yes' WHERE id = ?`;
      connection.query(updateQuery, [expireAt, id], (err2, result2) => {
        if (err2) return res.status(500).send('Update error');
        client.del('users');
        res.render('qrcoupon', { couponId: id, expireAt });
      });
    } else {
      expireAt = results[0].ExpiredAt;
      const updateQuery = `UPDATE \`${userName}\` SET ExpiredAt = ?, Active = 'yes' WHERE id = ?`;
      connection.query(updateQuery, [expireAt, id], (err2, result2) => {
        if (err2) return res.status(500).send('Update error');
        client.del('users');
        res.render('qrcoupon', { couponId: id, expireAt });
      });
    }
  });
});

router.post('/deletecoupon/:id', authenticateJWT, async (req, res) => {
  const couponId = req.params.id;
  const userName = req.user.username;
  const deleteQuery = `DELETE FROM \`${userName}\` WHERE id = ${couponId}`;
  connection.query(deleteQuery, (err, results) => {
    if (err) return res.status(500).json({ error: 'เกิดข้อผิดพลาดในการลบคูปอง.' });
    client.del('users');
    return res.redirect('/tasks');
  });
});

module.exports = router;
