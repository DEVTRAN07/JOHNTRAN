const fs = require("fs");
const { spawn, spawnSync } = require("child_process");
const path = require("path");
const http = require("../http");
const db = require("../../utils/db");
const { caches } = require("../cache");

const providers = new Map();
const PROVIDER_ALIASES = new Map([["soundcloud", "scl"]]);

// ===== CACHE KẾT QUẢ (dùng LRUCache chung từ core/cache.js) =====
const SEARCH_TTL = 10 * 60 * 1000;
const RESOLVE_TTL = 30 * 60 * 1000;

const searchCache = caches.musicSearch;
const resolveCache = caches.musicResolve;
const pendingCache = caches.musicPending;

function registerProvider(provider) {
  if (!provider || typeof provider.search !== "function" || typeof provider.resolve !== "function") {
    throw new Error(`Provider không hợp lệ: ${provider?.name}`);
  }
  providers.set(provider.name, provider);
}

function getProvider(name) {
  const provider = providers.get(PROVIDER_ALIASES.get(name) || name);
  if (!provider) throw new Error(`Nhà cung cấp nhạc '${name}' không tồn tại`);
  return provider;
}

function listProviders() {
  return [...providers.values()].map((provider) => ({ name: provider.name, label: provider.label }));
}

async function search(providerName, query, limit) {
  const provider = getProvider(providerName);
  const maxResults = limit || global.config?.music?.max_results || 40;
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

function getPending(key) { return pendingCache.get(key); }
function clearPending(key) { pendingCache.delete(key); }
function pickKey(threadId, userId) { return `${threadId}:${userId}`; }

let _systemFfmpeg;
function findSystemFfmpeg() {
  if (_systemFfmpeg !== undefined) return _systemFfmpeg;
  const candidates = ["/usr/bin/ffmpeg", "/usr/local/bin/ffmpeg", "ffmpeg"];
  for (const bin of candidates) {
    try {
      if (bin.includes("/")) { if (fs.existsSync(bin)) { _systemFfmpeg = bin; return bin; } continue; }
      const r = spawnSync("which", [bin], { encoding: "utf8" });
      const p = r && r.stdout ? r.stdout.trim().split("\n")[0] : "";
      if (r && r.status === 0 && p) { _systemFfmpeg = p; return p; }
    } catch {}
  }
  try { if (spawnSync("ffmpeg", ["-version"], { stdio: "ignore" }).status === 0) { _systemFfmpeg = "ffmpeg"; return "ffmpeg"; } } catch {}
  _systemFfmpeg = null; return null;
}

function getFfmpegStaticPath() { try { return require("ffmpeg-static") || null; } catch { return null; } }

let _ytDlp;
function findYtDlp() {
  if (_ytDlp !== undefined) return _ytDlp;
  for (const bin of [process.env.YTDLP_PATH, "/usr/local/bin/yt-dlp", "/usr/bin/yt-dlp", "yt-dlp"].filter(Boolean)) {
    try {
      if (bin.includes("/")) { if (fs.existsSync(bin)) { _ytDlp = bin; return bin; } continue; }
      const r = spawnSync("which", [bin], { encoding: "utf8" });
      const p = r && r.stdout ? r.stdout.trim().split("\n")[0] : "";
      if (r && r.status === 0 && p) { _ytDlp = p; return p; }
      if (spawnSync(bin, ["--version"], { stdio: "ignore" }).status === 0) { _ytDlp = bin; return bin; }
    } catch {}
  }
  _ytDlp = null; return null;
}

function runProcess(cmd, args, options = {}) {
  const timeoutMs = options.timeoutMs || 90000;
  const filePath = options.filePath;
  return new Promise((resolve, reject) => {
    let settled = false, stderr = "", child;
    try { child = spawn(cmd, args, { stdio: ["ignore", "ignore", "pipe"] }); }
    catch (err) { return reject(new Error("Không khởi động được " + cmd + ": " + (err && err.message ? err.message : err))); }
    const cleanup = () => { if (timer) clearTimeout(timer); try { child && child.stderr && child.stderr.destroy(); } catch {} };
    const fail = (err) => { if (settled) return; settled = true; cleanup(); try { if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch {} reject(err); };
    const ok = () => { if (settled) return; settled = true; cleanup(); resolve(filePath); };
    const timer = setTimeout(() => { try { child && !child.killed && child.kill("SIGKILL"); } catch {} fail(new Error(cmd + " timeout sau " + Math.round(timeoutMs/1000) + "s")); }, timeoutMs);
    if (child.stderr) child.stderr.on("data", (c) => { stderr += c.toString(); if (stderr.length > 4000) stderr = stderr.slice(-4000); });
    child.on("error", (err) => fail(new Error("Lỗi chạy " + cmd + ": " + (err && err.message ? err.message : err))));
    child.on("close", (code, signal) => {
      if (signal) { const sig = String(signal); const fatal = ["SIGSEGV","SIGABRT","SIGBUS","SIGILL","SIGKILL"]; return fail(new Error(cmd + " bị dừng bởi tín hiệu " + sig + (fatal.indexOf(sig)!==-1 ? " (binary có thể không tương thích/crash với stream này)" : ""))); }
      if (code !== 0) { const tail = stderr ? ("\n" + stderr.trim().split("\n").slice(-3).join("\n")) : ""; return fail(new Error(cmd + " thoát với mã " + code + tail)); }
      try { if (filePath && (!fs.existsSync(filePath) || fs.statSync(filePath).size < 1024)) return fail(new Error(cmd + " hoàn tất nhưng file output không hợp lệ")); } catch (e) { return fail(new Error("Không kiểm tra được file output: " + e.message)); }
      ok();
    });
  });
}

function ffmpegHlsArgs(streamUrl, filePath, opts = {}) {
  const a = ["-nostdin","-y","-reconnect","1","-reconnect_streamed","1","-reconnect_delay_max","5"];
  if (opts.withWhitelist !== false) a.push("-protocol_whitelist","file,http,https,tcp,tls,crypto","-allowed_extensions","ALL");
  a.push("-i", streamUrl, "-vn", "-acodec", "libmp3lame", "-b:a", "128k", "-f", "mp3", filePath);
  return a;
}

async function tryFfmpegBackends(streamUrl, filePath, timeoutMs) {
  const backends = [];
  const sys = findSystemFfmpeg(); if (sys) backends.push({ name: "system-ffmpeg", path: sys });
  const st = getFfmpegStaticPath(); if (st && st !== sys) backends.push({ name: "ffmpeg-static", path: st });
  if (!backends.length) { const e = new Error("Không tìm thấy ffmpeg (system/ffmpeg-static) để xử lý stream HLS."); e.ffmpegMissing = true; throw e; }
  const errors = [];
  for (const b of backends) {
    for (const v of [{ withWhitelist: true }, { withWhitelist: false }]) {
      try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch {}
      const label = b.name + (v.withWhitelist ? "" : "/no-whitelist");
      try { await runProcess(b.path, ffmpegHlsArgs(streamUrl, filePath, v), { timeoutMs, filePath }); return { backend: label }; }
      catch (err) { errors.push(label + ": " + (err && err.message ? err.message : err)); }
    }
  }
  const e = new Error(errors.join(" | ")); e.allFfmpegFailed = true; throw e;
}

async function tryYtDlp(fallbackUrl, filePath, timeoutMs) {
  if (!fallbackUrl) { const e = new Error("Không có URL fallback (track permalink) cho yt-dlp"); e.noFallbackUrl = true; throw e; }
  const yt = findYtDlp(); if (!yt) { const e = new Error("Không tìm thấy yt-dlp"); e.ytDlpMissing = true; throw e; }
  const base = filePath.replace(/.mp3$/i, "");
  const args = ["-x","--audio-format","mp3","--audio-quality","128K","-o", base + ".%(ext)s","--no-playlist","--no-warnings","--socket-timeout","30", fallbackUrl];
  await runProcess(yt, args, { timeoutMs, filePath: null });
  const produced = base + ".mp3";
  if (fs.existsSync(produced) && produced !== filePath) { try { fs.renameSync(produced, filePath); } catch { fs.copyFileSync(produced, filePath); try { fs.unlinkSync(produced); } catch {} } }
  if (!fs.existsSync(filePath) || fs.statSync(filePath).size < 1024) throw new Error("yt-dlp không tạo được file mp3 hợp lệ");
  return { backend: "yt-dlp" };
}

async function downloadHlsToFile(streamUrl, extension, options = {}) {
  const tempDir = path.join(__dirname, "..", "..", "plugins", "commands", "temp");
  fs.mkdirSync(tempDir, { recursive: true });
  const filePath = path.join(tempDir, "music_" + Date.now() + "_" + Math.random().toString(36).slice(2,8) + "." + (extension || "mp3"));
  const timeoutMs = Number(global.config?.music?.hls_timeout_ms) || 90000;
  const attempts = [];
  try { const r = await tryFfmpegBackends(streamUrl, filePath, timeoutMs); attempts.push(r.backend + ": ok"); return filePath; }
  catch (e) { attempts.push("ffmpeg: " + (e && e.message ? e.message : e)); }
  try { const y = await tryYtDlp(options.fallbackUrl, filePath, timeoutMs); attempts.push(y.backend + ": ok"); return filePath; }
  catch (e) { attempts.push("yt-dlp: " + (e && e.message ? e.message : e)); }
  const err = new Error("Không thể tải bài này (HLS lỗi sau khi thử fallback: " + attempts.join(" || ") + "). Track có thể bị giới hạn (Go+/vùng/ban quyền) hoặc server không hỗ trợ xử lý stream này. Hãy thử bài khác.");
  err.notAvailable = true; throw err;
}

async function downloadToFile(streamUrl, extension, options = {}) {
  let url = streamUrl, protocol = "progressive";
  if (streamUrl && typeof streamUrl === "object") { url = streamUrl.url; protocol = streamUrl.protocol || protocol; }
  if (!url) throw new Error("Không có URL stream để tải nhạc.");
  if (protocol === "hls") return downloadHlsToFile(url, extension || "mp3", options);
  const tempDir = path.join(__dirname, "..", "..", "plugins", "commands", "temp");
  fs.mkdirSync(tempDir, { recursive: true });
  const filePath = path.join(tempDir, `music_${Date.now()}_${Math.random().toString(36).slice(2,8)}.${extension}`);
  const { buffer } = await http.getBuffer(url, { timeout: 60000, retries: 1 });
  fs.writeFileSync(filePath, buffer);
  return filePath;
}

for (const provider of [require("./soundcloud")]) registerProvider(provider);

module.exports = { providers, getProvider, listProviders, search, resolve, setPending, getPending, clearPending, pickKey, downloadToFile };
