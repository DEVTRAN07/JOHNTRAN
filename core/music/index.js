const fs = require("fs");
const { spawn } = require("child_process");
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

function spawnFfmpegHls(streamUrl, filePath, timeoutMs = 90000) {
  let ffmpegPath;
  try {
    ffmpegPath = require("ffmpeg-static");
  } catch (e) {
    const err = new Error("Không tìm thấy ffmpeg-static để xử lý stream HLS: " + (e && e.message ? e.message : e));
    err.ffmpegMissing = true;
    throw err;
  }
  if (!ffmpegPath) {
    const err = new Error("ffmpeg-static không cung cấp đường dẫn binary.");
    err.ffmpegMissing = true;
    throw err;
  }

  const args = [
    "-nostdin", "-y",
    "-reconnect", "1", "-reconnect_streamed", "1", "-reconnect_delay_max", "5",
    "-protocol_whitelist", "file,http,https,tcp,tls,crypto",
    "-allowed_extensions", "ALL",
    "-i", streamUrl,
    "-vn", "-acodec", "libmp3lame", "-ab", "128k", "-f", "mp3",
    filePath
  ];

  return new Promise((resolve, reject) => {
    let settled = false;
    let stderr = "";
    let child;
    try {
      child = spawn(ffmpegPath, args, { stdio: ["ignore", "ignore", "pipe"] });
    } catch (err) {
      return reject(new Error("Không khởi động được ffmpeg: " + (err && err.message ? err.message : err)));
    }

    const cleanup = () => {
      if (timer) clearTimeout(timer);
      if (child) {
        try { child.stdout && child.stdout.destroy(); } catch {}
        try { child.stderr && child.stderr.destroy(); } catch {}
      }
    };

    const fail = (err) => {
      if (settled) return;
      settled = true;
      cleanup();
      try { if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch {}
      reject(err);
    };
    const ok = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(filePath);
    };

    const timer = setTimeout(() => {
      try { if (child && !child.killed) child.kill("SIGKILL"); } catch {}
      fail(new Error("ffmpeg HLS timeout sau " + Math.round(timeoutMs / 1000) + "s"));
    }, timeoutMs);

    if (child.stderr) {
      child.stderr.on("data", (chunk) => {
        stderr += chunk.toString();
        if (stderr.length > 4000) stderr = stderr.slice(-4000);
      });
    }

    child.on("error", (err) => {
      fail(new Error("Lỗi chạy ffmpeg: " + (err && err.message ? err.message : err)));
    });

    child.on("close", (code, signal) => {
      if (signal) {
        const sig = String(signal);
        if (["SIGSEGV","SIGABRT","SIGBUS","SIGILL","SIGKILL"].indexOf(sig) !== -1) {
          return fail(new Error("ffmpeg bị dừng bởi tín hiệu " + sig + " (binary ffmpeg có thể không tương thích/crash với stream này)"));
        }
        return fail(new Error("ffmpeg bị dừng bởi tín hiệu " + sig));
      }
      if (code !== 0) {
        const tail = stderr ? ("\n" + stderr.trim().split("\n").slice(-3).join("\n")) : "";
        return fail(new Error("ffmpeg thoát với mã " + code + tail));
      }
      try {
        if (!fs.existsSync(filePath) || fs.statSync(filePath).size < 1024) {
          return fail(new Error("ffmpeg hoàn tất nhưng file output không hợp lệ"));
        }
      } catch (e) {
        return fail(new Error("Không kiểm tra được file output: " + (e && e.message ? e.message : e)));
      }
      ok();
    });
  });
}

async function downloadHlsToFile(streamUrl, extension) {
  const tempDir = path.join(__dirname, "..", "..", "plugins", "commands", "temp");
  fs.mkdirSync(tempDir, { recursive: true });
  const ext = extension || "mp3";
  const filePath = path.join(tempDir, "music_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8) + "." + ext);
  const timeoutMs = Number(global.config?.music?.hls_timeout_ms) || 90000;
  await spawnFfmpegHls(streamUrl, filePath, timeoutMs);
  return filePath;
}

async function downloadToFile(streamUrl, extension) {
  // Ho tro ca string URL (progressive) va object { url, protocol } (HLS/Go+ fallback).
  let url = streamUrl;
  let protocol = "progressive";
  if (streamUrl && typeof streamUrl === "object") {
    url = streamUrl.url;
    protocol = streamUrl.protocol || protocol;
  }
  if (!url) throw new Error("Khong co URL stream de tai nhac.");

  const tempDir = path.join(__dirname, "..", "..", "plugins", "commands", "temp");
  fs.mkdirSync(tempDir, { recursive: true });

  if (protocol === "hls") {
    try {
      return await downloadHlsToFile(url, extension || "mp3");
    } catch (err) {
      const detail = err && err.message ? err.message : String(err || "unknown");
      const error = new Error(
        "Không thể tải bài này (stream HLS lỗi: " + detail + "). " +
        "Track có thể bị giới hạn (Go+/vùng/ban quyền) hoặc server không hỗ trợ xử lý HLS. Hãy thử bài khác."
      );
      error.notAvailable = true;
      throw error;
    }
  }

  const filePath = path.join(tempDir, `music_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${extension}`);
  const { buffer } = await http.getBuffer(url, { timeout: 60000, retries: 1 });
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
