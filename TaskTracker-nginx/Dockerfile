FROM node:18-slim
RUN useradd -m appuser
WORKDIR /usr/src/app
COPY package-lock.json package.json ./
RUN apt-get update && apt-get upgrade -y && npm ci
COPY . .
EXPOSE 5000
USER appuser
CMD ["node", "app.js"]
