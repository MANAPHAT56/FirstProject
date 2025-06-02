jest.mock('../../db', () => ({
  query: jest.fn(),
}));  // Mock `query` ของ db module

jest.mock('../../redis.js', () => ({
  on: jest.fn(),
  get: jest.fn(),
  set: jest.fn(),
}));
// hashPassword.test.js (ไฟล์ทดสอบ)
const bcrypt = require('bcryptjs');
const hashPassword = require('../router'); // เปลี่ยนเส้นทางตามที่ตั้งของไฟล์

jest.mock('bcryptjs');  // Mock bcrypt เพื่อไม่ให้ทดสอบการเข้ารหัสจริงๆ

describe('hashPassword function', () => {
  it('should hash the password successfully', async () => {
    const password = 'myPassword123';
    const mockHashedPassword = '$2a$10$xyz...'; // Mock ค่า hash ที่คาดว่าจะได้รับจาก bcrypt

    // Mock bcrypt.hash ให้ return mockHashedPassword
    bcrypt.hash.mockResolvedValue(mockHashedPassword);

    const result = await hashPassword(password);

    // คาดหวังว่าผลลัพธ์จะตรงกับค่า hash ที่ mock ไว้
    expect(result).toBe(mockHashedPassword);
    expect(bcrypt.hash).toHaveBeenCalledWith(password, 10);  // ตรวจสอบว่าเรียก bcrypt.hash ด้วยพารามิเตอร์ที่ถูกต้อง
  });

  it('should throw an error if bcrypt.hash fails', async () => {
    const password = 'myPassword123';
    const mockError = new Error('bcrypt error');
    
    // Mock bcrypt.hash ให้เกิดข้อผิดพลาด
    bcrypt.hash.mockRejectedValue(mockError);

    try {
      await hashPassword(password);
    } catch (error) {
      // คาดหวังให้ error เป็นข้อผิดพลาดที่เราทำการ mock ไว้
      expect(error.message).toBe('Error hashing password: bcrypt error');
    }
  });
});
