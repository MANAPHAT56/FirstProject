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
  let io;
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const CryptoJS = require("crypto-js");

// ฟังก์ชันเข้ารหัส (AES)
const encryptAES = (plainText) => {
  return CryptoJS.AES.encrypt(plainText, secretKey).toString();
};

// ฟังก์ชันถอดรหัส (AES)
const decryptAES = (cipherText) => {
  const bytes = CryptoJS.AES.decrypt(cipherText, secretKey);
  return bytes.toString(CryptoJS.enc.Utf8);
};

  // function isAuthenticated(req, res, next) {
  //   if (req.session && req.session.login) {
  //     return next();
  //   }
  //   res.redirect('/login');
  // }
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
const createTable = (tableName) => {
  return new Promise((resolve, reject) => {
      const createTableQuery = `
          CREATE TABLE \`${tableName}\` (
              id INT AUTO_INCREMENT PRIMARY KEY,
              name VARCHAR(100) NOT NULL,
              img VARCHAR(255),
              Active VARCHAR(10),
               ExpiredAt DATETIME,
              couponid INT
          );
      `;
      connection.query(createTableQuery, (err, result) => {
          if (err) {
              console.error('Error creating table:', err);
              reject(err);
          } else {
              resolve(result);
          }
      });
  });
};
const createTableoauth2 = (tableName) => {
  return new Promise((resolve, reject) => {
      const createTableQuery = `
           CREATE TABLE \`${tableName}\` (
              id INT AUTO_INCREMENT PRIMARY KEY,
              name VARCHAR(255) NOT NULL,
              img VARCHAR(255),
              Active VARCHAR(10),
               ExpiredAt DATETIME,
              couponid INT
          );
      `;
      connection.query(createTableQuery, (err, result) => {
          if (err) {
              console.error('Error creating table:', err);
              reject(err);
          } else {
              resolve(result);
          }
      });
  });
};
async function hashPassword(password) {
  try{
    const hashedPassword1= await bcrypt.hash(password,10);
    console.log(hashedPassword1);
    return hashedPassword1;
  }
      catch(err){
        throw new Error('Error hashing password: ' + err.message); 
      }
  }
router.get('/auth/google/callback', async (req, res, next) => {
    try {
      const code = req.query.code; // รับ authorization code จาก query string
      const codeVerifier = req.cookies.codeverifier;
      console.log(req.cookies.codeverifier);
      // console.log(codeVerifier);
      // const user =  req.cookies.user;
      // console.log(user);
      if (!codeVerifier) {
        throw new Error('Missing code verifier'); // ตรวจสอบว่ามี code_verifier หรือไม่
      }
      // แลกเปลี่ยนโค้ดเป็นโทเคน
      const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', querystring.stringify({
        code: code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: process.env.GOOGLE_CALLBACK_URL,
        grant_type: 'authorization_code',
        code_verifier: codeVerifier, // ส่ง code_verifier ที่นี่
      }),// ต้องตั้งค่าให้ถูกต้อง
  {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });
  
      // ดึงข้อมูล token
      const { access_token, id_token } = tokenResponse.data;
       console.log(access_token);
      // ใช้ access_token ดึงข้อมูลผู้ใช้
      const userInfo = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${access_token}` }
      });
      const username=userInfo.data.sub;
      const id=userInfo.data.sub;
      console.log(id);
      const userInfojwt = jwt.sign({ username, id }, secretKey, { expiresIn: '1m' });
      res.cookie('user',userInfojwt, { 
        httpOnly: true,  // คุกกี้นี้จะไม่สามารถเข้าถึงได้จาก JavaScript ในฝั่ง client
        secure:true,  // ใช้ secure cookie เมื่อเป็น production 
        maxAge: 3600000,
        samesite : "Strict"
      });   
      // res.cookie('refreshToken',"hetrhew", { httpOnly: true,secure:false, maxAge: 604800000 });
      console.log(req.cookies.user);
      // เก็บข้อมูลผู้ใช้ใน session หรือ database
      // req.session.user = userInfo.data;
      // req.user=req.session.user;
      // console.log(req.session.user);
      // รีไดเร็กต์ไปหน้า dashboard
      console.log(1);
      console.log(req.cookies.user);
      console.log(req.cookies); 
      console.log("Codeverify"+codeVerifier);
      res.redirect('/dashboard');
    } catch (err) {
      console.error(err);
      console.log(1);
      console.log("wrong")
      console.log("Codeverify"+codeVerifier);
      res.redirect('/'); // รีไดเร็กต์กลับไปหน้าแรกถ้ามีข้อผิดพลาด
    }
  });
  router.get('/dashboard', (req, res) => {
    const token=req.cookies.user;
    // const token=req.cookies.token;
    let userCookie=0;
    console.log(token);
    jwt.verify(token, secretKey, (err, user) => {
      if (err) {
        console.error('Invalid access token:', err);
      }else{
        userCookie= user;
        console.log(userCookie)
        console.log("Hi usercookie")
      }});
    console.log(req.cookies.user.sub);  
    console.log(req.cookies);
    // if (!req.isAuthenticated()) {
    //   return res.redirect('/');
    // }
  //   res.redirect('/');
  //   console.log(userCookie);
  // });
    console.log("kuy");
      const tableName=userCookie.username;
      console.log(tableName);
      const id=0;
      connection.query('SELECT * FROM user WHERE name = ?;', [tableName], async (err, results) => {
        console.log(results);
        if(results.length==1){
          // res.status(200).json({ message: "The name already exists " });
          const token = jwt.sign({username:results[0].name,id:results[0].id},secretKey,{expiresIn : '1m'});
          const refreshToken = jwt.sign(
            { username:results[0].name, id:results[0].id},
            secretKey,
            { expiresIn: '7d' } // Refresh Token อาจมีอายุการใช้งานนานกว่า Access Token
          );
          res.cookie('token',token,{httpOnly:true,maxAge:300000,samesite:"Strict"});  
          res.cookie('refreshToken', refreshToken, { httpOnly: true,secure:false, maxAge: 604800000,samesite:"Strict"});
          return res.redirect('/tasks');
        }
      else{
        console.log(results.length);
          res.clearCookie('token');
          res.clearCookie('refreshToken');
      connection.query('INSERT INTO user (name,point) VALUES (?,?)', [tableName,0],async (err, results) => {
        // if (err) {
        //   console.log("มืชื่อนี้เเล้ว");
        //    res.clearCookie('token');
        //    res.clearCookie('refreshToken');
        //    console.log(err);
        //    return res.redirect('/');
        // } else{
        if(err)console.log(err);
          await createTableoauth2(tableName);
          const token = jwt.sign({username:tableName,id:0},secretKey,{expiresIn : '1m'});
          const refreshToken = jwt.sign(
            { username:tableName,id:0 },
            secretKey,
            { expiresIn: '7d' } // Refresh Token อาจมีอายุการใช้งานนานกว่า Access Token
          );
          res.cookie('token',token,{httpOnly:true,maxAge:300000,samesite:"Strict"});  
          res.cookie('refreshToken', refreshToken, { httpOnly: true,secure:false, maxAge: 604800000,samesite:"Strict" });
          return res.redirect('/tasks');
        // }
      });
    // // res.render('tasks', { tasks : userCookie }); 
    // res.redirect('/');
  }});
});
function queryDB(sql) {
  return new Promise((resolve, reject) => {
      connection.query(sql, (err, results) => {
          if (err) return reject(err);
          resolve(results);
      });
  });
}
router.get('/admin',authenticateJWT, async (req,res)=>{
    let users,useroauths;
    if(req.cookies==undefined)res.redirect('/login');
    else{
    if(req.user.username=="admin"){
      try{
        const users = await queryDB(`SELECT * FROM user`);
       res.render('../view/user', { users ,useroauths});
      }catch (err) {
        next(err);
    }
}
    else{
      res.redirect('/login');
    }
  }
  });
  router.post('/delete/:id',authenticateJWT, (req, res) => {
    console.log('Received DELETE request for user ID:', req.params.id);
    const userId = req.params.id;
    if (!userId) {
        return res.status(400).json({ error: "User ID is required" });
    }
    
    // Query to get the user name before deleting
    connection.query("SELECT name FROM user WHERE id = ?", [userId], (err, results) => {
        if (err) {
            console.error('Error retrieving user:', err);
            return res.status(500).json({ error: 'Error retrieving user' });
        }
        if(results.length==0) return res.status(404).json({ error: 'User not found' });
        else{
        const userName = results[0].name; // Get the user name

        // SQL query to delete the user
        connection.query('DELETE FROM user WHERE id = ?', [userId], (err, results) => {
            if (err) {
                console.error('Error deleting user:', err);
                return res.status(500).json({ error: 'Error deleting user' });
            }

            if (results.affectedRows === 0) {
                return res.status(404).json({ error: 'User not found' });
            }

            // Drop table associated with the user
            const dropTableQuery = `DROP TABLE IF EXISTS \`${userName}\``;
            connection.query(dropTableQuery, (err, results) => {
                if (err) {
                    console.error('Error dropping table:', err);
                    return res.status(500).json({ error: 'Error dropping user table' });
                }
                return res.status(200).json({ error: "User and associated table deleted successfully" });;
                
                // Send success response
            });
        });
    }});
  });
  router.get('/',(req,res)=>{
    res.render("../view/home.ejs");
  })
  router.get('/create',async(req,res)=>{
    res.render('../view/create.ejs');
  })
  router.get('/logout',authenticateJWT,async(req,res)=>{
    res.clearCookie('token');
    res.clearCookie('refreshToken');
    res.clearCookie('user');
    client.del('users', (err, response) => {
      if (err) {
          console.log('Error deleting key:', err);
      } else {
          console.log('Key deleted successfully:', response);
      }
  });
    res.redirect('/');
    // req.session.destroy((err)=>{
    //   if(err){
    //   console.error('Session destruction error:', err);
    //   return res.status(500).send('Unable to log out. Please try again.');
    //   }
    // });
    //  res.redirect('/');


  });
  router.post('/create-table', async (req, res) => {
    const tableName = req.body.name;  // Get the table name from the request body
    const id=0;
    console.log(id);
    console.log("Kuy");
    const password=await hashPassword(req.body.password);
    if (!tableName) {
      return res.status(500).send('Table name is required.');
    }
    connection.query('SELECT name FROM user WHERE name = ?', [tableName], async (err, results) => {
    if(results[0]==undefined || results.length!==1){
      res.clearCookie('token');
      res.clearCookie('refreshToken');
      connection.query('INSERT INTO user (name,password,id,point) VALUES (?,?,?,?)', [tableName,password,id,0], (err, results) => {
        if (err) {
          console.log(password)
          console.error('Error inserting task:', err);
            return res.status(500).send('Error adding task');
        } else{
          createTable(tableName);
          return res.status(400).json({error:"CREATING NEW ACCOUNT SUCCESSFUL"});
        }
      });
    }else{
      console.log(results[0]);
      res.status(200).json({ message: "The name already exists " });
    // return res.redirect('/login');
  }})
  });
  router.get('/login',async (req,res)=>{
      res.render('../view/login.ejs');
  });
  const rewards=[
    {
        "name": "กระเป๋า ว่าน จำกัด",
        "description": "ใส่เเล้ว A ตลอด 4 ปี มีช่องเก็บคอมพิวเตอร์ที่ป้องกันการกระแทก พร้อมช่องแยกต่างหากสำหรับโทรศัพท์และของใช้ประจำวัน ทำให้การจัดระเบียบเป็นเรื่องง่าย",
        "P_required": 150,
        "image":"../images/Reward.jpg",
        "Brand": "ว่าน จำกัด"
    },
    {
        "name": "กระเป๋า อาร์ท โปร",
        "description": "ดีไซน์ล้ำสมัย มาพร้อมช่องซิปกันขโมย และวัสดุกันน้ำระดับพรีเมียม เหมาะสำหรับนักเดินทางและนักศึกษา",
        "P_required": 180,
        "image":"../images/Reward.jpg",
        "Brand": "อาร์ท โปร"
    },
    {
        "name": "กระเป๋า ไททัน เกียร์",
        "description": "แข็งแรงทนทาน รับน้ำหนักได้มากถึง 20 กิโลกรัม พร้อมสายสะพายบุนุ่มและระบบระบายอากาศ ลดความอับชื้น",
        "P_required": 200,
        "image":"../images/Reward.jpg",
        "Brand": "ไททัน เกียร์"
    },
    {
        "name": "กระเป๋า ไลท์ ทราเวล",
        "description": "น้ำหนักเบาเพียง 500 กรัม มีช่อง USB สำหรับชาร์จมือถือ และช่องซ่อนของสำคัญเพื่อความปลอดภัย",
        "P_required": 170,
        "image":"../images/Reward.jpg",
        "Brand": "ไลท์ ทราเวล"
    },
    {
        "name": "กระเป๋า เออร์เบิน สไตล์",
        "description": "สไตล์มินิมอลแต่เต็มไปด้วยฟังก์ชัน มีช่องเก็บขวดน้ำ และดีไซน์ที่เข้ากับทุกลุคของคนเมือง",
        "P_required": 160,
        "image":"../images/Reward.jpg",
        "Brand": "เออร์เบิน สไตล์"
    },
    {
      "name": "กระเป๋า เออร์เบิน สไตล์",
      "description": "สไตล์มินิมอลแต่เต็มไปด้วยฟังก์ชัน มีช่องเก็บขวดน้ำ และดีไซน์ที่เข้ากับทุกลุคของคนเมือง",
      "P_required": 160,
      "image":"../images/Reward.jpg",
      "Brand": "เออร์เบิน สไตล์"
  },
  {
    "name": "กระเป๋า เออร์เบิน สไตล์",
    "description": "สไตล์มินิมอลแต่เต็มไปด้วยฟังก์ชัน มีช่องเก็บขวดน้ำ และดีไซน์ที่เข้ากับทุกลุคของคนเมือง",
    "P_required": 160,
    "image":"../images/Reward.jpg",
    "Brand": "เออร์เบิน สไตล์"
},
{
  "name": "กระเป๋า เออร์เบิน สไตล์",
  "description": "สไตล์มินิมอลแต่เต็มไปด้วยฟังก์ชัน มีช่องเก็บขวดน้ำ และดีไซน์ที่เข้ากับทุกลุคของคนเมือง",
  "P_required": 160,
  "image":"../images/Reward.jpg",
  "Brand": "เออร์เบิน สไตล์"
}
]
const Events=[
  {
      "name": "ออกเเบบกระเป๋า",
      "description": "ใส่เเล้ว A ตลอด 4 ปี มีช่องเก็บคอมพิวเตอร์ที่ป้องกันการกระแทก พร้อมช่องแยกต่างหากสำหรับโทรศัพท์และของใช้ประจำวัน ทำให้การจัดระเบียบเป็นเรื่องง่าย",
      "date": "23/05/05-30/05/05",
      "image":"../images/Activity2.jpg"
  },
  {
    "name": "ออกเเบบกระเป๋า",
    "description": "ใส่เเล้ว A ตลอด 4 ปี มีช่องเก็บคอมพิวเตอร์ที่ป้องกันการกระแทก พร้อมช่องแยกต่างหากสำหรับโทรศัพท์และของใช้ประจำวัน ทำให้การจัดระเบียบเป็นเรื่องง่าย",
    "date": "23/05/05-30/05/05",
    "image":"../images/Activity2.jpg"
  },
  {
    "name": "ออกเเบบกระเป๋า",
    "description": "ใส่เเล้ว A ตลอด 4 ปี มีช่องเก็บคอมพิวเตอร์ที่ป้องกันการกระแทก พร้อมช่องแยกต่างหากสำหรับโทรศัพท์และของใช้ประจำวัน ทำให้การจัดระเบียบเป็นเรื่องง่าย",
    "date": "23/05/05-30/05/05",
    "image":"../images/Activity2.jpg"
  },
  {
    "name": "ออกเเบบกระเป๋า",
    "description": "ใส่เเล้ว A ตลอด 4 ปี มีช่องเก็บคอมพิวเตอร์ที่ป้องกันการกระแทก พร้อมช่องแยกต่างหากสำหรับโทรศัพท์และของใช้ประจำวัน ทำให้การจัดระเบียบเป็นเรื่องง่าย",
    "date": "23/05/05-30/05/05",
    "image":"../images/Drawbag.png"
  },
  {
    "name": "ออกเเบบกระเป๋า",
    "description": "ใส่เเล้ว A ตลอด 4 ปี มีช่องเก็บคอมพิวเตอร์ที่ป้องกันการกระแทก พร้อมช่องแยกต่างหากสำหรับโทรศัพท์และของใช้ประจำวัน ทำให้การจัดระเบียบเป็นเรื่องง่าย",
    "date": "23/05/05-30/05/05",
    "image":"../images/Tote+2.png"
  },
  {
    "name": "ออกเเบบกระเป๋า",
      "description": "ใส่เเล้ว A ตลอด 4 ปี มีช่องเก็บคอมพิวเตอร์ที่ป้องกันการกระแทก พร้อมช่องแยกต่างหากสำหรับโทรศัพท์และของใช้ประจำวัน ทำให้การจัดระเบียบเป็นเรื่องง่าย",
      "date": "23/05/05-30/05/05",
      "image":"../images/Tote+2.png"
},
{
  "name": "ออกเเบบกระเป๋า",
      "description": "ใส่เเล้ว A ตลอด 4 ปี มีช่องเก็บคอมพิวเตอร์ที่ป้องกันการกระแทก พร้อมช่องแยกต่างหากสำหรับโทรศัพท์และของใช้ประจำวัน ทำให้การจัดระเบียบเป็นเรื่องง่าย",
      "date": "23/05/05-30/05/05",
      "image":"../images/Tote+2.png"
},
{
  "name": "ออกเเบบกระเป๋า",
  "description": "ใส่เเล้ว A ตลอด 4 ปี มีช่องเก็บคอมพิวเตอร์ที่ป้องกันการกระแทก พร้อมช่องแยกต่างหากสำหรับโทรศัพท์และของใช้ประจำวัน ทำให้การจัดระเบียบเป็นเรื่องง่าย",
  "date": "23/05/05-30/05/05",
  "image":"../images/Activity3.jpg"
}
]

  router.get('/add-tasks',authenticateJWT,async (req,res)=>{
    const userboy=req.user.username;
    const point = await client.get('point');
    if(!point){
      connection.query(`SELECT * FROM user WHERE name=?;`,[userboy],(err,point)=>{
        console.log(point[0])
        client.setEx('point', 3600, JSON.stringify(point[0].point));
        res.redirect('/add-tasks');
      });
    }else{
      res.render('../view/eventReward.ejs',{rewards:rewards,userPoints:point,events:Events});
    }
  })
  router.get('/tasks',authenticateJWT, async (req, res) => {
      const userboy=req.user.username;
    const value = await client.get('users');
    const nonactive=await client.get('nonactive');
    const point = await client.get('point');
    if(value && nonactive && point) {
      console.log("value");
      console.log(nonactive);
      console.log(JSON.parse(nonactive));
      console.log(point);
      res.render('../view/tasks', { tasks: JSON.parse(value),activeCoupons:JSON.parse(nonactive),point:JSON.parse(point)});
    } else {
      connection.query(`SELECT * FROM \`${userboy}\` WHERE Active IS NULL`, (err, results) => {
        if (err) {
          console.log("ejrttj");
          console.log(err);
            return  res.render('../view/tasks'); // Handle errors;
        }
        connection.query(`SELECT * FROM \`${userboy}\` WHERE Active IS NOT NULL`,(err,nonactive)=>{
          client.setEx('nonactive', 3600, JSON.stringify(nonactive));
          console.log(results);
          console.log(nonactive);
          client.setEx('users', 3600, JSON.stringify(results));
          connection.query(`SELECT * FROM user WHERE name=?;`,[userboy],(err,point)=>{
            console.log(point[0])
            client.setEx('point', 3600, JSON.stringify(point[0].point));
            res.render('../view/tasks', { tasks: results , activeCoupons:nonactive,point:point[0].point});
          });
        });
        // Render the EJS template with the data
    });
    }
  }
  );
  router.post('/login',async (req,res)=>{
    try{
      const username=req.body.username;
      const password=req.body.password;
      connection.query('SELECT * FROM user WHERE name = ?', [username], async (err, results) => {
        if (err) {
          console.error('Database query error:', err);
          return res.redirect('/login'); // Redirect on query error
        }
        else if(results.length==0){
          console.log(2)
          res.redirect('/login');
        }
        else{
          const check=await bcrypt.compare(password,results[0].password);
          if(err){
            console.log(1)
            res.redirect('/login');
          }
          else if (!check) {
             console.log(check)
          console.error('Error inserting task:', err);
            res.redirect('/login');
        }
        else{
            const token = jwt.sign({username:results[0].name,id:results[0].id },secretKey,{expiresIn : '1m'});
            const refreshToken = jwt.sign(
              { username: results[0].name, id: results[0].id },
              secretKey,
              { expiresIn: '7d' } // Refresh Token อาจมีอายุการใช้งานนานกว่า Access Token
            );
            console.log(token+"htjjteejej");
            res.cookie('token',token,{httpOnly:true,maxAge:300000,samesite:"Strict"});
            res.cookie('refreshToken', refreshToken, { httpOnly: true,secure:false, maxAge: 604800000,samesite:"Strict" });
            console.log(req.user);
            res.redirect('/tasks');
        }
    }})
    }catch(err){

    }
  })
  module.exports=router;
  // module.exports = hashPassword;
  