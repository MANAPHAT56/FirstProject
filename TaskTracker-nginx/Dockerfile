FROM node:18-slim

# ตั้งค่า WORKDIR ให้ถูกต้อง
WORKDIR /usr/src/app

# คัดลอก package.json ก่อนเพื่อให้ npm install ทำงาน
COPY ./package*.json ./
# ติดตั้ง dependencies
RUN apt-get update && apt-get upgrade -y && npm install
# คัดลอกไฟล์ทั้งหมดจากโฟลเดอร์ TaskTracker
COPY . .

# เปิดพอร์ต 5000
EXPOSE 5000

# รันแอปพลิเคชัน
CMD ["node", "app.js"]
