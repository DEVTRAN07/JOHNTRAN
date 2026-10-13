const fs = require("fs");
const path = require("path");
const http = require("../http");
const db = require("../../utils/db");

const providers = new Map();
const pendingPicks = new Map();

// ===== CACHE KẾT QUẢ =====
// SoundCloud/Zalo API chậm (~0.5-1s/call). Tìm lại cùng từ khóa hoặc chọn
// lại bài đã nghe → trả ngay từ cache, khỏi gọi API.
const SEARCH_TTL = 10 * 60 * 1000;
const RESOLVE_TTL = 30 * 60 * 1000;
const CACHE_MAX = 200;
const searchCache = new Map(); // "provider|query|limit" → { tracks, at }
const resolveCache = new Map(); // "provider|trackId" → { url, at }

function cacheGet(map, key, ttl) {
  const hit = map.get(key);
  if (hit && Date.now() - hit.at < ttl) return hit;
  if (hit) map.delete(key);
  return null;
}

function cacheSet(map, key, value) {
  if (map.size >= CACHE_MAX) {
    const oldest = [...map.entries()].sort((a, b) => a[1].at - b[1].at)[0];
    if (oldest) map.delete(oldest[0]);
  }
  map.set(key, { ...value, at: Date.now() });
}

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
  // Mặc định 40 bài — đủ nhiều để phân trang và ưu tiên bài thịnh hành
  const maxResults = limit || global.config?.music?.max_results || 40;

  // Cache: tìm lại cùng từ khóa → tức thì
  const cacheKey = `${providerName}|${query}|${maxResults}`;
  const hit = cacheGet(searchCache, cacheKey, SEARCH_TTL);
  if (hit) return hit.tracks;

  const tracks = await provider.search(query, maxResults);
  if (!Array.isArray(tracks) || tracks.length === 0) {
    const error = new Error(`Không tìm thấy bài hát nào cho '${query}' trên ${provider.label}`);
    error.noResults = true;
    throw error;
  }
  cacheSet(searchCache, cacheKey, { tracks });
  return tracks;
}

async function resolve(providerName, track, options = {}) {
  // Cache: chọn lại bài đã nghe → tức thì (transcoding URL sống lâu)
  const cacheKey = `${providerName}|${track?.id}`;
  const hit = cacheGet(resolveCache, cacheKey, RESOLVE_TTL);
  if (hit) return hit.url;

  const provider = getProvider(providerName);
  const url = await provider.resolve(track, options);
  if (url) cacheSet(resolveCache, cacheKey, { url });
  return url;
}

function setPending(key, providerName, tracks, query = "", page = 1) {
  const ttl = global.config?.music?.cache_ttl || 300000;
  pendingPicks.set(key, { providerName, tracks, query, page, expiresAt: Date.now() + ttl });
  sweepPending();
}

function getPending(key) {
  const entry = pendingPicks.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    pendingPicks.delete(key);
    return null;
  }
  return entry;
}

function clearPending(key) {
  pendingPicks.delete(key);
}

function sweepPending() {
  const now = Date.now();
  for (const [key, entry] of pendingPicks.entries()) {
    if (entry.expiresAt < now) pendingPicks.delete(key);
  }
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
