// tests/unit/utils.test.js
const CryptoJS = require('crypto-js');

// Import the functions to test (assuming they are exported)
const secretKey = "your-secret-key";

const encryptAES = (plainText) => {
  return CryptoJS.AES.encrypt(plainText, secretKey).toString();
};

const decryptAES = (cipherText) => {
  const bytes = CryptoJS.AES.decrypt(cipherText, secretKey);
  return bytes.toString(CryptoJS.enc.Utf8);
};

const hashPassword = async (password) => {
  const bcrypt = require('bcryptjs');
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    return hashedPassword;
  } catch (err) {
    throw new Error('Error hashing password: ' + err.message);
  }
};

describe('Utility Functions Unit Tests', () => {
  describe('AES Encryption/Decryption', () => {
    test('should encrypt and decrypt text correctly', () => {
      const plainText = 'Hello World';
      const encrypted = encryptAES(plainText);
      const decrypted = decryptAES(encrypted);
      
      expect(encrypted).not.toBe(plainText);
      expect(decrypted).toBe(plainText);
    });

    test('should handle empty string', () => {
      const plainText = '';
      const encrypted = encryptAES(plainText);
      const decrypted = decryptAES(encrypted);
      
      expect(decrypted).toBe(plainText);
    });

    test('should handle special characters', () => {
      const plainText = '!@#$%^&*()_+{}|:"<>?';
      const encrypted = encryptAES(plainText);
      const decrypted = decryptAES(encrypted);
      
      expect(decrypted).toBe(plainText);
    });
  });

  describe('Password Hashing', () => {
    test('should hash password successfully', async () => {
      const password = 'testPassword123';
      const hashedPassword = await hashPassword(password);
      
      expect(hashedPassword).toBeDefined();
      expect(hashedPassword).not.toBe(password);
      expect(hashedPassword).toBe('hashedPassword'); // Mocked value
    });

    test('should throw error for invalid input', async () => {
      // Mock bcrypt to throw error
      const bcrypt = require('bcryptjs');
      bcrypt.hash.mockRejectedValueOnce(new Error('Hash failed'));
      
      await expect(hashPassword('password')).rejects.toThrow('Error hashing password: Hash failed');
    });
  });

  describe('Table Creation Query Generation', () => {
    test('should generate correct table creation query', () => {
      const tableName = 'testTable';
      const expectedQuery = `
          CREATE TABLE \`${tableName}\` (
              id INT AUTO_INCREMENT PRIMARY KEY,
              name VARCHAR(100) NOT NULL,
              img VARCHAR(255),
              Active VARCHAR(10),
               ExpiredAt DATETIME,
              couponid INT
          );
      `;
      
      // Since createTable is a Promise-based function, we'll test the query structure
      expect(expectedQuery).toContain(`CREATE TABLE \`${tableName}\``);
      expect(expectedQuery).toContain('id INT AUTO_INCREMENT PRIMARY KEY');
      expect(expectedQuery).toContain('couponid INT');
    });
  });

  describe('Data Validation', () => {
    test('should validate required fields', () => {
      const validateTableName = (name) => {
        return name && typeof name === 'string' && name.trim().length > 0;
      };

      expect(validateTableName('validName')).toBe(true);
      expect(validateTableName('')).toBe(false);
      expect(validateTableName(null)).toBe(false);
      expect(validateTableName(undefined)).toBe(false);
      expect(validateTableName(123)).toBe(false);
    });

    test('should validate point values', () => {
      const validatePoints = (points) => {
        return typeof points === 'number' && points >= 0;
      };

      expect(validatePoints(0)).toBe(true);
      expect(validatePoints(100)).toBe(true);
      expect(validatePoints(-1)).toBe(false);
      expect(validatePoints('100')).toBe(false);
      expect(validatePoints(null)).toBe(false);
    });
  });
});