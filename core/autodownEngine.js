// =====================================================================
// AUTODOWN ENGINE — cơ chế logic hoàn toàn mới
// Không dùng yt-dlp/Python. Trích xuất link video trực tiếp từ HTML
// (og:video, twitter:player, ...), xử lý theo queue tuần tự, dedup link,
// rate limiter mỗi nhóm, circuit breaker, chỉ báo lỗi 1 lần.
// =====================================================================
const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");
const path = require("path");

const REQUEST_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7"
};

// ---------- Cấu hình ----------
const CONFIG = {
  maxConcurrent: 2,
  rateLimitMax: 4,          // tối đa link/xử lý mỗi nhóm trong cửa sổ
  rateLimitWindowMs: 5 * 60 * 1000, // 5 phút
  dedupTtlMs: 5 * 60 * 1000,      // không xử lý trùng link trong 5 phút
  circuitFailThreshold: 3,        // 3 lỗi liên tiếp → chặn nền tảng
  circuitCooldownMs: 10 * 60 * 1000, // chặn 10 phút
  maxVideoMb: 200,
  httpTimeout: 30000
};

// ---------- Trạng thái ----------
const rateState = new Map();   // threadId => { count, windowStart }
const circuitState = new Map(); // platform => { fails, blockedUntil }
const dedupMap = new Map();    // url => expiry
const queue = [];              // { url, threadId, type, api, event, resolve, reject }
let running = 0;

function now() { return Date.now(); }

// ---------- Trích xuất URL ----------
const LINK_RE = /(https?:\/\/[^\s<>"']+)/i;
function findUrlInString(text) {
  const m = String(text).match(LINK_RE);
  return m ? m[1].replace(/[.,)\]]+$/, "") : null;
}
function extractUrl(content, depth = 0) {
  if (!content || depth > 4) return null;
  if (typeof content === "string") return findUrlInString(content);
  if (typeof content !== "object") return null;
  for (const key of ["href", "url", "link", "src", "value", "thumb"]) {
    const v = content[key];
    if (typeof v === "string") { const f = findUrlInString(v); if (f) return f; }
    else if (v && typeof v === "object") { const f = extractUrl(v, depth + 1); if (f) return f; }
  }
  for (const v of Object.values(content)) {
    if (typeof v === "string") { const f = findUrlInString(v); if (f) return f; }
    else if (v && typeof v === "object") { const f = extractUrl(v, depth + 1); if (f) return f; }
  }
  return null;
}

// ---------- Phát hiện nền tảng ----------
const PLATFORMS = [
  { name: "tiktok", patterns: [/(?:^|\.)(?:tiktok|douyin)\.com\/|vm\.tiktok\.com|vt\.tiktok\.com/] },
  { name: "youtube", patterns: [/(?:^|\.)(?:youtube\.com|youtu\.be|m\.youtube\.com|music\.youtube\.com)/] },
  { name: "facebook", patterns: [/(?:^|\.)(?:facebook\.com|fb\.watch|fb\.com)/] },
  { name: "instagram", patterns: [/(?:^|\.)instagram\.com|instagr\.am/] },
  { name: "twitter", patterns: [/(?:^|\.)(?:twitter\.com|x\.com|t\.co)/] },
  { name: "vimeo", patterns: [/(?:^|\.)vimeo\.com/] },
  { name: "dailymotion", patterns: [/(?:^|\.)dailymotion\.com/] },
  { name: "bilibili", patterns: [/(?:^|\.)bilibili\.com/] },
  { name: "reddit", patterns: [/(?:^|\.)reddit\.com/] },
  { name: "capcut", patterns: [/(?:^|\.)capcut\.com/] },
  { name: "threads", patterns: [/(?:^|\.)threads\.net/] },
  { name: "pinterest", patterns: [/(?:^|\.)pinterest\.com|pin\.it/] },
  { name: "imgur", patterns: [/(?:^|\.)imgur\.com|i\.imgur\.com/] },
  { name: "soundcloud", patterns: [/(?:^|\.)soundcloud\.com|mixcloud\.com|bandcamp\.com/] }
];
function detectPlatform(url) {
  for (const p of PLATFORMS) {
    if (p.patterns.some(re => re.test(url))) return p.name;
  }
  return "generic";
}

// ---------- Trích xuất link video trực tiếp từ HTML ----------
function extractMetaMedia(html) {
  const $ = cheerio.load(html);
  const meta = (name) => {
    const el = $(`meta[name="${name}"], meta[property="${name}"]`).first();
    return el.attr("content") || "";
  };
  const video = meta("og:video") || meta("og:video:secure_url") || meta("twitter:player") || meta("twitter:image:src") || "";
  const image = meta("og:image") || meta("twitter:image") || "";
  const title = meta("og:title") || $("title").first().text() || "";
  return { video, image, title };
}

async function fetchHtml(url) {
  const res = await axios.get(url, {
    timeout: CONFIG.httpTimeout,
    headers: REQUEST_HEADERS,
    validateStatus: () => true,
    maxRedirects: 10,
    maxBodyLength: 8 * 1024 * 1024
  });
  return res.data || "";
}

async function extractDirect(url) {
  const html = await fetchHtml(url);
  const meta = extractMetaMedia(html);
  if (!meta.video && !meta.image) throw new_error("Trang không chứa video/ảnh trực tiếp");
  return {
    title: meta.title || "Media",
    author: "",
    duration: 0,
    videoUrl: meta.video || "",
    thumbnail: meta.image || "",
    platform: detectPlatform(url),
    type: meta.video ? "video" : "image",
    source: "direct_html"
  };
}

// ---------- Circuit breaker ----------
function isCircuitOpen(platform) {
  const st = circuitState.get(platform);
  if (!st) return false;
  if (now() > st.blockedUntil) { circuitState.delete(platform); return false; }
  return true;
}
function circuitFail(platform) {
  const st = circuitState.get(platform) || { fails: 0, blockedUntil: 0 };
  st.fails++;
  if (st.fails >= CONFIG.circuitFailThreshold) st.blockedUntil = now() + CONFIG.circuitCooldownMs;
  circuitState.set(platform, st);
}
function circuitReset(platform) { circuitState.delete(platform); }

// ---------- Rate limiter ----------
function checkRateLimit(threadId) {
  const t = now();
  let st = rateState.get(threadId);
  if (!st || t - st.windowStart > CONFIG.rateLimitWindowMs) {
    st = { count: 0, windowStart: t };
    rateState.set(threadId, st);
  }
  if (st.count >= CONFIG.rateLimitMax) return false;
  st.count++;
  return true;
}

// ---------- Dedup ----------
function isDeduped(url) {
  const ex = dedupMap.get(url);
  if (!ex) return false;
  if (now() > ex) { dedupMap.delete(url); return false; }
  return true;
}
function markDedup(url) { dedupMap.set(url, now() + CONFIG.dedupTtlMs); }

// ---------- Queue ----------
function enqueue(task) {
  return new Promise((resolve, reject) => {
    queue.push({ task, resolve, reject });
    processQueue();
  });
}
async function processQueue() {
  if (running >= CONFIG.maxConcurrent || queue.length === 0) return;
  running++;
  const { task, resolve, reject } = queue.shift();
  try { resolve(await task()); }
  catch (e) { reject(e); }
  finally { running--; processQueue(); }
}

// ---------- Xử lý 1 link ----------
async function processLink({ url, threadId, type, api, event }) {
  const platform = detectPlatform(url);
  if (platform === "generic") throw new_error("Nền tảng này chưa hỗ trợ");
  if (isCircuitOpen(platform)) throw new_error(`Nền tảng ${platform} đang bị chặn tạm thời`);
  if (isDeduped(url)) throw new_error("Link này vừa được xử lý, vui lòng đợi");
  markDedup(url);

  let info;
  try {
    info = await extractDirect(url);
    circuitReset(platform);
  } catch (e) {
    circuitFail(platform);
    throw e;
  }

  return { info, platform };
}

// ---------- API công khai ----------
module.exports = {
  extractUrl,
  detectPlatform,
  extractDirect,
  isCircuitOpen,
  circuitFail,
  circuitReset,
  checkRateLimit,
  isDeduped,
  markDedup,
  enqueue,
  processLink,
  CONFIG
};

function new_error(msg) { const e = new Error(msg); e.isAutodown = true; return e; }
