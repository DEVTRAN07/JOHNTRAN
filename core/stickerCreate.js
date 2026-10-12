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
const CATBOX_URL = "https://catbox.moe/user/api.php";

function cleanMediaUrl(url) {
  return stripStickerSuffix(jxlToJpg(String(url || "").replace(/\\\//g, "/")));
}

// URL nguồn từ tin reply: sticker động → webp.url, rồi video → ảnh → file
function pickMediaUrl(media) {
  if (!media) return null;
  return cleanMediaUrl(media.webpUrl) || cleanMediaUrl(media.video) ||
         cleanMediaUrl(media.image) || cleanMediaUrl(media.file) || null;
}

// Upload Catbox (multipart thủ công — core/http chỉ nhận string/Buffer body)
async function uploadCatbox(filePath) {
  const fileName = path.basename(filePath);
  const fileBuffer = fs.readFileSync(filePath);
  const boundary = "----JTCatbox" + Date.now().toString(16);
  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="reqtype"\r\n\r\nfileupload\r\n` +
      `--${boundary}\r\nContent-Disposition: form-data; name="fileToUpload"; ` +
      `filename="${fileName}"\r\nContent-Type: application/octet-stream\r\n\r\n`
    ),
    fileBuffer,
    Buffer.from(`\r\n--${boundary}--\r\n`)
  ]);

  const res = await http.request(CATBOX_URL, {
    method: "POST",
    timeout: 60000,
    headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
    body
  });

  const text = res.text().trim();
  if (!text.startsWith("http")) throw new Error("Catbox trả về: " + text.slice(0, 80));
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
  const file = await converter.makeStickerFile(url, CACHE_DIR, forceStatic);
  let stickerUrl = null;
  let via = "zalo";

  try {
    // File nhỏ → Zalo CDN trước (sticker bền vững, không phụ thuộc host ngoài)
    if (file.size <= converter.SIZE_LIMIT) {
      try {
        const uploaded = await api.uploadStickerImage({ filePath: file.path, threadId, threadType: type });
        const cdnUrl = uploaded?.normalUrl || uploaded?.hdUrl || uploaded?.thumbUrl || uploaded?.url;
        if (cdnUrl) {
          // Đổi đuôi .webp cho CDN (GIF vẫn giữ nguyên — hậu tố mới là thứ quyết định)
          stickerUrl = buildStickerUrl(cdnUrl, file.format === "webp");
        }
      } catch (error) {
        console.error("[stk] Zalo upload lỗi:", error.message);
      }
    }
    // File to / upload lỗi → Catbox
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
    err.userMessage = "❌ Upload sticker thất bại. Thử lại sau.";
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
