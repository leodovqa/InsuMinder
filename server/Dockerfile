FROM node:20-bookworm-slim

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 5000

ENV PORT=5000
ENV DB_PATH=/app/data/insuminder.db

CMD ["node", "src/index.js"]

