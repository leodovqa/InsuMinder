FROM node:20-bookworm-slim

WORKDIR /app

RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install
RUN npm rebuild sqlite3 --build-from-source

COPY . .

EXPOSE 5000

ENV PORT=5000
ENV DB_PATH=/app/data/insuminder.db

CMD ["node", "--watch", "src/index.js"]
