FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY . .
# TZ: cron schedules in .env are New Zealand times
ENV PORT=3040 DB_PATH=/app/data/seo-desk.sqlite TZ=Pacific/Auckland
EXPOSE 3040
CMD ["node", "--no-warnings", "src/server.js"]
