// Tải media local bằng yt-dlp — không gửi link/URL qua API bên thứ 3.
// Hỗ trợ: Tiktok, Youtube, Facebook, Instagram, Twitter/X, Soundcloud, Zingmp3,
// Douyin, Capcut, Vimeo, Reddit, Bilibili, v.v. ( Spotify không tải được — DRM )
const { execFile } = require("child_process");

const DOWNLOAD_TIMEOUT = 180000;

// Ứng viên binary yt-dlp: env → PATH → đường dẫn phổ biến trên macOS
const YTDLP_CANDIDATES = [
  process.env.YTDLP_PATH,
  "yt-dlp",
  "/Library/Frameworks/Python.framework/Versions/3.14/bin/yt-dlp",
  "/opt/homebrew/bin/yt-dlp",
  "/usr/local/bin/yt-dlp",
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
  const args = [
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
    await run(args);
    return outputPath;
  } catch (error) {
    // fallback: best có sẵn (một số site không cho merge)
    await run([
      "--no-warnings", "--no-playlist", "--no-check-certificate",
      "-f", "b/best",
      "-o", outputPath,
      url
    ]);
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
