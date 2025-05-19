
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
  

  const clientId = '575897144741-oahon6knnlh0a6tvifopuqrvt3bq4b74.apps.googleusercontent.com';
  const redirectUri = 'https://tote.com/auth/google/callback';
  const authorizationUrl = 'https://accounts.google.com/o/oauth2/v2/auth';
  

  document.getElementById('login').addEventListener('click', async () => {
    console.log('Button clicked!');

    const codeVerifier = generateRandomString(128);
    localStorage.setItem('code_verifier', codeVerifier);
  

    const codeChallenge = base64UrlEncode(await sha256(codeVerifier));
    document.cookie = `codeverifier=${codeVerifier}; path=/; secure=true; max-age=30000; httpOnly:true;`;

    const authUrl = `${authorizationUrl}?` + new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: 'openid email profile',
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',   
      state: codeVerifier 
    });

    console.log(authUrl);
    window.location.href = authUrl;

  });
  




















// const addTaskButton = document.getElementById('username');
// const taskInput = document.getElementById('password');

// addTaskButton.addEventListener('submit', async () => {
//     const taskText = taskInput.value.trim();
    
//     if (!taskText) {
//         console.log('Error: Task input is empty');
//         return;
//     }

//     try {
//         const response = await fetch('/logintasks', {
//             method: 'POST',
//             headers: {
//                 'Content-Type': 'application/json'
//             },
//             body: JSON.stringify({ task: taskText }) // Ensure this is correctly set
//         });

//         if (!response.ok) {
//             throw new Error('Network response was not ok');
//         }

//         taskInput.value = ''; // Clear the input field after successful submission
//         window.location.href = '/tasks'; // Redirect to the task list page after adding a task
//     } catch (error) {
//         console.error('There was a problem with the fetch operation:', error);
//     }
// });