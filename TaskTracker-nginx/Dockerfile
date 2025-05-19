FROM node:18-slim
RUN useradd -m appuser
WORKDIR /usr/src/app
COPY ./package*.json ./
RUN apt-get update && apt-get upgrade -y && npm install 
COPY . .
EXPOSE 5000
RUN useradd -m appuser
CMD ["node", "app.js"]
