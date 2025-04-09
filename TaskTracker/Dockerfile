FROM node:18
WORKDIR /use/src/app 
COPY ./TaskTracker/package.json ./
RUN npm install
COPY . .
EXPOSE 5000
CMD ["node","app.js"]