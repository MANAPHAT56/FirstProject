// tests/setup.js
const redis = require('redis-mock');

// Mock Redis client
jest.mock('../redis.js', () => redis.createClient());

// Mock database connection
jest.mock('../db.js', () => ({
  query: jest.fn()
}));

// Mock bcryptjs
jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('hashedPassword'),
  compare: jest.fn().mockResolvedValue(true)
}));

// Mock jsonwebtoken
jest.mock('jsonwebtoken', () => ({
  sign: jest.fn().mockReturnValue('mockToken'),
  verify: jest.fn().mockImplementation((token, secret, callback) => {
    callback(null, { username: 'testuser', id: 1 });
  })
}));

// Mock axios
jest.mock('axios', () => ({
  post: jest.fn(),
  get: jest.fn()
}));

// Global test timeout
jest.setTimeout(10000);

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});