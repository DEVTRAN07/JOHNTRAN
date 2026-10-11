const fs = require("fs");
const path = require("path");
const http = require("../http");

const providers = new Map();
const pendingPicks = new Map();

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
  const maxResults = limit || global.config?.music?.max_results || 5;
  const tracks = await provider.search(query, maxResults);
  if (!Array.isArray(tracks) || tracks.length === 0) {
    const error = new Error(`Không tìm thấy bài hát nào cho '${query}' trên ${provider.label}`);
    error.noResults = true;
    throw error;
  }
  return tracks;
}

async function resolve(providerName, track, options = {}) {
  const provider = getProvider(providerName);
  return provider.resolve(track, options);
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
