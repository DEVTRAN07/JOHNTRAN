// =====================================================================
// MEDIA EXTRACTOR — trung tâm phát hiện nền tảng + pipeline trích xuất
// Cơ chế: yt-dlp (chính) → API công khai (dự phòng) → HTML meta (cuối cùng)
// =====================================================================
const axios = require("axios");
const cheerio = require("cheerio");
const ytdlp = require("./mediaDownloader");
const tiktokApi = require("./tiktok");

const REQUEST_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7"
};

// ===== Registry nền tảng (regex + độ ưu tiên) =====
const PLATFORMS = [
  { name: "tiktok",     patterns: [/(?:^|\.)(?:tiktok|douyin)\.com\/|vm\.tiktok\.com|vt\.tiktok\.com/], priority: 12 },
  { name: "youtube",    patterns: [/(?:^|\.)(?:youtube\.com|youtu\.be|m\.youtube\.com|music\.youtube\.com)/], priority: 12 },
  { name: "facebook",   patterns: [/(?:^|\.)(?:facebook\.com|fb\.watch|fb\.com)/], priority: 11 },
  { name: "instagram",  patterns: [/(?:^|\.)instagram\.com|instagr\.am/], priority: 11 },
  { name: "twitter",    patterns: [/(?:^|\.)(?:twitter\.com|x\.com|t\.co)/], priority: 10 },
  { name: "vimeo",      patterns: [/(?:^|\.)vimeo\.com/], priority: 9 },
  { name: "dailymotion",patterns: [/(?:^|\.)dailymotion\.com/], priority: 9 },
  { name: "bilibili",   patterns: [/(?:^|\.)bilibili\.com/], priority: 9 },
  { name: "reddit",     patterns: [/(?:^|\.)reddit\.com/], priority: 9 },
  { name: "capcut",     patterns: [/(?:^|\.)capcut\.com/], priority: 8 },
  { name: "threads",    patterns: [/(?:^|\.)threads\.net/], priority: 8 },
  { name: "pinterest",  patterns: [/(?:^|\.)pinterest\.com|pin\.it/], priority: 8 },
  { name: "imgur",      patterns: [/(?:^|\.)imgur\.com|i\.imgur\.com/], priority: 7 },
  { name: "soundcloud", patterns: [/(?:^|\.)soundcloud\.com|mixcloud\.com|bandcamp\.com/], priority: 7 },
  { name: "spotify",    patterns: [/(?:^|\.)spotify\.com|open\.spotify\.com/], priority: 6 },
  { name: "zingmp3",    patterns: [/(?:^|\.)zingmp3\.vn|zing\.mp3\.vn/], priority: 6 }
];

function detectPlatform(url) {
  const sorted = [...PLATFORMS].sort((a, b) => b.priority - a.priority);
  for (const p of sorted) {
    if (p.patterns.some(re => re.test(url))) return p.name;
  }
  return "generic";
}

// ===== Trích xuất từ HTML meta (og:video / twitter:player) =====
function extractMetaMedia(html) {
  const $ = cheerio.load(html);
  const meta = (name) => {
    const el = $(`meta[name="${name}"], meta[property="${name}"]`).first();
    return el.attr("content") || "";
  };
  const video = meta("og:video") || meta("og:video:secure_url") || meta("twitter:player") || "";
  const image = meta("og:image") || meta("twitter:image") || "";
  const title = meta("og:title") || $("title").first().text() || "";
  return { video, image, title };
}

async function fetchHtml(url) {
  const res = await axios.get(url, {
    timeout: 30000,
    headers: REQUEST_HEADERS,
    validateStatus: () => true,
    maxRedirects: 5,
    maxBodyLength: 10 * 1024 * 1024
  });
  return res.data || "";
}

// ===== Chiến lược 1: yt-dlp (chính) =====
async function extractViaYtDlp(url) {
  const info = await ytdlp.getMediaInfo(url);
  if (!info) return null;
  return {
    title: info.title || "Media",
    author: info.uploader || info.channel || info.author || "",
    duration: Number(info.duration) || 0,
    videoUrl: info.url || "",
    thumbnail: info.thumbnail || "",
    platform: detectPlatform(url),
    type: ytdlp.isAudioOnly(info) ? "audio" : "video",
    source: "yt-dlp"
  };
}

// ===== Chiến lược 2: API công khai (dự phòng) =====
async function extractViaApi(url) {
  if (detectPlatform(url) === "tiktok") {
    try {
      const info = await tiktokApi.getVideoInfo(url);
      return {
        title: info.title || "TikTok video",
        author: info.author || "Không rõ",
        duration: Number(info.duration) || 0,
        videoUrl: info.videoUrl || "",
        thumbnail: info.thumbnail || "",
        platform: "tiktok",
        type: "video",
        source: "tiktok_api"
      };
    } catch { /* rơi xuống chiến lược sau */ }
  }
  return null;
}

// ===== Chiến lược 3: HTML meta (cuối cùng) =====
async function extractViaHtml(url) {
  const html = await fetchHtml(url);
  const meta = extractMetaMedia(html);
  if (!meta.video && !meta.image) return null;
  return {
    title: meta.title || "Media",
    author: "",
    duration: 0,
    videoUrl: meta.video || "",
    thumbnail: meta.image || "",
    platform: detectPlatform(url),
    type: meta.video ? "video" : "image",
    source: "html_meta"
  };
}

// ===== Pipeline: thử lần lượt cho tới khi có kết quả =====
const STRATEGIES = [
  { name: "yt-dlp",   fn: (url) => extractViaYtDlp(url) },
  { name: "api",      fn: (url) => extractViaApi(url) },
  { name: "html_meta",fn: (url) => extractViaHtml(url) }
];

async function extractMedia(url) {
  const errors = [];
  for (const { name, fn } of STRATEGIES) {
    try {
      const result = await fn(url);
      if (result && result.videoUrl) return result;
      if (result) errors.push(`${name}: không có videoUrl`);
    } catch (error) {
      errors.push(`${name}: ${error.message}`);
    }
  }
  throw new Error(`Không trích xuất được media (${errors.join(" | ").slice(0, 200)})`);
}

module.exports = { extractMedia, detectPlatform, extractMetaMedia, fetchHtml };
