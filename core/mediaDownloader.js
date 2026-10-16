// Tải media pure JS (không dùng yt-dlp/Python).
// Trích xuất link video/ảnh trực tiếp từ trang của nền tảng qua axios + cheerio
// + parse JSON nhúng trong HTML (Facebook/Instagram/Twitter) và YouTube innertube.
const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");
const path = require("path");
const tiktokApi = require("./tiktok");
const services = require("./services");

const REQUEST_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
  "Accept": "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8"
};

const DOWNLOAD_TIMEOUT = 180000;
const MAX_VIDEO_BYTES = Number(process.env.JT_MAX_VIDEO_MB || 200) * 1024 * 1024;

const YT_INNERTUBE = "https://www.youtube.com/youtubei/v1/player";
const YT_CLIENT = { clientName: "WEB", clientVersion: "2.20240101.00.0" };

function isTikTokUrl(url) {
  return /(?:^|\.)(?:tiktok|douyin)\.com\/|vm\.tiktok\.com|vt\.tiktok\.com/.test(String(url));
}

function isYouTubeUrl(url) {
  return /(?:^|\.)(?:youtube\.com|youtu\.be|m\.youtube\.com|music\.youtube\.com)/.test(String(url));
}

function isFacebookUrl(url) {
  return /(?:^|\.)(?:facebook\.com|fb\.watch|fb\.com)/.test(String(url));
}

function isInstagramUrl(url) {
  return /(?:^|\.)(?:instagram\.com|instagr\.am)/.test(String(url));
}

function isTwitterUrl(url) {
  return /(?:^|\.)(?:twitter\.com|x\.com)/.test(String(url));
}

async function fetchHtml(url, timeout = 45000) {
  const res = await axios.get(url, { timeout, headers: REQUEST_HEADERS, maxRedirects: 5, validateStatus: () => true });
  return res.data || "";
}

// Parse JSON nhúng trong HTML: window._sharedData, ytInitialPlayerResponse, v.v.
function extractJson(html, key) {
  const patterns = [
    new RegExp(`${key}\\s*[:=]\\s*(\\{.*?\\});?`, "s"),
    new RegExp(`"${key}"\\s*:\\s*(\\{.*?\\})`, "s")
  ];
  for (const pat of patterns) {
    const m = html.match(pat);
    if (m) {
      try { return JSON.parse(m[1]); } catch { /* thử pattern khác */ }
    }
  }
  return null;
}

// Trích xuất media từ thẻ meta (og:video, twitter:player, og:image, v.v.)
function extractMetaMedia(html) {
  const $ = cheerio.load(html);
  const meta = (name) => {
    const el = $(`meta[name="${name}"], meta[property="${name}"]`).first();
    return el.attr("content") || "";
  };
  const video = meta("og:video") || meta("og:video:secure_url") || meta("twitter:player") || meta("twitter:image:src");
  const image = meta("og:image") || meta("twitter:image") || "";
  const title = meta("og:title") || $("title").first().text() || "";
  const author = meta("og:site_name") || meta("author") || "";
  return { video, image, title, author };
}

// Lấy thời lượng đơn giản từ meta (giây), nếu có
function parseDurationFromMeta(html) {
  const m = html.match(/duration["']?\s*[:=]\s*["']?(\d+)/i);
  return m ? parseInt(m[1], 10) : 0;
}

// Tìm URL video trong chuỗi HTML/JSON (mp4, mov, m3u8, v.v.)
function findVideoUrls(text) {
  const urls = [];
  const seen = new Set();
  const push = (u) => {
    if (!u || seen.has(u)) return;
    seen.add(u);
    urls.push(u);
  };
  // URL trực tiếp kết thúc bằng phần mở rộng video
  const re = /https?:\/\/[^"'<>\\\s]+\.(?:mp4|mov|m3u8|mpd)(?:[?#][^"'<>\\\s]*)?/gi;
  let m;
  while ((m = re.exec(text)) !== null) push(m[0]);
  // playable_url / video_url trong JSON
  const re2 = /(?:playable_url|video_url|stream_url|src|url)\s*:\s*"([^"]+\.(?:mp4|mov|m3u8|mpd)[^"]*)"/gi;
  while ((m = re2.exec(text)) !== null) push(m[1]);
  return urls;
}

// ===== TikTok/Douyin → core/tiktok.js =====
async function extractTikTok(url) {
  const info = await tiktokApi.getVideoInfo(url);
  return {
    title: info.title || "TikTok video",
    author: info.author || "Không rõ",
    duration: Number(info.duration) || 0,
    videoUrl: info.videoUrl,
    thumbnail: info.thumbnail || "",
    platform: "tiktok",
    source: "tiktok_api"
  };
}

// ===== Facebook Reels / Watch / Video =====
async function extractFacebook(url) {
  const html = await fetchHtml(url);
  const meta = extractMetaMedia(html);

  // 1) video URL trực tiếp từ meta og:video
  let videoUrl = meta.video || "";

  // 2) parse JSON nhúng trong HTML (Facebook nhúng video URL vào page data)
  if (!videoUrl) {
    const data = extractJson(html, "__INITIAL_STATE__") || extractJson(html, "initial_data") || {};
    const walk = (obj) => {
      if (videoUrl) return;
      if (typeof obj === "string") {
        const found = findVideoUrls(obj);
        if (found.length) videoUrl = found[0];
        return;
      }
      if (Array.isArray(obj)) { obj.forEach(walk); return; }
      if (obj && typeof obj === "object") {
        Object.values(obj).forEach(walk);
      }
    };
    walk(data);
  }

  // 3) quét toàn bộ HTML tìm link .mp4/.m3u8
  if (!videoUrl) {
    const found = findVideoUrls(html);
    if (found.length) videoUrl = found[0];
  }

  if (!videoUrl && !meta.image) throw new Error("Facebook không trích xuất được video (trang có thể yêu cầu đăng nhập hoặc cần cookie)");

  return {
    title: meta.title || "Facebook video",
    author: meta.author || "",
    duration: parseDurationFromMeta(html),
    videoUrl,
    image: meta.image || "",
    thumbnail: meta.image || "",
    platform: "facebook",
    source: videoUrl ? "facebook_html" : "meta_tags"
  };
}

// ===== Instagram Reels / Post =====
async function extractInstagram(url) {
  const html = await fetchHtml(url);
  const meta = extractMetaMedia(html);

  let videoUrl = meta.video || "";

  // Instagram nhúng _sharedData với shortcode_media.video_url
  if (!videoUrl) {
    const shared = extractJson(html, "_sharedData");
    if (shared) {
      const walk = (obj) => {
        if (videoUrl) return;
        if (typeof obj === "string") {
          const found = findVideoUrls(obj);
          if (found.length) videoUrl = found[0];
          return;
        }
        if (Array.isArray(obj)) { obj.forEach(walk); return; }
        if (obj && typeof obj === "object") Object.values(obj).forEach(walk);
      };
      walk(shared);
    }
  }

  if (!videoUrl) {
    const found = findVideoUrls(html);
    if (found.length) videoUrl = found[0];
  }

  if (!videoUrl && !meta.image) throw new Error("Instagram không trích xuất được video (có thể cần đăng nhập hoặc video riêng tư)");

  return {
    title: meta.title || "Instagram video",
    author: meta.author || "",
    duration: parseDurationFromMeta(html),
    videoUrl,
    image: meta.image || "",
    thumbnail: meta.image || "",
    platform: "instagram",
    source: videoUrl ? "instagram_html" : "meta_tags"
  };
}

// ===== Twitter/X video =====
async function extractTwitter(url) {
  const html = await fetchHtml(url);
  const meta = extractMetaMedia(html);

  let videoUrl = meta.video || "";

  if (!videoUrl) {
    const found = findVideoUrls(html);
    if (found.length) videoUrl = found[0];
  }

  if (!videoUrl && !meta.image) throw new Error("Twitter/X không trích xuất được video");

  return {
    title: meta.title || "Twitter video",
    author: meta.author || "",
    duration: parseDurationFromMeta(html),
    videoUrl,
    image: meta.image || "",
    thumbnail: meta.image || "",
    platform: "twitter",
    source: videoUrl ? "twitter_html" : "meta_tags"
  };
}

// ===== YouTube → innertube player API =====
async function extractYouTube(url) {
  const videoIdMatch = String(url).match(/(?:v=|be\/|embed\/|shorts\/)([0-9A-Za-z_-]{6,})/);
  if (!videoIdMatch) throw new Error("Không nhận diện được video ID YouTube");
  const videoId = videoIdMatch[1];

  try {
    const res = await axios.post(
      YT_INNERTUBE,
      { videoId, context: { client: YT_CLIENT } },
      {
        timeout: 45000,
        headers: { ...REQUEST_HEADERS, "Content-Type": "application/json", "X-YouTube-Client-Name": "1", "X-YouTube-Client-Version": YT_CLIENT.clientVersion },
        validateStatus: () => true
      }
    );
    const data = res.data || {};
    const streaming = data.streamingData || {};
    const formats = [...(streaming.adaptiveFormats || []), ...(streaming.formats || [])];

    let best = null;
    for (const f of formats) {
      if (!f.url) continue;
      if (f.mimeType && /video\//.test(f.mimeType) && (!best || (f.height || 0) > (best.height || 0))) {
        best = f;
      }
    }
    if (!best) {
      for (const f of formats) {
        if (f.url && f.mimeType && /audio\//.test(f.mimeType)) { best = f; break; }
      }
    }
    if (!best) throw new Error("YouTube không trả định dạng trực tiếp (có thể cần cookie hoặc media_downloader_url)");

    const title = (data.videoDetails || {}).title || "YouTube video";
    const author = (data.videoDetails || {}).author || "Không rõ";
    const duration = parseInt((data.videoDetails || {}).lengthSeconds || "0", 10);
    const thumbnail = `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;

    return { title, author, duration, videoUrl: best.url, thumbnail, platform: "youtube", source: "innertube" };
  } catch (error) {
    if (error.response && error.response.status === 403) {
      throw new Error("YouTube chặn yêu cầu (cần cookie hoặc media_downloader_url)");
    }
    throw error;
  }
}

// ===== Generic fallback (mọi trang khác) =====
async function extractGeneric(url) {
  const html = await fetchHtml(url);
  const meta = extractMetaMedia(html);
  if (!meta.video && !meta.image) throw new Error("Không trích xuất được media từ link này");
  return {
    title: meta.title || "Media",
    author: meta.author || "",
    duration: parseDurationFromMeta(html),
    videoUrl: meta.video || "",
    image: meta.image || "",
    thumbnail: meta.image || "",
    platform: "generic",
    source: "meta_tags"
  };
}

// ===== Trung tâm lấy thông tin media =====
async function getMediaInfo(url) {
  if (isTikTokUrl(url)) return extractTikTok(url);
  if (isYouTubeUrl(url)) return extractYouTube(url);
  if (isFacebookUrl(url)) return extractFacebook(url);
  if (isInstagramUrl(url)) return extractInstagram(url);
  if (isTwitterUrl(url)) return extractTwitter(url);
  return extractGeneric(url);
}

// ===== Tải file về máy (dùng cho video/ảnh/thumbnail) =====
async function downloadToFile(url, outputPath, timeout = DOWNLOAD_TIMEOUT) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  const res = await axios.get(url, {
    responseType: "stream",
    timeout,
    headers: REQUEST_HEADERS,
    maxRedirects: 5,
    validateStatus: (status) => status < 400
  });
  if (!res.data) throw new Error("Phản hồi tải về rỗng");
  const writer = fs.createWriteStream(outputPath);
  res.data.pipe(writer);
  await new Promise((resolve, reject) => {
    writer.on("finish", resolve);
    writer.on("error", reject);
  });
  if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size === 0) {
    throw new Error("File tải về rỗng");
  }
  return outputPath;
}

function videoTooBig(filePath) {
  try {
    return fs.existsSync(filePath) && fs.statSync(filePath).size > MAX_VIDEO_BYTES;
  } catch {
    return false;
  }
}

function removeQuietly(filePath) {
  try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch { /* bỏ qua */ }
}

// ===== Tải video =====
async function downloadVideo(url, outputPath) {
  const info = await getMediaInfo(url);
  if (!info) throw new Error("Không lấy được thông tin media");
  const mediaUrl = info.videoUrl || info.image || "";
  if (!mediaUrl) throw new Error("Trang này không có link video/ảnh trực tiếp");

  await downloadToFile(mediaUrl, outputPath);
  if (videoTooBig(outputPath)) {
    removeQuietly(outputPath);
    throw new Error(`Video quá lớn (vượt ${Math.round(MAX_VIDEO_BYTES / 1048576)}MB — giới hạn Zalo). Hãy dùng media_downloader_url hoặc video ngắn hơn.`);
  }
  return outputPath;
}

// ===== Tải âm thanh (mp3) =====
async function downloadAudio(url, outputPath) {
  const info = await getMediaInfo(url);
  if (!info) throw new Error("Không lấy được thông tin media");
  const mediaUrl = info.videoUrl || info.image || "";
  if (!mediaUrl) throw new Error("Trang này không có link âm thanh/video trực tiếp");

  await downloadToFile(mediaUrl, outputPath);
  if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size === 0) {
    throw new Error("Tải âm thanh về rỗng");
  }
  return outputPath;
}

function isAudioOnly(info) {
  if (!info) return true;
  if (info.videoUrl) return false;
  if (info.image && !info.videoUrl) return true;
  return false;
}

function describe(info) {
  const meta = [];
  if (info.title) meta.push(`Title: ${info.title}`);
  if (info.author) meta.push(`Author: ${info.author}`);
  if (info.duration) {
    const m = Math.floor(info.duration / 60);
    const s = Math.floor(info.duration % 60);
    meta.push(`Thời lượng: ${m}:${String(s).padStart(2, "0")}`);
  }
  if (info.platform) meta.push(`Nguồn: ${info.platform}`);
  if (info.source) meta.push(`Cách lấy: ${info.source}`);
  return meta;
}

// yt-dlp (Python) đã gỡ bỏ → luôn false. Dùng jsDownloaderAvailable() thay thế.
async function ytDlpAvailable() {
  return false;
}

async function supportsImpersonate() {
  return false;
}

// Downloader pure JS luôn sẵn sàng (chỉ cần axios/cheerio đã có trong package.json).
async function jsDownloaderAvailable() {
  return true;
}

module.exports = {
  ytDlpAvailable,
  supportsImpersonate,
  jsDownloaderAvailable,
  getMediaInfo,
  downloadVideo,
  downloadAudio,
  isAudioOnly,
  describe,
  fetchHtml,
  extractMetaMedia,
  findVideoUrls,
  extractFacebook,
  extractInstagram,
  extractTwitter,
  extractYouTube,
  extractTikTok,
  extractGeneric
};
