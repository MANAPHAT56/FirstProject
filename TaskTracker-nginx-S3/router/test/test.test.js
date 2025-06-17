// router.test.js
const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// Mock all external dependencies
jest.mock('../db.js', () => ({
  query: jest.fn(),
}));

jest.mock('../redis.js', () => ({
  get: jest.fn(),
  set: jest.fn(),
  setEx: jest.fn(),
  del: jest.fn(),
}));

jest.mock('bcryptjs', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(),
  verify: jest.fn(),
}));

jest.mock('axios');
jest.mock('../S3.js');
jest.mock('crypto-js');

const connection = require('../db.js');
const client = require('../redis.js');
const router = require('../router'); // Adjust path as needed
const axios = require('axios');

// Create Express app for testing
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/', router);

describe('Router Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('hashPassword function', () => {
    it('should hash the password successfully', async () => {
      const password = 'myPassword123';
      const mockHashedPassword = '$2a$10$xyz...';

      bcrypt.hash.mockResolvedValue(mockHashedPassword);

      // Since hashPassword is not exported, we'll test it through the create-table route
      connection.query.mockImplementation((query, params, callback) => {
        if (query.includes('SELECT name FROM user WHERE name = ?')) {
          callback(null, []); // No existing user
        } else if (query.includes('INSERT INTO user')) {
          callback(null, { insertId: 1 });
        }
      });

      const response = await request(app)
        .post('/create-table')
        .send({ name: 'testuser', password: 'myPassword123' });

      expect(bcrypt.hash).toHaveBeenCalledWith('myPassword123', 10);
    });

    it('should handle bcrypt hash error', async () => {
      const mockError = new Error('bcrypt error');
      bcrypt.hash.mockRejectedValue(mockError);

      connection.query.mockImplementation((query, params, callback) => {
        if (query.includes('SELECT name FROM user WHERE name = ?')) {
          callback(null, []); // No existing user
        }
      });

      const response = await request(app)
        .post('/create-table')
        .send({ name: 'testuser', password: 'myPassword123' });

      expect(response.status).toBe(500);
    });
  });

  describe('POST /create-table', () => {
    it('should create new user successfully', async () => {
      const mockHashedPassword = '$2a$10$hashedpassword';
      bcrypt.hash.mockResolvedValue(mockHashedPassword);

      connection.query.mockImplementation((query, params, callback) => {
        if (query.includes('SELECT name FROM user WHERE name = ?')) {
          callback(null, []); // No existing user
        } else if (query.includes('INSERT INTO user')) {
          callback(null, { insertId: 1 });
        } else if (query.includes('CREATE TABLE')) {
          callback(null, {});
        }
      });

      const response = await request(app)
        .post('/create-table')
        .send({ name: 'testuser', password: 'password123' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('CREATING NEW ACCOUNT SUCCESSFUL');
      expect(bcrypt.hash).toHaveBeenCalledWith('password123', 10);
    });

    it('should reject duplicate username', async () => {
      connection.query.mockImplementation((query, params, callback) => {
        if (query.includes('SELECT name FROM user WHERE name = ?')) {
          callback(null, [{ name: 'testuser' }]); // User exists
        }
      });

      const response = await request(app)
        .post('/create-table')
        .send({ name: 'testuser', password: 'password123' });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('The name already exists ');
    });

    it('should return error for missing table name', async () => {
      const response = await request(app)
        .post('/create-table')
        .send({ password: 'password123' });

      expect(response.status).toBe(500);
      expect(response.text).toBe('Table name is required.');
    });
  });

  describe('POST /login', () => {
    it('should login successfully with correct credentials', async () => {
      const mockUser = {
        id: 1,
        name: 'testuser',
        password: '$2a$10$hashedpassword'
      };

      connection.query.mockImplementation((query, params, callback) => {
        if (query.includes('SELECT * FROM user WHERE name = ?')) {
          callback(null, [mockUser]);
        }
      });

      bcrypt.compare.mockResolvedValue(true);
      jwt.sign.mockReturnValue('mocktoken');
      client.del.mockImplementation((key, callback) => callback(null, 1));

      const response = await request(app)
        .post('/login')
        .send({ username: 'testuser', password: 'password123' });

      expect(response.status).toBe(302); // Redirect status
      expect(bcrypt.compare).toHaveBeenCalledWith('password123', mockUser.password);
      expect(jwt.sign).toHaveBeenCalled();
    });

    it('should reject login with wrong password', async () => {
      const mockUser = {
        id: 1,
        name: 'testuser',
        password: '$2a$10$hashedpassword'
      };

      connection.query.mockImplementation((query, params, callback) => {
        if (query.includes('SELECT * FROM user WHERE name = ?')) {
          callback(null, [mockUser]);
        }
      });

      bcrypt.compare.mockResolvedValue(false);

      const response = await request(app)
        .post('/login')
        .send({ username: 'testuser', password: 'wrongpassword' });

      expect(response.status).toBe(302); // Redirect to login
      expect(bcrypt.compare).toHaveBeenCalledWith('wrongpassword', mockUser.password);
    });

    it('should reject login for non-existent user', async () => {
      connection.query.mockImplementation((query, params, callback) => {
        if (query.includes('SELECT * FROM user WHERE name = ?')) {
          callback(null, []); // No user found
        }
      });

      const response = await request(app)
        .post('/login')
        .send({ username: 'nonexistent', password: 'password123' });

      expect(response.status).toBe(302); // Redirect to login
    });
  });

  describe('GET /tasks', () => {
    it('should return tasks from cache when available', async () => {
      const mockTasks = [{ id: 1, name: 'Test Task' }];
      const mockActiveCoupons = [{ id: 1, name: 'Test Coupon' }];
      const mockPoint = 100;

      client.get.mockImplementation((key) => {
        if (key === 'users') return JSON.stringify(mockTasks);
        if (key === 'nonactive') return JSON.stringify(mockActiveCoupons);
        if (key === 'point') return JSON.stringify(mockPoint);
        return null;
      });

      jwt.verify.mockImplementation((token, secret, callback) => {
        callback(null, { username: 'testuser', id: 1 });
      });

      const response = await request(app)
        .get('/tasks')
        .set('Cookie', ['token=mocktoken']);

      expect(response.status).toBe(200);
      expect(client.get).toHaveBeenCalledWith('users');
      expect(client.get).toHaveBeenCalledWith('nonactive');
      expect(client.get).toHaveBeenCalledWith('point');
    });

    it('should fetch tasks from database when cache is empty', async () => {
      const mockTasks = [{ id: 1, name: 'Test Task' }];
      const mockActiveCoupons = [{ id: 1, name: 'Test Coupon' }];
      const mockUser = { point: 150 };

      client.get.mockReturnValue(null);
      jwt.verify.mockImplementation((token, secret, callback) => {
        callback(null, { username: 'testuser', id: 1 });
      });

      connection.query.mockImplementation((query, params, callback) => {
        if (query.includes('WHERE Active IS NULL')) {
          callback(null, mockTasks);
        } else if (query.includes('WHERE Active IS NOT NULL')) {
          callback(null, mockActiveCoupons);
        } else if (query.includes('SELECT * FROM user WHERE name=?')) {
          callback(null, [mockUser]);
        }
      });

      client.setEx.mockImplementation(() => {});

      const response = await request(app)
        .get('/tasks')
        .set('Cookie', ['token=mocktoken']);

      expect(response.status).toBe(200);
      expect(connection.query).toHaveBeenCalled();
      expect(client.setEx).toHaveBeenCalled();
    });
  });

  describe('POST /auth/google/callback', () => {
    it('should handle Google OAuth callback successfully', async () => {
      const mockTokenResponse = {
        data: { access_token: 'mock_access_token' }
      };
      const mockUserInfo = {
        data: { sub: 'google_user_id' }
      };

      axios.post.mockResolvedValue(mockTokenResponse);
      axios.get.mockResolvedValue(mockUserInfo);
      jwt.sign.mockReturnValue('mock_jwt_token');
      client.del.mockImplementation((key, callback) => callback(null, 1));

      const response = await request(app)
        .post('/auth/google/callback')
        .send({ code: 'auth_code', codeVerifier: 'code_verifier' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(axios.post).toHaveBeenCalledWith(
        'https://oauth2.googleapis.com/token',
        expect.any(String),
        expect.any(Object)
      );
      expect(axios.get).toHaveBeenCalledWith(
        'https://www.googleapis.com/oauth2/v3/userinfo',
        expect.any(Object)
      );
    });

    it('should handle missing code_verifier', async () => {
      const response = await request(app)
        .post('/auth/google/callback')
        .send({ code: 'auth_code' });

      expect(response.status).toBe(400);
      expect(response.text).toBe('Missing code_verifier');
    });
  });

  describe('GET /admin', () => {
    it('should allow admin access', async () => {
      jwt.verify.mockImplementation((token, secret, callback) => {
        callback(null, { username: 'admin', id: 1 });
      });

      connection.query.mockImplementation((query, callback) => {
        if (query.includes('SELECT * FROM user')) {
          callback(null, [{ id: 1, name: 'user1' }]);
        }
      });

      const response = await request(app)
        .get('/admin')
        .set('Cookie', ['token=admintoken']);

      expect(response.status).toBe(200);
      expect(connection.query).toHaveBeenCalledWith('SELECT * FROM user');
    });

    it('should reject non-admin access', async () => {
      jwt.verify.mockImplementation((token, secret, callback) => {
        callback(null, { username: 'regularuser', id: 2 });
      });

      const response = await request(app)
        .get('/admin')
        .set('Cookie', ['token=usertoken']);

      expect(response.status).toBe(302); // Redirect to login
    });
  });

  describe('POST /delete/:id', () => {
    it('should delete user successfully', async () => {
      jwt.verify.mockImplementation((token, secret, callback) => {
        callback(null, { username: 'admin', id: 1 });
      });

      connection.query.mockImplementation((query, params, callback) => {
        if (query.includes('SELECT name FROM user WHERE id = ?')) {
          callback(null, [{ name: 'testuser' }]);
        } else if (query.includes('DELETE FROM user WHERE id = ?')) {
          callback(null, { affectedRows: 1 });
        } else if (query.includes('DROP TABLE')) {
          callback(null, {});
        }
      });

      const response = await request(app)
        .post('/delete/1')
        .set('Cookie', ['token=admintoken']);

      expect(response.status).toBe(302); // Redirect to admin
      expect(connection.query).toHaveBeenCalledWith(
        'SELECT name FROM user WHERE id = ?',
        ['1'],
        expect.any(Function)
      );
    });

    it('should handle user not found', async () => {
      jwt.verify.mockImplementation((token, secret, callback) => {
        callback(null, { username: 'admin', id: 1 });
      });

      connection.query.mockImplementation((query, params, callback) => {
        if (query.includes('SELECT name FROM user WHERE id = ?')) {
          callback(null, []); // No user found
        }
      });

      const response = await request(app)
        .post('/delete/999')
        .set('Cookie', ['token=admintoken']);

      expect(response.status).toBe(302); // Redirect to admin
    });
  });

  describe('GET /logout', () => {
    it('should logout successfully', async () => {
      jwt.verify.mockImplementation((token, secret, callback) => {
        callback(null, { username: 'testuser', id: 1 });
      });

      client.del.mockImplementation((key, callback) => callback(null, 1));

      const response = await request(app)
        .get('/logout')
        .set('Cookie', ['token=mocktoken']);

      expect(response.status).toBe(302); // Redirect to home
      expect(client.del).toHaveBeenCalledWith('users', expect.any(Function));
    });
  });

  describe('Authentication Middleware', () => {
    it('should authenticate with valid token', async () => {
      jwt.verify.mockImplementation((token, secret, callback) => {
        callback(null, { username: 'testuser', id: 1 });
      });

      // Test through a protected route
      const response = await request(app)
        .get('/logout')
        .set('Cookie', ['token=validtoken']);

      expect(jwt.verify).toHaveBeenCalledWith('validtoken', expect.any(String), expect.any(Function));
    });

    it('should redirect to login without token', async () => {
      const response = await request(app)
        .get('/logout');

      expect(response.status).toBe(302); // Redirect to login
    });

    it('should refresh token when access token is invalid but refresh token is valid', async () => {
      jwt.verify.mockImplementation((token, secret, callback) => {
        if (token === 'expiredtoken') {
          callback(new Error('Token expired'), null);
        } else if (token === 'validrefreshtoken') {
          callback(null, { username: 'testuser', id: 1 });
        }
      });

      jwt.sign.mockReturnValue('newaccesstoken');

      const response = await request(app)
        .get('/logout')
        .set('Cookie', ['token=expiredtoken', 'refreshToken=validrefreshtoken']);

      expect(jwt.sign).toHaveBeenCalledWith(
        { username: 'testuser', id: 1 },
        expect.any(String),
        { expiresIn: '1m' }
      );
    });
  });
});