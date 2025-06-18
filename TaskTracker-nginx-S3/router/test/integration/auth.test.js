// tests/integration/auth.test.js
const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');
const connection = require('../../../db.js');
const bcrypt = require('bcryptjs');

// Create test app
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Mock router (import your actual router)
const router = require('../../../router.js');
app.use('/', router);

describe('Authentication Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /login', () => {
    test('should login with valid credentials', async () => {
      // Mock database response
      const mockUser = {
        id: 1,
        name: 'testuser',
        password: 'hashedPassword'
      };
      
      connection.query.mockImplementation((query, params, callback) => {
        if (query.includes('SELECT * FROM user WHERE name = ?')) {
          callback(null, [mockUser]);
        }
      });

      bcrypt.compare.mockResolvedValue(true);

      const response = await request(app)
        .post('/login')
        .send({
          username: 'testuser',
          password: 'correctPassword'
        });

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('/tasks');
      expect(response.headers['set-cookie']).toBeDefined();
    });

    test('should reject invalid credentials', async () => {
      // Mock database response
      connection.query.mockImplementation((query, params, callback) => {
        callback(null, []);
      });

      const response = await request(app)
        .post('/login')
        .send({
          username: 'nonexistent',
          password: 'wrongPassword'
        });

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('/login');
    });

    test('should reject wrong password', async () => {
      const mockUser = {
        id: 1,
        name: 'testuser',
        password: 'hashedPassword'
      };
      
      connection.query.mockImplementation((query, params, callback) => {
        if (query.includes('SELECT * FROM user WHERE name = ?')) {
          callback(null, [mockUser]);
        }
      });

      bcrypt.compare.mockResolvedValue(false);

      const response = await request(app)
        .post('/login')
        .send({
          username: 'testuser',
          password: 'wrongPassword'
        });

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('/login');
    });
  });

  describe('POST /create-table', () => {
    test('should create new user account', async () => {
      // Mock database responses
      connection.query
        .mockImplementationOnce((query, params, callback) => {
          // Check if user exists
          if (query.includes('SELECT name FROM user WHERE name = ?')) {
            callback(null, []);
          }
        })
        .mockImplementationOnce((query, params, callback) => {
          // Insert new user
          if (query.includes('INSERT INTO user')) {
            callback(null, { insertId: 1 });
          }
        })
        .mockImplementationOnce((query, params, callback) => {
          // Create user table
          if (query.includes('CREATE TABLE')) {
            callback(null, {});
          }
        });

      const response = await request(app)
        .post('/create-table')
        .send({
          name: 'newuser',
          password: 'newpassword'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('CREATING NEW ACCOUNT SUCCESSFUL');
    });

    test('should reject duplicate username', async () => {
      // Mock database response for existing user
      connection.query.mockImplementation((query, params, callback) => {
        if (query.includes('SELECT name FROM user WHERE name = ?')) {
          callback(null, [{ name: 'existinguser' }]);
        }
      });

      const response = await request(app)
        .post('/create-table')
        .send({
          name: 'existinguser',
          password: 'password'
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('The name already exists ');
    });
  });

  describe('Google OAuth Integration', () => {
    test('should handle Google OAuth callback', async () => {
      const mockTokenResponse = {
        data: {
          access_token: 'mock_access_token'
        }
      };

      const mockUserInfo = {
        data: {
          sub: 'google_user_id',
          name: 'Google User',
          email: 'user@gmail.com'
        }
      };

      const axios = require('axios');
      axios.post.mockResolvedValue(mockTokenResponse);
      axios.get.mockResolvedValue(mockUserInfo);

      const response = await request(app)
        .post('/auth/google/callback')
        .send({
          code: 'mock_auth_code',
          codeVerifier: 'mock_code_verifier'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test('should handle Google OAuth error', async () => {
      const axios = require('axios');
      axios.post.mockRejectedValue(new Error('OAuth error'));

      const response = await request(app)
        .post('/auth/google/callback')
        .send({
          code: 'invalid_code',
          codeVerifier: 'invalid_verifier'
        });

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('/');
    });
  });

  describe('GET /logout', () => {
    test('should logout and clear cookies', async () => {
      const response = await request(app)
        .get('/logout')
        .set('Cookie', ['token=validToken; refreshToken=validRefreshToken']);

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('/');
      
      // Check that cookies are cleared
      const cookies = response.headers['set-cookie'];
      expect(cookies.some(cookie => cookie.includes('token=;'))).toBe(true);
      expect(cookies.some(cookie => cookie.includes('refreshToken=;'))).toBe(true);
    });
  });

  describe('Protected Routes', () => {
    test('should access protected route with valid token', async () => {
      const response = await request(app)
        .get('/tasks')
        .set('Cookie', ['token=validToken']);

      expect(response.status).not.toBe(302);
    });

    test('should redirect to login without token', async () => {
      const response = await request(app)
        .get('/tasks');

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('/login');
    });
  });
});