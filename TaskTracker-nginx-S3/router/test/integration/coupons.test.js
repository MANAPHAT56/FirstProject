// tests/integration/coupons.test.js
const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');
const connection = require('../../../db.js');
const client = require('../../../redis.js');

// Create test app
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Mock router (import your actual router2)
const router2 = require('../../../router2.js');
app.use('/', router2);

describe('Coupon System Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /coupons', () => {
    test('should get coupons from cache', async () => {
      const mockStores = [
        { id: 1, name: 'Store 1', description: 'Test store 1' },
        { id: 2, name: 'Store 2', description: 'Test store 2' }
      ];

      client.get.mockResolvedValue(JSON.stringify(mockStores));

      const response = await request(app)
        .get('/coupons')
        .set('Cookie', ['token=validToken']);

      expect(response.status).toBe(200);
      expect(client.get).toHaveBeenCalledWith('coupons');
    });

    test('should get coupons from database when cache is empty', async () => {
      const mockStores = [
        { id: 1, name: 'Store 1', description: 'Test store 1' }
      ];

      client.get.mockResolvedValue(null);
      connection.query.mockImplementation((query, callback) => {
        if (query.includes('SELECT * FROM stores')) {
          callback(null, mockStores);
        }
      });

      const response = await request(app)
        .get('/coupons')
        .set('Cookie', ['token=validToken']);

      expect(response.status).toBe(200);
      expect(client.setEx).toHaveBeenCalledWith('coupons', 3600, JSON.stringify(mockStores));
    });
  });

  describe('POST /redeem-coupon', () => {
    test('should redeem coupon successfully', async () => {
      const mockCoupon = [{ P_required: 100 }];
      const mockUser = [{ point: 150 }];

      connection.query
        .mockImplementationOnce((query, params, callback) => {
          if (query.includes('SELECT P_required FROM coupons')) {
            callback(null, mockCoupon);
          }
        })
        .mockImplementationOnce((query, params, callback) => {
          if (query.includes('SELECT point FROM user')) {
            callback(null, mockUser);
          }
        })
        .mockImplementationOnce((query, params, callback) => {
          if (query.includes('UPDATE user SET point')) {
            callback(null, { affectedRows: 1 });
          }
        })
        .mockImplementationOnce((query, params, callback) => {
          if (query.includes('INSERT INTO')) {
            callback(null, { insertId: 1 });
          }
        });

      const response = await request(app)
        .post('/redeem-coupon')
        .set('Cookie', ['token=validToken'])
        .send({
          couponId: 1,
          couponImg: 'test.jpg',
          couponName: 'Test Coupon'
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Exchange Coupon SUCCESSFUL');
      expect(client.del).toHaveBeenCalledWith('point');
      expect(client.del).toHaveBeenCalledWith('users');
    });

    test('should fail when user has insufficient points', async () => {
      const mockCoupon = [{ P_required: 200 }];
      const mockUser = [{ point: 50 }];

      connection.query
        .mockImplementationOnce((query, params, callback) => {
          if (query.includes('SELECT P_required FROM coupons')) {
            callback(null, mockCoupon);
          }
        })
        .mockImplementationOnce((query, params, callback) => {
          if (query.includes('SELECT point FROM user')) {
            callback(null, mockUser);
          }
        });

      const response = await request(app)
        .post('/redeem-coupon')
        .set('Cookie', ['token=validToken'])
        .send({
          couponId: 1,
          couponImg: 'test.jpg',
          couponName: 'Test Coupon'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Your point is not enough');
    });

    test('should fail when coupon not found', async () => {
      connection.query.mockImplementation((query, params, callback) => {
        if (query.includes('SELECT P_required FROM coupons')) {
          callback(null, []);
        }
      });

      const response = await request(app)
        .post('/redeem-coupon')
        .set('Cookie', ['token=validToken'])
        .send({
          couponId: 999,
          couponImg: 'test.jpg',
          couponName: 'Nonexistent Coupon'
        });

      expect(response.status).toBe(400);
      expect(response.text).toBe('Coupon not found');
    });
  });

  describe('POST /usecoupon/:id', () => {
    test('should activate coupon with new expiration', async () => {
      connection.query
        .mockImplementationOnce((query, params, callback) => {
          if (query.includes('SELECT ExpiredAt FROM')) {
            callback(null, [{ ExpiredAt: null }]);
          }
        })
        .mockImplementationOnce((query, params, callback) => {
          if (query.includes('UPDATE') && query.includes('SET ExpiredAt')) {
            callback(null, { affectedRows: 1 });
          }
        });

      const response = await request(app)
        .post('/usecoupon/1')
        .set('Cookie', ['token=validToken']);

      expect(response.status).toBe(200);
      expect(client.del).toHaveBeenCalledWith('users');
    });

    test('should activate coupon with existing expiration', async () => {
      const existingExpiration = new Date(Date.now() + 2 * 60 * 1000);
      
      connection.query
        .mockImplementationOnce((query, params, callback) => {
          if (query.includes('SELECT ExpiredAt FROM')) {
            callback(null, [{ ExpiredAt: existingExpiration }]);
          }
        })
        .mockImplementationOnce((query, params, callback) => {
          if (query.includes('UPDATE') && query.includes('SET ExpiredAt')) {
            callback(null, { affectedRows: 1 });
          }
        });

      const response = await request(app)
        .post('/usecoupon/1')
        .set('Cookie', ['token=validToken']);

      expect(response.status).toBe(200);
    });
  });

  describe('POST /deletecoupon/:id', () => {
    test('should delete coupon successfully', async () => {
      connection.query.mockImplementation((query, callback) => {
        if (query.includes('DELETE FROM')) {
          callback(null, { affectedRows: 1 });
        }
      });

      const response = await request(app)
        .post('/deletecoupon/1')
        .set('Cookie', ['token=validToken']);

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('/tasks');
      expect(client.del).toHaveBeenCalledWith('users');
    });

    test('should handle delete error', async () => {
      connection.query.mockImplementation((query, callback) => {
        if (query.includes('DELETE FROM')) {
          callback(new Error('Database error'));
        }
      });

      const response = await request(app)
        .post('/deletecoupon/1')
        .set('Cookie', ['token=validToken']);

      expect(response.status).toBe(500);
      expect(response.text).toBe('เกิดข้อผิดพลาดในการลบคูปอง.');
    });
});
  describe('POST /reward', () => {
    test('should reward points successfully', async () => {
      const mockUser = [{ point: 50 }];

      connection.query
        .mockImplementationOnce((query, params, callback) => {
          if (query.includes('SELECT point FROM user')) {
            callback(null, mockUser);
          }
        })
        .mockImplementationOnce((query, params, callback) => {
          if (query.includes('UPDATE user SET point')) {
            callback(null, { affectedRows: 1 });
          }
        });

      const response = await request(app)
        .post('/reward')
        .set('Cookie', ['token=validToken'])
        .send({ point: 10 });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Reward successful');
      expect(response.body.newPoint).toBe(60);
      expect(client.del).toHaveBeenCalledWith('point');
    });

    test('should handle reward error', async () => {
      connection.query.mockImplementation((query, callback) => {
        if (query.includes('SELECT point FROM user')) {
          callback(new Error('Database error'));
        }
      });

      const response = await request(app)
        .post('/reward')
        .set('Cookie', ['token=validToken'])
        .send({ point: 10 });

      expect(response.status).toBe(500);
      expect(response.text).toBe('เกิดข้อผิดพลาดในการให้รางวัล.');
    });
  });
}
    );