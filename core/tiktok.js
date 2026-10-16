// TikTok/Douyin: IP máy chủ thường bị TikTok chặn nên dùng API thay cho yt-dlp (Python đã gỡ bỏ).
// Dùng API công khai (tikwm và các endpoint dự phòng) để lấy link video.
// Owner có thể trỏ endpoint khác trong config.yml → services.tiktok_api_url.
// Hỗ trợ cookie TikTok qua config.media.tiktok_cookies / env TIKTOK_COOKIES để qua anti-bot.
const axios = require("axios");
const cheerio = require("cheerio");
const services = require("./services");

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const REQUEST_HEADERS = {
  "User-Agent": UA,
  "Accept": "application/json, text/plain, */*",
  "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
  "Referer": "https://www.tiktok.com/",
  "Origin": "https://www.tiktok.com",
  "Sec-Fetch-Dest": "empty",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Site": "cross-site"
};

const DEFAULT_API = "https://www.tikwm.com/api";

// Thử lần lượt: endpoint trong config (nếu admin tự cấu hình) → tikwm → các bản dự phòng.
// TikTok đổi API liên tục nên phải có nhiều lớp dự phòng.
const FALLBACK_APIS = [
  "https://www.tikwm.com/api",
  "https://api.tikwm.com/api",
  "https://tikwm.com/api"
];

// Chuẩn hóa short link TikTok (vt.tiktok.com, vm.tiktok.com) → URL chính thức
// theo dõi redirect. Tikwm API đôi khi không resolve được short link, nên cần
// canonical URL trước khi gọi API và fallback lấy từ trang.
async function resolveTikTokUrl(url) {
  try {
    const res = await axios.get(url, {
      timeout: 25000,
      headers: apiHeaders(),
      maxRedirects: 15,
      validateStatus: () => true,
      maxBodyLength: 5 * 1024 * 1024,
      maxContentLength: 5 * 1024 * 1024
    });
    // axios 1.x: res.config.url được cập nhật thành URL cuối cùng sau redirect
    const finalUrl =
      res.config?.url ||
      res.request?._currentUrl ||
      (res.request?.res?.responseUrl) ||
      (res.request?.res?.url) ||
      url;
    return String(finalUrl);
  } catch {
    return url;
  }
}

function loadCookies() {
  const raw = (global.config?.media?.tiktok_cookies || process.env.TIKTOK_COOKIES || "").trim();
  const out = {};
  for (const part of String(raw).split(";")) {
    const idx = part.indexOf("=");
    if (idx > 0) out[part.slice(0, idx).trim()] = part.slice(idx + 1).trim();
  }
  return out;
}

function apiHeaders(withCookie = true) {
  const headers = { ...REQUEST_HEADERS };
  if (withCookie) {
    const cookies = loadCookies();
    if (Object.keys(cookies).length) {
      headers.Cookie = Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join("; ");
    }
  }
  return headers;
}

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
async function extractTikTokPage(url) {
  const res = await axios.get(url, {
    timeout: 45000,
    headers: apiHeaders(true), // cookies TikTok để qua anti-bot
    maxRedirects: 5,
    validateStatus: () => true,
    maxBodyLength: 10 * 1024 * 1024
  });
  const html = res.data || "";
  const $ = cheerio.load(html);
  const meta = (name) => {
    const el = $(`meta[name="${name}"], meta[property="${name}"]`).first();
    return el.attr("content") || "";
  };
  const video = meta("og:video") || meta("og:video:secure_url") || meta("twitter:player") || "";
  const image = meta("og:image") || meta("twitter:image") || "";
  const title = meta("og:title") || $("title").first().text() || "TikTok video";
  if (!video && !image) throw new Error("Trang TikTok không trả media (anti-bot hoặc cần cookie)");
  return {
    title,
    author: meta("author") || "",
    duration: 0,
    videoUrl: video || "",
    thumbnail: image || "",
    platform: "tiktok",
    source: "tiktok_page"
  };
}

async function getVideoInfo(url) {
  const errors = [];
  const bases = apiChain();

  // Helper: thử gọi API chain với một URL cụ thể
  const tryApiChain = async (targetUrl) => {
    for (let attempt = 0; attempt < 2; attempt++) {
      for (const base of bases) {
        try {
          const headers = apiHeaders(attempt === 0); // lần đầu không cookie, lần sau có cookie
          const endpoint = `${base}/?url=${encodeURIComponent(targetUrl)}&hd=1`;
          const res = await axios.get(endpoint, { timeout: 45000, headers, validateStatus: () => true });

          const data = res.data?.data;
          if (res.data && (res.data.code === 0 || res.data.code === 200) && data) {
            const videoUrl = data.hdplay || data.play || data.wmplay || data.music;
            if (!videoUrl) throw new Error("Video không có link tải (có thể đã bị xoá)");

            return {
              title: data.title || "TikTok video",
              author: data.author?.nickname || "Không rõ",
              duration: Number(data.duration) || 0,
              videoUrl,
              thumbnail: data.cover || data.origin_cover || "",
              platform: "tiktok",
              source: "tiktok_api"
            };
          }
          errors.push(`${base}: ${res.data?.msg || "không có dữ liệu"}`);
        } catch (error) {
          errors.push(`${base}: ${error.message}`);
        }
      }
    }
    return null;
  };

  // 1) Thử API với URL gốc đầu tiên (tikwm đôi khi resolve được short link trực tiếp)
  const result = await tryApiChain(url);
  if (result) return result;

  // 2) Chuẩn hóa short link → canonical URL rồi thử lại
  const canonicalUrl = await resolveTikTokUrl(url);
  if (canonicalUrl !== url) {
    const result2 = await tryApiChain(canonicalUrl);
    if (result2) return result2;
  }

  // 3) API hết sức → lấy trực tiếp từ trang TikTok (og:video / twitter:player).
  try {
    return await extractTikTokPage(canonicalUrl);
  } catch (error) {
    errors.push(`trang_tiktok: ${error.message}`);
  }

  throw new Error(`Không tải được TikTok (${errors.join(" | ").slice(0, 250)})`);
}

/**
 * Kiểm tra API TikTok còn sống không (dùng cho /autodown status).
 */
async function healthCheck() {
  try {
    const base = apiChain()[0];
    const res = await axios.get(`${base}/?url=https://www.tiktok.com/@tiktok/video/7106658111903941934`, {
      timeout: 20000,
      headers: apiHeaders(),
      validateStatus: () => true
    });
    return res.data?.code === 0 || res.data?.code === 200;
  } catch {
    return false;
  }
}

module.exports = { isTikTokUrl, getVideoInfo, healthCheck, DEFAULT_API };
