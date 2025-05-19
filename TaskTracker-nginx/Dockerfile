FROM node:18-slim
WORKDIR /usr/src/app
COPY ./package*.json ./
RUN apt-get update && apt-get upgrade -y && npm install
COPY . .
EXPOSE 5000
CMD ["node", "app.js"]
