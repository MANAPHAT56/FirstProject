const path = require("path");
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require('jsonwebtoken');
const util = require('util'); // Still needed for promisify
// const axios = require('axios'); // Not used in this file, can be removed if not needed elsewhere

// **Router ถูก export เป็นฟังก์ชันที่รับ 'pool' และ 'client' ที่ถูก initialize แล้ว**
module.exports = (pool, client) => { // <-- **สำคัญมาก! รับ pool และ client ที่นี่**
    const router = express.Router(); // สร้าง router instance ภายในฟังก์ชันนี้

    // secretKey ควรจะถูกโหลดจาก .env
    // หากคุณมี SECRET_KEY ใน .env ให้ใช้ process.env.SECRET_KEY
    const secretKey = process.env.JWT_SECRET || "your-fallback-secret-key"; 

    // Promisify pool.query directly now that 'pool' is available
    // Note: If you're using 'mysql2/promise', pool.query is already promise-based.
    // So, `await pool.query(...)` can be used directly.
    // If you prefer the `query(...)` alias, this line is fine:
    const query = util.promisify(pool.query).bind(pool);

    // --- JWT Authentication Middleware ---
    const authenticateJWT = (req, res, next) => {
        const token = req.cookies.token || req.headers.authorization?.split(' ')[1];
        const refreshToken = req.cookies.refreshToken;

        if (!token && !refreshToken) {
            return res.redirect('/login');
        }

        const verifyAndHandleToken = (current_token, isRefreshToken = false) => {
            jwt.verify(current_token, secretKey, (err, user) => {
                if (err) {
                    if (!isRefreshToken && refreshToken) {
                        return verifyAndHandleToken(refreshToken, true);
                    }
                    return res.redirect('/login');
                }

                if (isRefreshToken) {
                    const { username, id } = user;
                    const newToken = jwt.sign({ username, id }, secretKey, { expiresIn: '1m' });
                    res.cookie('token', newToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'Lax', maxAge: 300000 });
                }
                req.user = user;
                next();
            });
        };
        verifyAndHandleToken(token);
    };

    // --- Route Definitions ---

    router.get("/coupons", authenticateJWT, async (req, res, next) => {
        try {
            // client is now available directly from the function parameter
            const coupons = await client.get("coupons"); 

            if (coupons) {
                return res.render('../view/Coupons.ejs', { stores: JSON.parse(coupons) });
            } else {
                // Use pool.query directly, or the 'query' alias if you prefer
                const [results] = await pool.query(`SELECT * FROM stores`); 
                await client.setEx('coupons', 3600, JSON.stringify(results)); 
                return res.render('../view/Coupons.ejs', { stores: results });
            }
        } catch (err) {
            console.error('Error in /coupons:', err);
            next(err);
        }
    });

    router.get('/store/:id', async (req, res, next) => {
        const storeId = req.params.id;
        try {
            const [results] = await pool.query('SELECT * FROM coupons WHERE storesid = ?', [storeId]);
            res.render('store', { coupons: results });
        } catch (error) {
            console.error('Error in /store/:id:', error);
            next(error);
        }
    });

    router.post('/coupon/:id', authenticateJWT, async (req, res, next) => {
        const couponId = req.params.id;
        try {
            const [couponResults] = await pool.query('SELECT * FROM coupons WHERE id = ?', [couponId]);
            if (couponResults.length === 0) {
                return res.status(404).send('Coupon not found');
            }

            const storeId = couponResults[0].storesid;
            const [storeResults] = await pool.query('SELECT name FROM stores WHERE id = ?', [storeId]);
            if (storeResults.length === 0) {
                return res.status(404).send('Store not found for this coupon');
            }

            res.render('../view/coupondetail.ejs', {
                coupondt: couponResults,
                storeName: storeResults[0].name
            });
        } catch (err) {
            console.error('Error in /coupon/:id:', err);
            next(err);
        }
    });

    router.post('/couponafter/:id', authenticateJWT, async (req, res, next) => {
        const couponId = req.params.id;
        try {
            const [couponResults] = await pool.query('SELECT * FROM coupons WHERE id = ?', [couponId]);
            if (couponResults.length === 0) {
                return res.status(404).send('Coupon not found');
            }

            const storeId = couponResults[0].storesid;
            const [storeResults] = await pool.query('SELECT name FROM stores WHERE id = ?', [storeId]);
            if (storeResults.length === 0) {
                return res.status(404).send('Store not found for this coupon');
            }

            res.render('../view/coupondtafter.ejs', {
                coupondt: couponResults,
                storeName: storeResults[0].name
            });
        } catch (err) {
            console.error('Error in /couponafter/:id:', err);
            next(err);
        }
    });

    router.post('/redeem-coupon', authenticateJWT, async (req, res, next) => {
        try {
            const { couponId, couponImg, couponName } = req.body;
            const username = req.user.username;
            const userId = req.user.id;

            const [couponResults] = await pool.query(`SELECT P_required FROM coupons WHERE id = ?`, [couponId]);
            const pointRequired = couponResults[0]?.P_required;
            if (pointRequired === undefined) {
                return res.status(404).json({ error: "Coupon not found or point requirement not defined." });
            }

            const [userResults] = await pool.query(`SELECT point FROM user WHERE id = ?`, [userId]);
            const userPoint = userResults[0]?.point;
            if (userPoint === undefined) {
                return res.status(404).json({ error: "User not found." });
            }
            if (userPoint < pointRequired) {
                return res.status(400).json({ error: "Your point is not enough" });
            }

            const newPoint = userPoint - pointRequired;
            await pool.query(`UPDATE user SET point = ? WHERE id = ?`, [newPoint, userId]);

            await pool.query(`INSERT INTO \`${username}\` (name, couponid, img) VALUES (?, ?, ?)`,
                [couponName, couponId, couponImg]
            );

            await client.del('point');
            await client.del('users');

            return res.status(200).json({ message: "Exchange Coupon SUCCESSFUL" });

        } catch (err) {
            console.error('Error in /redeem-coupon:', err);
            next(err);
        }
    });

    router.post('/usecoupon/:id', authenticateJWT, async (req, res, next) => {
        const id = req.params.id;
        const userName = req.user.username;

        try {
            const [results] = await pool.query(`SELECT ExpiredAt FROM \`${userName}\` WHERE id = ?`, [id]);

            let expireAt;
            if (results.length === 0) {
                return res.status(404).send('Coupon not found in your collection.');
            }

            if (results[0].ExpiredAt) {
                expireAt = results[0].ExpiredAt;
            } else {
                expireAt = new Date(Date.now() + 3 * 60 * 1000);
            }

            const updateQuery = `UPDATE \`${userName}\` SET ExpiredAt = ?, Active = 'yes' WHERE id = ?`;
            await pool.query(updateQuery, [expireAt, id]);

            await client.del('users');

            res.render('qrcoupon', { couponId: id, expireAt });
        } catch (err) {
            console.error('Error in /usecoupon/:id:', err);
            next(err);
        }
    });

    router.post('/deletecoupon/:id', authenticateJWT, async (req, res, next) => {
        const couponId = req.params.id;
        const userName = req.user.username;

        try {
            const deleteQuery = `DELETE FROM \`${userName}\` WHERE id = ?`;
            const [results] = await pool.query(deleteQuery, [couponId]);

            if (results.affectedRows === 0) {
                return res.status(404).json({ error: 'Coupon not found in your collection.' });
            }

            await client.del('users');

            return res.redirect('/tasks');
        } catch (err) {
            console.error('Error in /deletecoupon/:id:', err);
            next(err);
        }
    });

    return router; // **ต้อง return router กลับไป**
};