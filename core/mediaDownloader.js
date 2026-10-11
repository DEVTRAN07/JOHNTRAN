// Tải media local bằng yt-dlp — không gửi link/URL qua API bên thứ 3.
// Hỗ trợ: Tiktok, Youtube, Facebook, Instagram, Twitter/X, Soundcloud, Zingmp3,
// Douyin, Capcut, Vimeo, Reddit, Bilibili, v.v. ( Spotify không tải được — DRM )
const { execFile } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

const DOWNLOAD_TIMEOUT = 180000;

// Ứng viên binary yt-dlp: env → PATH (ưu tiên nightly: fix chống chặn YouTube nhanh hơn) → đường dẫn phổ biến
const YTDLP_CANDIDATES = [
  process.env.YTDLP_PATH,
  path.join(os.homedir(), ".local/bin/yt-dlp"),
  "yt-dlp",
  "/usr/local/bin/yt-dlp",
  "/Library/Frameworks/Python.framework/Versions/3.14/bin/yt-dlp",
  "/opt/homebrew/bin/yt-dlp",
  "/usr/bin/yt-dlp"
].filter(Boolean);

let resolvedBinary = null;
let availabilityChecked = false;
let impersonateSupported = null; // null = chưa kiểm tra

function tryBinary(binary, args) {
  return new Promise((resolve) => {
    execFile(binary, args, { timeout: 10000 }, (error, stdout) => {
      resolve({ ok: !error && /^20\d\d\./.test((stdout || "").trim()), binary });
    });
  });
}

async function ytDlpAvailable() {
  if (availabilityChecked) return Boolean(resolvedBinary);
  availabilityChecked = true;
  for (const candidate of YTDLP_CANDIDATES) {
    const result = await tryBinary(candidate, ["--version"]);
    if (result.ok) {
      resolvedBinary = candidate;
      return true;
    }
  }
  return false;
}

// yt-dlp bản mới (>= 2023.07) giả làm trình duyệt thật (TLS fingerprint) — nhiều
// site (Facebook, Vimeo...) chặn bot thì không lấy được metadata nếu thiếu cờ này.
async function supportsImpersonate() {
  if (impersonateSupported !== null) return impersonateSupported;
  if (!resolvedBinary) await ytDlpAvailable(); // chưa dò binary thì dò trước
  if (!resolvedBinary) return (impersonateSupported = false);
  try {
    const { stdout } = await new Promise((resolve, reject) => {
      execFile(resolvedBinary, ["--help"], { timeout: 15000, maxBuffer: 32 * 1024 * 1024 }, (err, out) => {
        err ? reject(err) : resolve({ stdout: out });
      });
    });
    impersonateSupported = /--impersonate/.test(stdout || "");
  } catch {
    impersonateSupported = false;
  }
  return impersonateSupported;
}

function impersonateArgs() {
  return ["--impersonate", "chrome"];
}

function run(args, timeout = DOWNLOAD_TIMEOUT) {
  if (!resolvedBinary) {
    return Promise.reject(new Error("yt-dlp không khả dụng (chưa cài đặt hoặc sai đường dẫn)"));
  }
  return new Promise((resolve, reject) => {
    execFile(
      resolvedBinary,
      args,
      { timeout, maxBuffer: 32 * 1024 * 1024 },
      (error, stdout, stderr) => {
        const dropFlags = ["--impersonate", "--cookies-from-browser"];
        const errText = stderr || "";
        // Thiếu curl_cffi/impersonate hoặc trình duyệt đọc không được
        // → bỏ cờ đó (KÈM GIÁ TRỊ) rồi chạy lại, khỏi bó tay vì 1 tuỳ chọn phụ
        if (error && new RegExp(dropFlags.join("|"), "i").test(errText)) {
          const retryArgs = [];
          for (let i = 0; i < args.length; i++) {
            if (dropFlags.includes(args[i])) { i++; continue; } // bỏ flag + giá trị đi kèm
            retryArgs.push(args[i]);
          }
          if (retryArgs.length !== args.length) {
            return execFile(resolvedBinary, retryArgs, { timeout, maxBuffer: 32 * 1024 * 1024 }, (e2, so2, se2) => {
              if (e2) return reject(new Error(cleanError(e2, se2 || so2)));
              resolve(so2);
            });
          }
        }
        if (error) return reject(new Error(cleanError(error, stderr || stdout)));
        resolve(stdout);
      }
    );
  });
}

function cleanError(error, stderr) {
  const message = (stderr || error.message || "").split("\n").filter(Boolean).slice(-2).join(" ");
  return message.slice(0, 200);
}

// ===== Cookies + player client (YouTube chặn bot khi không có cookie) =====
function cookiesFile() {
  return (global.config?.media?.ytdlp_cookies_file || process.env.YTDLP_COOKIES_FILE || "").trim();
}

function cookiesBrowser() {
  return (global.config?.media?.ytdlp_cookies_from_browser || "").trim();
}

// Cờ xác thực cho YouTube. Ưu tiên file cookies.txt (dùng được cả trên
// Render); nếu không có thì lấy cookie từ trình duyệt của máy (chỉ chạy local).
function authArgs() {
  const file = cookiesFile();
  if (file) {
    if (fs.existsSync(file)) return ["--cookies", file];
    logger.log(`[yt-dlp] Không thấy file cookies: ${file}`, "warn");
    return [];
  }
  const browser = cookiesBrowser();
  return browser ? ["--cookies-from-browser", browser] : [];
}

// Thử các player_client khác nhau để qua mặt bước "Sign in to confirm you're not a bot"
const YT_PLAYER_CLIENTS = ["tv,ios,web_embedded", "mweb,web_safari,mweb_embedded", "android,web_creator,web"];

function isYoutube(url) {
  return /(?:^|\.)(?:youtube\.com|youtu\.be|m\.youtube\.com|music\.youtube\.com)/.test(String(url));
}

function baseArgs(extra = []) {
  return ["--no-warnings", "--no-playlist", "--no-check-certificate", ...extra];
}

// Cờ cookie và --impersonate KHÔNG dùng được cùng lúc (xung đh, có khi treo
// yt-dlp) nên tách thành các "biến thể" và thử lần lượt từ khả thi nhất:
//   1) cookie (nếu admin cấu hình)     2) giả trình duyệt   3) mặc định
async function argVariants(extra = []) {
  const variants = [];
  const auth = authArgs();
  if (auth.length) variants.push([...baseArgs(extra), ...auth]);
  if (await supportsImpersonate()) variants.push([...baseArgs(extra), ...impersonateArgs()]);
  variants.push(baseArgs(extra));
  return variants;
}

async function runTryAll(variants, timeout = DOWNLOAD_TIMEOUT) {
  let lastError = null;
  for (const args of variants) {
    try {
      return await run(args, timeout);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("yt-dlp thất bại");
}

// Lấy metadata (title, duration, thumbnail, formats) dạng JSON.
// YouTube hay chặn bot → thử lần lượt các player_client khác nhau.
async function getMediaInfo(url) {
  try {
    return JSON.parse(await runTryAll(await argVariants(["-J", url]), 90000));
  } catch (error) {
    if (!isYoutube(url)) throw error;
    for (const client of YT_PLAYER_CLIENTS) {
      try {
        const extra = ["-J", "--extractor-args", `youtube:player_client=${client}`, url];
        return JSON.parse(await runTryAll(await argVariants(extra), 90000));
      } catch { /* thử client tiếp */ }
    }
    throw error;
  }
}

// Là "chỉ có tiếng" (không hình) → gửi voice. Một số site không set vcodec ở
// top-level nên phải xem thêm danh sách formats mới tin được.
function isAudioOnly(info) {
  if (!info) return true;
  if (info.vcodec && info.vcodec !== "none") return false;
  if (Array.isArray(info.formats) && info.formats.length > 0) {
    return !info.formats.some((f) => f && f.vcodec && f.vcodec !== "none");
  }
  return info.vcodec === "none";
}

// Tải video ra file local (mp4 ưu tiên, cap 720p để vừa Zalo)
async function downloadVideo(url, outputPath) {
  const format = "bv*[height<=720]+ba/b[height<=720]/b";
  const withOutput = (extra) => [...extra, "-o", outputPath, url];
  const mainExtra = ["-f", format, "--merge-output-format", "mp4", "--concurrent-fragments", "4"];

  try {
    await runTryAll(await argVariants(withOutput(mainExtra)));
    return outputPath;
  } catch (error) {
    // YouTube chặn bot → thử các player_client khác
    if (isYoutube(url)) {
      for (const client of YT_PLAYER_CLIENTS) {
        try {
          const extra = [...mainExtra, "--extractor-args", `youtube:player_client=${client}`];
          await runTryAll(await argVariants(withOutput(extra)));
          return outputPath;
        } catch { /* thử client tiếp */ }
      }
    }
    // fallback: best có sẵn (một số site không cho merge)
    await runTryAll(await argVariants(withOutput(["-f", "b/best"])));
    return outputPath;
  }
}

// Tải audio (mp3)
async function downloadAudio(url, outputPath) {
  await runTryAll(await argVariants(
    ["-f", "bestaudio/best", "-x", "--audio-format", "mp3", "--audio-quality", "0", "-o", outputPath, url]
  ));
  return outputPath;
}

function describe(info) {
  const meta = [];
  if (info.title) meta.push(`Title: ${info.title}`);
  if (info.uploader || info.channel) meta.push(`Author: ${info.uploader || info.channel}`);
  if (info.duration) {
    const m = Math.floor(info.duration / 60);
    const s = Math.floor(info.duration % 60);
    meta.push(`Thời lượng: ${m}:${String(s).padStart(2, "0")}`);
  }
  return meta;
}

module.exports = { ytDlpAvailable, supportsImpersonate, getMediaInfo, downloadVideo, downloadAudio, isAudioOnly, describe };
