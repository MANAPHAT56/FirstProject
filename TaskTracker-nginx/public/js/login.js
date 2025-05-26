
function generateRandomString(length) {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    const randomValues = new Uint8Array(length);
    crypto.getRandomValues(randomValues);
    randomValues.forEach((value) => {
      result += charset[value % charset.length];
    });
    return result;
  }
  

  async function sha256(plain) {
    const encoder = new TextEncoder();
    const data = encoder.encode(plain);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return new Uint8Array(hash);
  }
  

  function base64UrlEncode(arrayBuffer) {
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
    return base64.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  }
  

  const clientId = '687095367345-mfbmo1n0skvcfq7amilnk0a1dm746ii7.apps.googleusercontent.com';
  const redirectUri = 'https://toteja.co/auth/google/callback';
  const authorizationUrl = 'https://accounts.google.com/o/oauth2/v2/auth';
  

  document.getElementById('login').addEventListener('click', async () => {
    console.log('Button clicked!');

    const codeVerifier = generateRandomString(128);
    localStorage.setItem('code_verifier', codeVerifier);
  

    const codeChallenge = base64UrlEncode(await sha256(codeVerifier));
    // document.cookie = `codeverifier=${codeVerifier}; path=/; secure=true; max-age=30000; httpOnly:true;`;

      const authUrl = `${authorizationUrl}?` + new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'openid email profile',
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    // ถ้าจะใช้ state, แนะนำให้ random อีกชุดนึง (อย่าใช้ code_verifier เลย)
    state: 'my_state_123'// 
  });

    console.log(authUrl);
    window.location.href = authUrl;
   
  });
  




















