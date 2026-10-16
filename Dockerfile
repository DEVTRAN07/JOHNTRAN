# Dockerfile cho Render/Koyeb (free) — deploy bot 24/7
FROM node:22-slim

# ffmpeg (xử lý video/nhạc) + thư viện cho canvas — pure Node.js, không dùng Python
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libcairo2 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    fonts-dejavu-core \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
# copy package.json + vendor TRƯỚC để npm ci tìm thấy zalo-client (file:vendor/zalo-client)
COPY package*.json ./
COPY vendor ./vendor
RUN rm -rf node_modules/zalo-client && (npm ci --omit=dev --no-cache || npm install --omit=dev --no-cache)
COPY . .

# Koyeb/Render/Northflank inject PORT — health server + panel tự mở đúng port đó.
# PORT=8000 là mặc định nếu nền tảng không inject (Northflank đọc từ EXPOSE).
ENV NODE_ENV=production
ENV TZ=Asia/Ho_Chi_Minh
ENV PORT=8000
EXPOSE 8000

CMD ["node", "index.js"]
