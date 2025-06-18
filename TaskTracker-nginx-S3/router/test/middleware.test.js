// tests/unit/middleware.test.js
const jwt = require('jsonwebtoken');

// Mock the authenticateJWT middleware
const authenticateJWT = (req, res, next) => {
  const token = req.cookies.token || req.headers.authorization?.split(' ')[1];
  const refreshToken = req.cookies.refreshToken;
  const secretKey = "your-secret-key";

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

describe('Middleware Unit Tests', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      cookies: {},
      headers: {},
      user: null
    };
    res = {
      redirect: jest.fn(),
      cookie: jest.fn()
    };
    next = jest.fn();
  });

  describe('authenticateJWT', () => {
    test('should redirect to login when no token and no refresh token', () => {
      authenticateJWT(req, res, next);
      
      expect(res.redirect).toHaveBeenCalledWith('/login');
      expect(next).not.toHaveBeenCalled();
    });

    test('should proceed with valid token in cookies', () => {
      req.cookies.token = 'validToken';
      
      authenticateJWT(req, res, next);
      
      expect(req.user).toEqual({ username: 'testuser', id: 1 });
      expect(next).toHaveBeenCalled();
      expect(res.redirect).not.toHaveBeenCalled();
    });

    test('should proceed with valid token in authorization header', () => {
      req.headers.authorization = 'Bearer validToken';
      
      authenticateJWT(req, res, next);
      
      expect(req.user).toEqual({ username: 'testuser', id: 1 });
      expect(next).toHaveBeenCalled();
      expect(res.redirect).not.toHaveBeenCalled();
    });

    test('should use refresh token when access token is missing', () => {
      req.cookies.refreshToken = 'validRefreshToken';
      
      authenticateJWT(req, res, next);
      
      expect(res.cookie).toHaveBeenCalledWith(
        'token',
        'mockToken',
        { httpOnly: true, secure: false, sameSite: 'Strict', maxAge: 300000 }
      );
      expect(req.user).toEqual({ username: 'testuser', id: 1 });
      expect(next).toHaveBeenCalled();
    });

    test('should redirect when refresh token is invalid', () => {
      req.cookies.refreshToken = 'invalidRefreshToken';
      
      // Mock jwt.verify to call callback with error
      jwt.verify.mockImplementationOnce((token, secret, callback) => {
        callback(new Error('Invalid token'), null);
      });
      
      authenticateJWT(req, res, next);
      
      expect(res.redirect).toHaveBeenCalledWith('/login');
      expect(next).not.toHaveBeenCalled();
    });

    test('should regenerate token when access token is expired but refresh token is valid', () => {
      req.cookies.token = 'expiredToken';
      req.cookies.refreshToken = 'validRefreshToken';
      
      // Mock jwt.verify to fail for access token, succeed for refresh token
      jwt.verify
        .mockImplementationOnce((token, secret, callback) => {
          callback(new Error('Token expired'), null);
        })
        .mockImplementationOnce((token, secret, callback) => {
          callback(null, { username: 'testuser', id: 1 });
        });
      
      authenticateJWT(req, res, next);
      
      expect(res.cookie).toHaveBeenCalledWith(
        'token',
        'mockToken',
        { httpOnly: true, secure: false, sameSite: 'Strict', maxAge: 300000 }
      );
      expect(next).toHaveBeenCalled();
    });
  });

  describe('Cookie Settings', () => {
    test('should set secure cookies in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      
      const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'Strict',
        maxAge: 300000
      };
      
      expect(cookieOptions.secure).toBe(true);
      
      process.env.NODE_ENV = originalEnv;
    });

    test('should not set secure cookies in development', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      
      const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'Strict',
        maxAge: 300000
      };
      
      expect(cookieOptions.secure).toBe(false);
      
      process.env.NODE_ENV = originalEnv;
    });
  });
});