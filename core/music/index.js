const fs = require("fs");
const path = require("path");
const http = require("../http");
const db = require("../../utils/db");
const { caches } = require("../cache");

const providers = new Map();

// ===== CACHE KẾT QUẢ (dùng LRUCache chung từ core/cache.js) =====
// SoundCloud/Zalo API chậm (~0.5-1s/call). Tìm lại cùng từ khóa hoặc chọn
// lại bài đã nghe → trả ngay từ cache, khỏi gọi API.
// Hit/miss của các cache này được báo qua /health → /metrics (cache.stats()).
const SEARCH_TTL = 10 * 60 * 1000;
const RESOLVE_TTL = 30 * 60 * 1000;

const searchCache = caches.musicSearch;   // "provider|query|limit" → { tracks }
const resolveCache = caches.musicResolve; // "provider|trackId" → { url }
const pendingCache = caches.musicPending; // "threadId:userId" → { providerName, tracks, query, page }

function registerProvider(provider) {
  if (!provider || typeof provider.search !== "function" || typeof provider.resolve !== "function") {
    throw new Error(`Provider không hợp lệ: ${provider?.name}`);
  }
  providers.set(provider.name, provider);
}

function getProvider(name) {
  const provider = providers.get(name);
  if (!provider) throw new Error(`Nhà cung cấp nhạc '${name}' không tồn tại`);
  return provider;
}

function listProviders() {
  return [...providers.values()].map((provider) => ({ name: provider.name, label: provider.label }));
}

async function search(providerName, query, limit) {
  const provider = getProvider(providerName);
  const maxResults = limit || global.config?.music?.max_results || 40;

  // Cache: tìm lại cùng từ khóa → tức thì
  const cacheKey = `${providerName}|${query}|${maxResults}`;
  const hit = searchCache.get(cacheKey);
  if (hit !== undefined) return hit.tracks;

  const tracks = await provider.search(query, maxResults);
  if (!Array.isArray(tracks) || tracks.length === 0) {
    const error = new Error(`Không tìm thấy bài hát nào cho '${query}' trên ${provider.label}`);
    error.noResults = true;
    throw error;
  }
  searchCache.set(cacheKey, { tracks }, SEARCH_TTL);
  return tracks;
}

async function resolve(providerName, track, options = {}) {
  // Cache: chọn lại bài đã nghe → tức thì (transcoding URL sống lâu)
  const cacheKey = `${providerName}|${track?.id}`;
  const hit = resolveCache.get(cacheKey);
  if (hit !== undefined) return hit.url;

  const provider = getProvider(providerName);
  const url = await provider.resolve(track, options);
  if (url) resolveCache.set(cacheKey, { url }, RESOLVE_TTL);
  return url;
}

function setPending(key, providerName, tracks, query = "", page = 1) {
  const ttl = global.config?.music?.cache_ttl || 300000;
  pendingCache.set(key, { providerName, tracks, query, page }, ttl);
}

function getPending(key) {
  // LRUCache tự xóa entry hết hạn khi get → không cần kiểm tra expiresAt thủ công
  return pendingCache.get(key);
}

function clearPending(key) {
  pendingCache.delete(key);
}

function pickKey(threadId, userId) {
  return `${threadId}:${userId}`;
}

async function downloadToFile(streamUrl, extension) {
  const tempDir = path.join(__dirname, "..", "..", "plugins", "commands", "temp");
  fs.mkdirSync(tempDir, { recursive: true });
  const filePath = path.join(tempDir, `music_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${extension}`);
  const { buffer } = await http.getBuffer(streamUrl, { timeout: 60000, retries: 1 });
  fs.writeFileSync(filePath, buffer);
  return filePath;
}

for (const provider of [require("./soundcloud")]) {
  registerProvider(provider);
}

module.exports = {
  providers,
  getProvider,
  listProviders,
  search,
  resolve,
  setPending,
  getPending,
  clearPending,
  pickKey,
  downloadToFile
};
