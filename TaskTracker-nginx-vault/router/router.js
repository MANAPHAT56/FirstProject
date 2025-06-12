const path = require("path");
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require('jsonwebtoken');
const querystring = require('querystring');
const axios = require('axios'); // เพิ่ม axios import ที่ขาดหายไป
const CryptoJS = require("crypto-js");
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

// Helper functions for AES encryption/decryption
const encryptAES = (plainText) => {
    return CryptoJS.AES.encrypt(plainText, process.env.SECRET_KEY ).toString();
};

const decryptAES = (cipherText) => {
    const bytes = CryptoJS.AES.decrypt(cipherText, process.env.SECRET_KEY);
    return bytes.toString(CryptoJS.enc.Utf8);
};

// **เปลี่ยนการ export ให้เป็นฟังก์ชันที่รับ databaseService แทน pool และ client**
module.exports = (pool,client) => {
    const router = express.Router();

    // ดึง pool และ client จาก databaseService
    const secretKey = process.env.JWT_SECRET || "your-fallback-secret-key";

    // --- JWT Authentication Middleware ---
    const authenticateJWT = (req, res, next) => {
        const token = req.cookies.token || req.headers.authorization?.split(' ')[1];
        const refreshToken = req.cookies.refreshToken;

        if (!token) {
            if (refreshToken) {
                return jwt.verify(refreshToken, secretKey, (err, user) => {
                    if (err) {
                        console.error('Invalid refresh token:', err);
                        return res.redirect('/login');
                    }
                    const { username, id } = user;
                    const newToken = jwt.sign({ username, id }, secretKey, { expiresIn: '1m' });
                    res.cookie('token', newToken, { 
                        httpOnly: true, 
                        secure: process.env.NODE_ENV === 'production', 
                        sameSite: 'Lax', 
                        maxAge: 300000 
                    });
                    req.user = user;
                    return next();
                });
            } else {
                return res.redirect('/login');
            }
        }

        jwt.verify(token, secretKey, (err, user) => {
            if (err) {
                console.error('Invalid access token:', err);
                if (refreshToken) {
                    return jwt.verify(refreshToken, secretKey, (err, user) => {
                        if (err) {
                            console.error('Invalid refresh token:', err);
                            return res.redirect('/login');
                        }
                        const { username, id } = user;
                        const newToken = jwt.sign({ username, id }, secretKey, { expiresIn: '1m' });
                        res.cookie('token', newToken, { 
                            httpOnly: true, 
                            secure: process.env.NODE_ENV === 'production', 
                            sameSite: 'Lax', 
                            maxAge: 300000 
                        });
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

    // --- Helper Functions ---
    const createTable = async (tableName) => {
        try {
            const createTableQuery = `
                CREATE TABLE IF NOT EXISTS \`${tableName}\` (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    name VARCHAR(100) NOT NULL,
                    img VARCHAR(255),
                    Active VARCHAR(10),
                    ExpiredAt DATETIME,
                    couponid INT
                );
            `;
            const result = await pool.query(createTableQuery);
            console.log(`Table \`${tableName}\` created successfully.`);
            return result;
        } catch (err) {
            console.error('Error creating table:', err);
            throw err;
        }
    };

    const createTableoauth2 = async (tableName) => {
        try {
            const createTableQuery = `
                CREATE TABLE IF NOT EXISTS \`${tableName}\` (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    img VARCHAR(255),
                    Active VARCHAR(10),
                    ExpiredAt DATETIME,
                    couponid INT
                );
            `;
            const result = await pool.query(createTableQuery);
            console.log(`Table \`${tableName}\` (OAuth) created successfully.`);
            return result;
        } catch (err) {
            console.error('Error creating OAuth table:', err);
            throw err;
        }
    };

    async function hashPassword(password) {
        try {
            const hashedPassword1 = await bcrypt.hash(password, 10);
            return hashedPassword1;
        } catch (err) {
            throw new Error('Error hashing password: ' + err.message);
        }
    }

    const rewards = ['Reward A', 'Reward B', 'Reward C'];
    const Events = ['Event X', 'Event Y', 'Event Z'];

    // --- Routes ---
// เพิ่มใน app.js
router.get('/debug/credentials', async (req, res) => {
  const status = pool.getCredentialStatus();
  res.json(status);
});
router.get('/typeshi', async (req, res) => {
    let tableName = "admin";
  const status = await pool.query('SELECT * FROM user WHERE name = ?', [tableName])
  res.json(status);
});

router.post('/debug/refresh', async (req, res) => {
  try {
    await pool.forceRefresh();
    res.json({ success: true, message: 'Credentials refreshed successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
    router.get('/auth/google/callback', (req, res) => {
        res.render('../view/goologin.ejs');
    });

    router.post('/auth/google/callback', async (req, res, next) => {
        try {
            await client.del('users');
            console.log('Key "users" deleted successfully from Redis.');

            const { code, codeVerifier } = req.body;
            if (!codeVerifier) return res.status(400).send('Missing code_verifier');

            const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', querystring.stringify({
                code: code,
                client_id: process.env.GOOGLE_CLIENT_ID,
                client_secret: process.env.GOOGLE_CLIENT_SECRET,
                redirect_uri: process.env.GOOGLE_CALLBACK_URL,
                grant_type: 'authorization_code',
                code_verifier: codeVerifier
            }), {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
            });

            const { access_token } = tokenResponse.data;

            const userInfo = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: { Authorization: `Bearer ${access_token}` }
            });

            const username = userInfo.data.sub;
            const id = userInfo.data.sub;

            const userInfojwt = jwt.sign({ username, id }, secretKey, { expiresIn: '1m' });
            res.cookie('user', userInfojwt, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                maxAge: 3600000,
                sameSite: 'Lax'
            });

            res.status(200).json({ success: true });
        } catch (err) {
            console.error('Error during Google OAuth callback:', err);
            next(err);
        }
    });

    router.get('/dashboard', async (req, res, next) => {
        try {
            const token = req.cookies.user;
            if (!token) return res.redirect('/login');

            let user;
            try {
                user = jwt.verify(token, secretKey);
            } catch (jwtErr) {
                console.error('Invalid user token:', jwtErr);
                return res.redirect('/login');
            }

            const tableName = user.username;
            const results = await pool.query('SELECT * FROM user WHERE name = ?', [tableName]);

            if (results.length === 1) {
                const newToken = jwt.sign(
                    { username: results[0].name, id: results[0].id },
                    secretKey,
                    { expiresIn: '1m' }
                );

                const refreshToken = jwt.sign(
                    { username: results[0].name, id: results[0].id },
                    secretKey,
                    { expiresIn: '7d' }
                );

                res.cookie('token', newToken, {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === 'production',
                    maxAge: 300000,
                    sameSite: 'Lax'
                });

                res.cookie('refreshToken', refreshToken, {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === 'production',
                    maxAge: 604800000,
                    sameSite: 'Lax'
                });

                return res.redirect('/tasks');
            } else {
                const insertResult = await pool.query('INSERT INTO user (name, point) VALUES (?, ?)', [tableName, 0]);
                const newUserId = insertResult.insertId;
                await createTableoauth2(tableName);

                const newToken = jwt.sign(
                    { username: tableName, id: newUserId },
                    secretKey,
                    { expiresIn: '1m' }
                );

                const refreshToken = jwt.sign(
                    { username: tableName, id: newUserId },
                    secretKey,
                    { expiresIn: '7d' }
                );

                res.cookie('token', newToken, {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === 'production',
                    maxAge: 300000,
                    sameSite: 'Lax'
                });

                res.cookie('refreshToken', refreshToken, {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === 'production',
                    maxAge: 604800000,
                    sameSite: 'Lax'
                });

                return res.redirect('/tasks');
            }
        } catch (err) {
            console.error('Dashboard error:', err);
            next(err);
        }
    });

    router.get('/admin', authenticateJWT, async (req, res, next) => {
        try {
            if (!req.user || req.user.username !== "admin") {
                return res.redirect('/login');
            }
            const users = await pool.query('SELECT * FROM user');
            res.render('../view/user', { users, useroauths: [] });
        } catch (err) {
            next(err);
        }
    });

    router.post('/delete/:id', authenticateJWT, async (req, res, next) => {
        const userId = req.params.id;

        if (!userId) {
            return res.status(400).json({ error: "User ID is required" });
        }

        try {
            const userResults = await pool.query("SELECT name FROM user WHERE id = ?", [userId]);

            if (userResults.length === 0) {
                return res.redirect('/admin');
            }

            const userName = userResults[0].name;
            const deleteUserResult = await pool.query('DELETE FROM user WHERE id = ?', [userId]);

            if (deleteUserResult.affectedRows === 0) {
                return res.redirect('/admin');
            }

            const dropTableQuery = `DROP TABLE IF EXISTS \`${userName}\``;
            await pool.query(dropTableQuery);

            return res.redirect('/admin');
        } catch (err) {
            console.error('Error during user deletion process:', err);
            next(err);
        }
    });

    router.get('/', (req, res) => {
        res.render("../view/home.ejs");
    });

    router.get('/create', async (req, res) => {
        res.render('../view/create.ejs');
    });

    router.get('/logout', authenticateJWT, async (req, res, next) => {
        res.clearCookie('token');
        res.clearCookie('refreshToken');
        res.clearCookie('user');

        try {
            await client.del('users', 'point', 'nonactive');
            console.log('User-related Redis keys cleared.');
        } catch (err) {
            console.error('Error deleting user-related keys from Redis:', err);
            next(err);
        }
        res.redirect('/');
    });

    router.post('/create-table', async (req, res, next) => {
        const tableName = req.body.name;
        const password = await hashPassword(req.body.password);

        if (!tableName) {
            return res.status(400).send('Table name (username) is required.');
        }

        try {
            const userExists = await pool.query('SELECT name FROM user WHERE name = ?', [tableName]);

            if (userExists.length > 0) {
                return res.status(409).json({ message: "The name already exists" });
            }

            const insertUserResult = await pool.query('INSERT INTO user (name, password, point) VALUES (?, ?, ?)', [tableName, password, 0]);

            await createTable(tableName);

            res.clearCookie('token');
            res.clearCookie('refreshToken');

            return res.status(201).json({ message: "CREATING NEW ACCOUNT SUCCESSFUL" });
        } catch (err) {
            console.error('Error during user creation:', err);
            next(err);
        }
    });

    router.get('/login', async (req, res) => {
        res.render('../view/login.ejs');
    });

    router.get('/add-tasks', authenticateJWT, async (req, res, next) => {
        const userboy = req.user.username;
        let userPoints;

        try {
            const cachedPoint = await client.get('point');

            if (cachedPoint) {
                userPoints = JSON.parse(cachedPoint);
            } else {
                const pointResults = await pool.query(`SELECT point FROM user WHERE name = ?`, [userboy]);
                if (pointResults.length > 0) {
                    userPoints = pointResults[0].point;
                    await client.setEx('point', 3600, JSON.stringify(userPoints));
                } else {
                    userPoints = 0;
                }
            }
            res.render('../view/eventReward.ejs', { rewards: rewards, userPoints: userPoints, events: Events });
        } catch (err) {
            console.error('Error in /add-tasks:', err);
            next(err);
        }
    });

    router.get('/tasks', authenticateJWT, async (req, res, next) => {
        const userboy = req.user.username;
        let tasks = [];
        let activeCoupons = [];
        let point = 0;

        try {
            const cachedTasks = await client.get('users');
            const cachedNonActive = await client.get('nonactive');
            const cachedPoint = await client.get('point');

            if (cachedTasks && cachedNonActive && cachedPoint) {
                console.log("Serving tasks from Redis cache.");
                tasks = JSON.parse(cachedTasks);
                activeCoupons = JSON.parse(cachedNonActive);
                point = JSON.parse(cachedPoint);
            } else {
                console.log("Fetching tasks from database and caching to Redis.");
                const results = await pool.query(`SELECT * FROM \`${userboy}\` WHERE Active IS NULL`);
                const nonactiveResults = await pool.query(`SELECT * FROM \`${userboy}\` WHERE Active IS NOT NULL`);
                const pointResults = await pool.query(`SELECT point FROM user WHERE name = ?`, [userboy]);
                point = pointResults.length > 0 ? pointResults[0].point : 0;

                await client.setEx('users', 3600, JSON.stringify(results));
                await client.setEx('nonactive', 3600, JSON.stringify(nonactiveResults));
                await client.setEx('point', 3600, JSON.stringify(point));

                tasks = results;
                activeCoupons = nonactiveResults;
            }
            res.render('../view/tasks', { tasks: tasks, activeCoupons: activeCoupons, point: point });
        } catch (err) {
            console.error('Error in /tasks:', err);
            next(err);
        }
    });

    router.post('/login', async (req, res, next) => {
        const username = req.body.username;
        const password = req.body.password;

        try {
            const results = await pool.query('SELECT * FROM user WHERE name = ?', [username]);

            if (results.length === 0) {
                console.log('User not found.');
                return res.redirect('/login');
            }

            const user = results[0];
            const passwordMatch = await bcrypt.compare(password, user.password);

            if (!passwordMatch) {
                console.log('Incorrect password.');
                return res.redirect('/login');
            }

            await client.del('users', 'nonactive', 'point');
            console.log('User-related Redis keys cleared upon login.');

            res.clearCookie('user');

            const token = jwt.sign({ username: user.name, id: user.id }, secretKey, { expiresIn: '1m' });
            const refreshToken = jwt.sign(
                { username: user.name, id: user.id },
                secretKey,
                { expiresIn: '7d' }
            );

            res.cookie('token', token, { 
                httpOnly: true, 
                maxAge: 300000, 
                sameSite: 'Lax', 
                secure: process.env.NODE_ENV === 'production' 
            });
            res.cookie('refreshToken', refreshToken, { 
                httpOnly: true, 
                secure: process.env.NODE_ENV === 'production', 
                maxAge: 604800000, 
                sameSite: 'Lax' 
            });

            res.redirect('/tasks');
        } catch (err) {
            console.error('Error during login process:', err);
            next(err);
        }
    });

    return router;
};