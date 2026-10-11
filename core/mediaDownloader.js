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
        // Thiếu curl_cffi/impersonate lỗi → bỏ cờ --impersonate rồi chạy lại
        if (error && /impersonate|curl_cffi/i.test(stderr || "")) {
          const retryArgs = args.filter((a, i) => a !== "--impersonate" && args[i - 1] !== "--impersonate");
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

function withCookies(args) {
  const cookies = cookiesFile();
  if (cookies && fs.existsSync(cookies)) args.push("--cookies", cookies);
  return args;
}

// Thử các player_client khác nhau để qua mặt bước "Sign in to confirm you're not a bot"
const YT_PLAYER_CLIENTS = ["tv,ios,web_embedded", "mweb,web_safari,mweb_embedded", "android,web_creator,web"];

function isYoutube(url) {
  return /(?:^|\.)(?:youtube\.com|youtu\.be|m\.youtube\.com|music\.youtube\.com)/.test(String(url));
}

// Args cơ bản cho MỌI lệnh yt-dlp: impersonate giúp lấy được Facebook/Vimeo...
async function commonArgs(extra = []) {
  const args = ["--no-warnings", "--no-playlist", "--no-check-certificate", ...extra];
  if (await supportsImpersonate()) args.push(...impersonateArgs());
  return args;
}

// Lấy metadata (title, duration, thumbnail, formats) dạng JSON.
// YouTube hay chặn bot → thử lần lượt các player_client khác nhau.
async function getMediaInfo(url) {
  const base = withCookies(await commonArgs(["-J", url]));
  try {
    return JSON.parse(await run(base, 90000));
  } catch (error) {
    if (!isYoutube(url)) throw error;
    for (const client of YT_PLAYER_CLIENTS) {
      try {
        const args = await commonArgs(["-J", "--extractor-args", `youtube:player_client=${client}`, url]);
        return JSON.parse(await run(withCookies(args), 90000));
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
  const baseArgs = async () => [
    ...(await commonArgs()),
    "-f", format,
    "--merge-output-format", "mp4",
    "--concurrent-fragments", "4",
    "-o", outputPath,
    url
  ];
  try {
    await run(withCookies(await baseArgs()));
    return outputPath;
  } catch (error) {
    // YouTube chặn bot → thử các player_client khác
    if (isYoutube(url)) {
      for (const client of YT_PLAYER_CLIENTS) {
        try {
          const args = await baseArgs();
          args.push("--extractor-args", `youtube:player_client=${client}`);
          await run(withCookies(args));
          return outputPath;
        } catch { /* thử client tiếp */ }
      }
    }
    // fallback: best có sẵn (một số site không cho merge)
    await run(withCookies([
      ...(await commonArgs()),
      "-f", "b/best",
      "-o", outputPath,
      url
    ]));
    return outputPath;
  }
}

// Tải audio (mp3)
async function downloadAudio(url, outputPath) {
  await run(withCookies([
    ...(await commonArgs()),
    "-f", "bestaudio/best",
    "-x",
    "--audio-format", "mp3",
    "--audio-quality", "0",
    "-o", outputPath,
    url
  ]));
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
