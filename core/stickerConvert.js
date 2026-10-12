// ===== CHUYỂN ẢNH/GIF/VIDEO → WEBP STICKER =====
// Bản chất giống bot ZALO-BOT gốc: ffmpeg scale 480, tối đa 8 giây, 15fps.
// Máy có ffmpeg kèm libwebp → WebP động; không có (vd ffmpeg Homebrew macOS)
// → fallback GIF (Zalo vẫn nhận, hậu tố URL quyết định render sticker).
const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");
const http = require("./http");

const TARGET_W = 480;
const MAX_SECONDS = 8;
const FPS = 15;
const SIZE_LIMIT = 512 * 1024; // 512KB: Zalo upload nhanh và ổn định hơn

const ffmpegBin = "ffmpeg";
const ffprobeBin = "ffprobe";

let libwebpCache = null; // true | false | null (chưa probe)

function run(cmd, args, timeout = 60000) {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      resolve({ ok: !err, code: err ? err.code : 0, stdout, stderr: String(stderr || "") });
    });
  });
}

// ffmpeg build không kèm libwebp (Homebrew) → -vcodec libwebp luôn fail (exit 8)
async function hasLibwebp() {
  if (libwebpCache !== null) return libwebpCache;
  const r = await run(ffmpegBin, ["-hide_banner", "-encoders"], 15000);
  libwebpCache = r.ok && r.stdout.includes("libwebp");
  return libwebpCache;
}

function magicExt(buf) {
  if (buf.slice(0, 6).toString() === "GIF87a" || buf.slice(0, 6).toString() === "GIF89a") return ".gif";
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return ".png";
  if (buf.slice(0, 4).toString() === "RIFF" && buf.slice(8, 12).toString() === "WEBP") return ".webp";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return ".jpg";
  if (buf.length > 8 && buf.slice(4, 8).toString() === "ftyp") return ".mp4";
  if (buf.slice(0, 4).toString("hex") === "1a45dfa3") return ".webm";
  return "";
}

// Tải media từ URL (Zalo CDN).allowlist privacy đã có zdn.vn.
async function download(url, outDir) {
  const { buffer } = await http.getBuffer(url, { timeout: 60000 });
  if (!buffer || buffer.length < 64) throw new Error("File tải về quá nhỏ hoặc rỗng");
  const ext = magicExt(buffer) || ".bin";
  const filePath = path.join(outDir, `src_${Date.now()}${ext}`);
  fs.writeFileSync(filePath, buffer);
  return filePath;
}

// Kích thước ảnh — đọc header thẳng (PNG/GIF/JPEG/WebP), không decode
function imageSize(buf) {
  if (buf.slice(0, 4).toString() === "RIFF" && buf.slice(8, 12).toString() === "WEBP") {
    const chunk = buf.slice(12, 16).toString();
    if (chunk === "VP8X") {
      return { width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3) };
    }
    if (chunk === "VP8 ") {
      return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
    }
    if (chunk === "VP8L") {
      const bits = buf.readUInt32LE(21);
      return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
  }
  if (buf[0] === 0x89 && buf[1] === 0x50) {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  if (buf.slice(0, 4).toString() === "GIF8") {
    return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
  }
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < buf.length) {
      if (buf[offset] !== 0xff) { offset += 1; continue; }
      const marker = buf[offset + 1];
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { height: buf.readUInt16BE(offset + 5), width: buf.readUInt16BE(offset + 7) };
      }
      offset += 2 + buf.readUInt16LE(offset + 2);
    }
  }
  return { width: TARGET_W, height: TARGET_W };
}

function isAnimatedBuffer(buf) {
  // GIF nhiều frame: đếm bộ giải mã ảnh (0x2C image descriptor) sau header
  if (buf.slice(0, 4).toString() === "GIF8") {
    let count = 0;
    for (let i = 13; i < buf.length - 1; i++) {
      if (buf[i] === 0x00 && buf[i + 1] === 0x2c && buf[i + 2] !== 0x00) count++;
      if (count > 1) return true;
    }
    return false;
  }
  // WebP động: chunk VP8X + flag ANIM (bit 0x02 của byte 20)
  if (buf.slice(0, 4).toString() === "RIFF" && buf.slice(12, 16).toString() === "VP8X") {
    return (buf[20] & 0x02) !== 0;
  }
  return false;
}

// Video/GIF/ảnh tĩnh → file sticker (webp nếu được, không thì gif)
async function convert(inputPath, outPath) {
  const useWebp = await hasLibwebp();
  const outFile = useWebp ? outPath : outPath.replace(/\.webp$/, ".gif");

  const base = [
    "-y", "-i", inputPath, "-t", String(MAX_SECONDS),
    "-vf", `fps=${FPS},scale=${TARGET_W}:-1:flags=lanczos`,
    "-an"
  ];

  let r;
  if (useWebp) {
    r = await run(ffmpegBin, [
      ...base, "-vcodec", "libwebp", "-loop", "0", "-q:v", "75",
      "-preset", "default", outFile
    ]);
    if (!r.ok) {
      // vừa probe xong mà vẫn fail → thử lại bằng GIF
      r = await run(ffmpegBin, [
        ...base,
        "-vf", `fps=${FPS},scale=${TARGET_W}:-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=sierra2_4a`,
        "-loop", "0", outFile.replace(/\.webp$/, ".gif")
      ]);
      if (r.ok) return { path: outFile.replace(/\.webp$/, ".gif"), format: "gif" };
    } else {
      return { path: outFile, format: "webp" };
    }
  } else {
    r = await run(ffmpegBin, [
      ...base,
      "-vf", `fps=${FPS},scale=${TARGET_W}:-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=sierra2_4a`,
      "-loop", "0", outFile
    ]);
    if (r.ok) return { path: outFile, format: "gif" };
  }

  throw new Error("ffmpeg convert thất bại: " + r.stderr.slice(-200));
}

// Ảnh TĨNH → webp loop 2.5 giây (bot gốc vẫn gửi dạng động cho mọi sticker)
async function convertStatic(inputPath, outPath) {
  const useWebp = await hasLibwebp();
  const outFile = useWebp ? outPath : outPath.replace(/\.webp$/, ".gif");
  const r = await run(ffmpegBin, [
    "-y", "-loop", "1", "-i", inputPath,
    "-t", "2.5",
    "-vf", `fps=${FPS},scale=${TARGET_W}:-1:flags=lanczos`,
    "-vcodec", useWebp ? "libwebp" : "gif",
    ...(useWebp ? ["-loop", "0", "-q:v", "75"] : ["-loop", "0"]),
    outFile
  ]);
  if (!r.ok) throw new Error("ffmpeg convert ảnh tĩnh thất bại: " + r.stderr.slice(-200));
  return { path: outFile, format: useWebp ? "webp" : "gif" };
}

/**
 * Quy trình đầy đủ: URL media → file sticker trên đĩa.
 * @param {string} url  URL ảnh/video/gif (đã làm sạch hậu tố)
 * @param {string} outDir  thư mục tạm
 * @param {boolean} forceStatic  true = coi là ảnh tĩnh (loop 2.5s)
 */
async function makeStickerFile(url, outDir, forceStatic = false) {
  fs.mkdirSync(outDir, { recursive: true });
  const inputPath = await download(url, outDir);
  try {
    const buf = fs.readFileSync(inputPath);
    const animated = isAnimatedBuffer(buf) || [".mp4", ".webm"].includes(path.extname(inputPath));
    const out = path.join(outDir, `stk_${Date.now()}.webp`);
    const result = animated && !forceStatic
      ? await convert(inputPath, out)
      : await convertStatic(inputPath, out);

    const size = fs.statSync(result.path).size;
    const dims = imageSize(fs.readFileSync(result.path));
    return { ...result, size, ...dims };
  } finally {
    try { fs.unlinkSync(inputPath); } catch { /* bỏ qua */ }
  }
}

module.exports = {
  makeStickerFile,
  convert,
  convertStatic,
  download,
  imageSize,
  isAnimatedBuffer,
  hasLibwebp,
  SIZE_LIMIT,
  TARGET_W,
  FPS,
  MAX_SECONDS
};
