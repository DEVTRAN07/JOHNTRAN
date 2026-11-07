// ===== TẠO STICKER TỪ NỘI DUNG REPLY (ảnh/GIF/video) =====
// Flow (giống bot ZALO-BOT gốc):
//   1. Lấy URL media từ tin reply (ưu tiên webp của sticker động).
//   2. Tải về + convert sticker (WebP/GIF) bằng ffmpeg.
//   3. Upload lên CDN Zalo → URL.
//   4. Gửi photo_url với hậu tố "?sticker.webp" + properties sticker.
// Nếu Zalo upload lỗi hoặc file > 512KB → fallback upload Catbox.
const fs = require("fs");
const path = require("path");
const http = require("./http");
const converter = require("./stickerConvert");
const { buildStickerUrl, stripStickerSuffix, jxlToJpg } = require("./stickerFactory");

const CACHE_DIR = path.join(__dirname, "..", "assets", "cache", "sticker");
// Fallback khi Zalo CDN thất bại: catbox.moe (user/api.php) với multipart đúng chuẩn.
// Anonymous upload catbox trả "Invalid uploader" → cần userhash (CATBOX_USERHASH).
const CATBOX_URL = "https://catbox.moe/user/api.php";
const CATBOX_USERHASH = process.env.CATBOX_USERHASH || process.env.LITTERBOX_USERHASH || "";
const CATBOX_FIELDS = [["reqtype", "fileupload"]]
  .concat(CATBOX_USERHASH ? [["userhash", CATBOX_USERHASH]] : []);

function cleanMediaUrl(url) {
  return stripStickerSuffix(jxlToJpg(String(url || "").replace(/\\\//g, "/")));
}

// URL nguồn từ tin reply: sticker động → webp.url, rồi video → ảnh → file
function pickMediaUrl(media) {
  if (!media) return null;
  return cleanMediaUrl(media.webpUrl) || cleanMediaUrl(media.video) ||
         cleanMediaUrl(media.image) || cleanMediaUrl(media.file) || null;
}

// Host CDN của Zalo (zdn.vn, dlfl.vn, zadn.vn, zaloapp.com...) — tải bằng
// session của bot: đây là host CỦA CHÍNH tài khoản, không phải bên thứ 3,
// không chạy privacy guard như media bên ngoài.
const ZALO_HOST_RE = /(^|\.)(zdn\.vn|dlfl\.vn|zadn\.vn|zaloapp\.com|zalo\.me|zalo\.ai)$/i;

function pickFetcher(api, url) {
  let host = "";
  try { host = new URL(url).hostname; } catch { return null; }
  if (ZALO_HOST_RE.test(host) && typeof api?.fetchZaloMedia === "function") {
    return (u) => api.fetchZaloMedia({ url: u });
  }
  return null; // mặc định: core/http (có privacy guard)
}

// Upload catbox.moe (multipart thủ công — core/http chỉ nhận string/Buffer body)
async function uploadCatbox(filePath) {
  const fileName = path.basename(filePath);
  const fileBuffer = fs.readFileSync(filePath);
  const boundary = "----JTCatbox" + Date.now().toString(16);
  const fields = [...CATBOX_FIELDS, ["fileToUpload", null]];
  const chunks = [];

  for (const [name, value] of fields) {
    if (value === null) {
      chunks.push(Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${name}"; ` +
        `filename="${fileName}"\r\nContent-Type: application/octet-stream\r\n\r\n`
      ));
      chunks.push(fileBuffer);
      chunks.push(Buffer.from("\r\n"));
    } else {
      chunks.push(Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`
      ));
    }
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`));

  const res = await http.request(CATBOX_URL, {
    method: "POST",
    timeout: 90000,
    headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
    body: Buffer.concat(chunks)
  });

  const text = (res.text() || "").trim();
  if (!text.startsWith("http")) {
    const err = new Error("catbox trả về: " + text.slice(0, 120));
    err.response = text;
    throw err;
  }
  return text;
}

/**
 * Tạo sticker từ media đã reply và gửi vào nhóm/chat.
 * @param {object} p
 *   api, event, variant ("ai" | "std"), forceStatic
 * @returns {Promise<{via: "zalo"|"catbox", width: number, height: number}>}
 */
async function createAndSend({ api, event, variant = "ai", forceStatic = false }) {
  const { threadId, type } = event;
  const { parseQuote } = require("./mediaReply");
  const media = parseQuote(event);
  const url = pickMediaUrl(media);

  if (!url) {
    const err = new Error("NO_MEDIA");
    err.userMessage = "❌ Hãy reply ảnh/GIF/video/sticker rồi gõ lệnh.";
    throw err;
  }

  // Chỉ nhận sticker động/GIF qua stkvd: ảnh tĩnh vẫn cho qua stk (loop 2.5s)
  const file = await converter.makeStickerFile(url, CACHE_DIR, forceStatic, pickFetcher(api, url));
  let stickerUrl = null;
  let via = "zalo";

  try {
    // Zalo CDN trước (mọi kích thước) — sticker bền vững, không phụ thuộc host ngoài
    try {
      const uploaded = await api.uploadStickerImage({ filePath: file.path, threadId, threadType: type });
      // Handle shapes: {normalUrl} | {data:{normalUrl}} | {data:[...]}
      const u = (uploaded && typeof uploaded === "object") ? uploaded : {};
      const d = (u.data && typeof u.data === "object" && !Array.isArray(u.data)) ? u.data : u;
      const cdnUrl = d.normalUrl || d.hdUrl || d.thumbUrl || d.url || d.oriUrl ||
        u.normalUrl || u.hdUrl || u.thumbUrl || u.url;
      if (cdnUrl) {
        stickerUrl = buildStickerUrl(String(cdnUrl), file.format === "webp");
      } else {
        console.error("[stk] Zalo upload returned no URL:", JSON.stringify(uploaded).slice(0, 400));
      }
    } catch (error) {
      const detail = [error?.code != null ? `code=${error.code}` : "", error?.message || String(error)]
        .filter(Boolean).join(" ");
      console.error("[stk] Zalo upload failed:", detail);
    }
    // Zalo thất bại → catbox.moe
    if (!stickerUrl) {
      const catboxUrl = await uploadCatbox(file.path);
      stickerUrl = buildStickerUrl(catboxUrl, file.format === "webp");
      via = "catbox";
    }
  } finally {
    try { fs.unlinkSync(file.path); } catch { /* bỏ qua */ }
  }

  if (!stickerUrl) {
    const err = new Error("UPLOAD_FAILED");
    err.userMessage = "❌ Upload sticker thất bại (cả Zalo CDN và catbox.moe). Thử lại sau hoặc đổi file khác.";
    throw err;
  }

  const replyMsgId = event?.data?.quote?.msgId || null;
  await api.sendCustomStickerUrl({
    staticImgUrl: stickerUrl,
    animationImgUrl: stickerUrl,
    threadId,
    threadType: type,
    reply: replyMsgId,
    width: file.width,
    height: file.height,
    variant
  });

  return { via, width: file.width, height: file.height, format: file.format };
}

module.exports = { createAndSend, pickMediaUrl, cleanMediaUrl };
