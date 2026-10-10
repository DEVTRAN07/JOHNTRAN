# Dockerfile cho Koyeb / Railway / Fly.io / bất kỳ nền tảng nào cần container
FROM node:20-slim

# canvas + ffmpeg-static cần thư viện hệ thống
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
COPY package*.json ./
RUN npm ci --omit=dev || npm install --omit=dev
COPY . .

# Render/Koyeb/Heroku tự inject PORT — health server sẽ mở đúng port đó
ENV NODE_ENV=production
ENV TZ=Asia/Ho_Chi_Minh
EXPOSE 3000

CMD ["node", "index.js"]
