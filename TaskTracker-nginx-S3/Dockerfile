FROM node:18-slim

RUN useradd -m appuser
WORKDIR /usr/src/app

COPY ./package*.json ./

RUN apt-get update && apt-get upgrade -y && \
    npm ci --only=production && \
    npm install tar-fs@2.1.3 express@latest cross-spawn@latest && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

COPY . .

EXPOSE 5000
USER appuser

CMD ["node", "app.js"]