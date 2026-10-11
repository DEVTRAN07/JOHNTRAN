// TikTok/Douyin: IP máy này bị TikTok chặn nên yt-dlp không qua được (IP blocked).
// Dùng API công khai tikwm để lấy link video không watermark (owner có thể đổi endpoint trong config).
const axios = require("axios");
const services = require("./services");

const DEFAULT_API = "https://www.tikwm.com/api";

function isTikTokUrl(url) {
  return /(?:^|\.)(?:tiktok|douyin)\.com\/|vm\.tiktok\.com|vt\.tiktok\.com/.test(String(url));
}

function apiBase() {
  return services.serviceUrl("tiktok_api_url") || DEFAULT_API;
}

/**
 * Lấy thông tin video TikTok: { title, author, duration, videoUrl, thumbnail }
 */
async function getVideoInfo(url) {
  const endpoint = `${apiBase()}/?url=${encodeURIComponent(url)}&hd=1`;
  const res = await axios.get(endpoint, {
    timeout: 45000,
    headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" }
  });

  const data = res.data?.data;
  if (!res.data || (res.data.code !== 0 && res.data.code !== 200) || !data) {
    throw new Error(res.data?.msg || "Không lấy được thông tin video TikTok");
  }

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

module.exports = { isTikTokUrl, getVideoInfo, DEFAULT_API };
