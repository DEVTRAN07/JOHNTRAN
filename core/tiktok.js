// TikTok/Douyin: IP máy chủ thường bị TikTok chặn nên yt-dlp không qua được.
// Dùng API công khai (tikwm và các endpoint dự phòng) để lấy link video.
// Owner có thể trỏ endpoint khác trong config.yml → services.tiktok_api_url
const axios = require("axios");
const services = require("./services");

const DEFAULT_API = "https://www.tikwm.com/api";

// Thử lần lượt: endpoint trong config (nếu admin tự cấu hình) → tikwm → các bản dự phòng.
// TikTok đổi API liên tục nên phải có nhiều lớp dự phòng.
const FALLBACK_APIS = [
  "https://www.tikwm.com/api",
  "https://api.tikwm.com/api"
];

const REQUEST_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
  Accept: "application/json"
};

function isTikTokUrl(url) {
  return /(?:^|\.)(?:tiktok|douyin)\.com\/|vm\.tiktok\.com|vt\.tiktok\.com/.test(String(url));
}

function apiChain() {
  const configured = services.serviceUrl("tiktok_api_url");
  return [...new Set([configured, ...FALLBACK_APIS].filter(Boolean))];
}

/**
 * Lấy thông tin video TikTok: { title, author, duration, videoUrl, thumbnail }
 * Thử lần lượt các endpoint cho tới khi có kết quả.
 */
async function getVideoInfo(url) {
  const errors = [];

  for (const base of apiChain()) {
    try {
      const endpoint = `${base}/?url=${encodeURIComponent(url)}&hd=1`;
      const res = await axios.get(endpoint, { timeout: 45000, headers: REQUEST_HEADERS });

      const data = res.data?.data;
      if (res.data && (res.data.code === 0 || res.data.code === 200) && data) {
        const videoUrl = data.hdplay || data.play || data.wmplay || data.music;
        if (!videoUrl) throw new Error("Video không có link tải (có thể đã bị xoá)");

        return {
          title: data.title || "TikTok video",
          author: data.author?.nickname || "Không rõ",
          duration: Number(data.duration) || 0,
          videoUrl,
          thumbnail: data.cover || data.origin_cover || ""
        };
      }
      errors.push(`${base}: ${res.data?.msg || "không có dữ liệu"}`);
    } catch (error) {
      errors.push(`${base}: ${error.message}`);
    }
  }

  throw new Error(`Không tải được TikTok (${errors.join(" | ").slice(0, 180)})`);
}

/**
 * Kiểm tra API TikTok còn sống không (dùng cho /autodown status).
 */
async function healthCheck() {
  try {
    const base = apiChain()[0];
    const res = await axios.get(`${base}/?url=https://www.tiktok.com/@tiktok/video/7106658111903941934`, {
      timeout: 20000,
      headers: REQUEST_HEADERS
    });
    return res.data?.code === 0 || res.data?.code === 200;
  } catch {
    return false;
  }
}

module.exports = { isTikTokUrl, getVideoInfo, healthCheck, DEFAULT_API };
