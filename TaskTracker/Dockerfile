FROM node:18
WORKDIR /usr/src/app/TaskTracker
COPY ./TaskTracker/package.json ./
RUN npm install
COPY . .
EXPOSE 5000
CMD ["node","app.js"]