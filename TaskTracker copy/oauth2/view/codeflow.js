// const express = require('express');
// const axios = require('axios');
// const querystring = require('querystring');

// const app = express();

// const clientId = 'YOUR_CLIENT_ID';
// const clientSecret = 'YOUR_CLIENT_SECRET';
// const redirectUri = 'http://localhost:3000/callback';
// const authorizationUrl = 'https://example.com/oauth/authorize';
// const tokenUrl = 'https://example.com/oauth/token';

// app.get('/', (req, res) => {
//   const authUrl = `${authorizationUrl}?` + querystring.stringify({
//     response_type: 'code',
//     client_id: clientId,
//     redirect_uri: redirectUri,
//     scope: 'profile email',
//     state: 'randomStringForSecurity'
//   });

//   res.redirect(authUrl);
// });

// app.get('/callback', async (req, res) => {
//   const { code } = req.query;

//   try {
//     const response = await axios.post(tokenUrl, querystring.stringify({
//       grant_type: 'authorization_code',
//       code: code,
//       redirect_uri: redirectUri,
//       client_id: clientId,
//       client_secret: clientSecret
//     }), {
//       headers: {
//         'Content-Type': 'application/x-www-form-urlencoded'
//       }
//     });

//     const accessToken = response.data.access_token;

//     res.send(`Access Token: ${accessToken}`);
//   } catch (error) {
//     console.error('Error fetching access token:', error);
//     res.status(500).send('Error fetching access token');
//   }
// });

// app.listen(3000, () => {
//   console.log('Server is running on http://localhost:3000');
// });
