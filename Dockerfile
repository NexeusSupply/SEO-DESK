FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY . .
ENV PORT=3040 DB_PATH=/app/data/seo-desk.sqlite
EXPOSE 3040
CMD ["node", "--no-warnings", "src/server.js"]
