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
        if (error) {
          const message = (stderr || stdout || error.message || "").split("\n").filter(Boolean).slice(-2).join(" ");
          reject(new Error(message.slice(0, 200)));
          return;
        }
        resolve(stdout);
      }
    );
  });
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

async function getMediaInfo(url) {
  const base = withCookies(["-J", "--no-warnings", "--no-playlist", "--no-check-certificate", url]);
  try {
    return JSON.parse(await run(base, 90000));
  } catch (error) {
    if (!isYoutube(url)) throw error;
    for (const client of YT_PLAYER_CLIENTS) {
      try {
        const args = ["-J", "--no-warnings", "--no-playlist", "--no-check-certificate", "--extractor-args", `youtube:player_client=${client}`, url];
        return JSON.parse(await run(withCookies(args), 90000));
      } catch { /* thử client tiếp */ }
    }
    throw error;
  }
}

function isYoutube(url) {
  return /(?:^|\.)(?:youtube\.com|youtu\.be|m\.youtube\.com|music\.youtube\.com)/.test(String(url));
}


// Lấy metadata (title, duration, thumbnail, formats) dạng JSON
async function getMediaInfo(url) {
  const stdout = await run(["-J", "--no-warnings", "--no-playlist", "--no-check-certificate", url], 90000);
  return JSON.parse(stdout);
}

function isAudioOnly(info) {
  return !info || info.vcodec === "none" || info.vcodec === undefined;
}

// Tải video ra file local (mp4 ưu tiên, cap 720p để vừa Zalo)
async function downloadVideo(url, outputPath) {
  const format = "bv*[height<=720]+ba/b[height<=720]/b";
  const baseArgs = () => [
    "--no-warnings",
    "--no-playlist",
    "--no-check-certificate",
    "-f", format,
    "--merge-output-format", "mp4",
    "--concurrent-fragments", "4",
    "-o", outputPath,
    url
  ];
  try {
    await run(withCookies(baseArgs()));
    return outputPath;
  } catch (error) {
    // YouTube chặn bot → thử các player_client khác
    if (isYoutube(url)) {
      for (const client of YT_PLAYER_CLIENTS) {
        try {
          const args = baseArgs();
          args.push("--extractor-args", `youtube:player_client=${client}`);
          await run(withCookies(args));
          return outputPath;
        } catch { /* thử client tiếp */ }
      }
    }
    // fallback: best có sẵn (một số site không cho merge)
    await run(withCookies([
      "--no-warnings", "--no-playlist", "--no-check-certificate",
      "-f", "b/best",
      "-o", outputPath,
      url
    ]));
    return outputPath;
  }
}

// Tải audio (mp3)
async function downloadAudio(url, outputPath) {
  await run([
    "--no-warnings",
    "--no-playlist",
    "--no-check-certificate",
    "-f", "bestaudio/best",
    "-x",
    "--audio-format", "mp3",
    "--audio-quality", "0",
    "-o", outputPath,
    url
  ]);
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

module.exports = { ytDlpAvailable, getMediaInfo, downloadVideo, downloadAudio, isAudioOnly, describe };
