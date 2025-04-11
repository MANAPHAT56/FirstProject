FROM node:18

# ตั้งค่า WORKDIR ให้ถูกต้อง
WORKDIR /usr/src/app

# คัดลอก package.json ก่อนเพื่อให้ npm install ทำงาน
COPY ./package.json ./

# ติดตั้ง dependencies
RUN npm install

# คัดลอกไฟล์ทั้งหมดจากโฟลเดอร์ TaskTracker
COPY . .

# เปิดพอร์ต 5000 
EXPOSE 3000

# รันแอปพลิเคชัน
CMD ["node", "app.js"]
