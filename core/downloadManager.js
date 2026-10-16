// =====================================================================
// DOWNLOAD MANAGER — tải media với cache TTL + hàng đợi đồng thời
// Tránh tải lại cùng 1 link trong khoảng TTL, kiểm soát số luồng tải.
// =====================================================================
const fs = require("fs");
const path = require("path");
const ytdlp = require("./mediaDownloader");

const CACHE_TTL = 10 * 60 * 1000; // 10 phút
const MAX_CONCURRENT = 3;

const cache = new Map(); // url => { info, filePath, expiry }
const queue = [];
let running = 0;

function cleanupFile(filePath) {
  try { if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch { /* bỏ qua */ }
}

function isCached(url) {
  const entry = cache.get(url);
  if (!entry) return null;
  if (Date.now() > entry.expiry) {
    cache.delete(url);
    cleanupFile(entry.filePath);
    return null;
  }
  return entry;
}

function setCache(url, info, filePath) {
  cache.set(url, { info, filePath, expiry: Date.now() + CACHE_TTL });
}

function clearCache() {
  for (const [, entry] of cache) cleanupFile(entry.filePath);
  cache.clear();
}

function getCacheStats() {
  return { size: cache.size, running, queued: queue.length };
}

function enqueue(task) {
  return new Promise((resolve, reject) => {
    queue.push({ task, resolve, reject });
    processQueue();
  });
}

async function processQueue() {
  if (running >= MAX_CONCURRENT || queue.length === 0) return;
  running++;
  const { task, resolve, reject } = queue.shift();
  try {
    const result = await task();
    resolve(result);
  } catch (error) {
    reject(error);
  } finally {
    running--;
    processQueue();
  }
}

// Tải 1 media (video hoặc audio) → { info, filePath, fromCache }
async function downloadMedia(url, outputDir) {
  const cached = isCached(url);
  if (cached) {
    return { info: cached.info, filePath: cached.filePath, fromCache: true };
  }

  const info = await ytdlp.getMediaInfo(url);
  if (!info) throw new Error("Không lấy được thông tin media");

  const ext = ytdlp.isAudioOnly(info) ? "mp3" : "mp4";
  const filePath = path.join(outputDir, `dl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`);

  if (ytdlp.isAudioOnly(info)) {
    await ytdlp.downloadAudio(url, filePath);
  } else {
    await ytdlp.downloadVideo(url, filePath);
  }

  setCache(url, info, filePath);
  return { info, filePath, fromCache: false };
}

module.exports = { downloadMedia, clearCache, getCacheStats, enqueue, isCached };
