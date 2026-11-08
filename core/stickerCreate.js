// ===== TẠO STICKER TỪ NỘI DUNG REPLY (ảnh/GIF/video) =====
// Flow:
//   1. Lấy URL media từ tin reply (ưu tiên webp của sticker động).
//   2. Tải về + convert sticker (WebP/GIF) bằng ffmpeg.
//   3. Upload lên CDN Zalo → URL.
//   4. Gửi photo_url với hậu tố "?sticker.webp" + properties sticker.
const fs = require("fs");
const path = require("path");
const converter = require("./stickerConvert");
const { buildStickerUrl, stripStickerSuffix, jxlToJpg } = require("./stickerFactory");

const CACHE_DIR = path.join(__dirname, "..", "assets", "cache", "sticker");

function cleanMediaUrl(url) {
  const raw = String(url || "").split("\\").join("/");
  return stripStickerSuffix(jxlToJpg(raw));
}

function pickMediaUrl(media) {
  if (!media) return null;
  return cleanMediaUrl(media.webpUrl) || cleanMediaUrl(media.video) ||
         cleanMediaUrl(media.image) || cleanMediaUrl(media.file) || null;
}

const ZALO_HOST_RE = /(^|\.)(zdn\.vn|dlfl\.vn|zadn\.vn|zaloapp\.com|zalo\.me|zalo\.ai)$/i;

function pickFetcher(api, url) {
  let host = "";
  try { host = new URL(url).hostname; } catch { return null; }
  if (ZALO_HOST_RE.test(host) && typeof api?.fetchZaloMedia === "function") {
    return (u) => api.fetchZaloMedia({ url: u });
  }
  return null;
}

function uploadErrorMessage(detail) {
  return "❌ Upload sticker lên Zalo CDN thất bại" +
    (detail ? ` (${detail})` : "") +
    ". Vui lòng thử lại sau hoặc kiểm tra phiên đăng nhập Zalo.";
}

async function createAndSend({ api, event, variant = "ai", forceStatic = false, sourceUrl = null }) {
  const { threadId, type } = event;
  const { parseQuote } = require("./mediaReply");
  const media = parseQuote(event);
  const url = sourceUrl ? cleanMediaUrl(sourceUrl) : pickMediaUrl(media);

  if (!url) {
    const err = new Error("NO_MEDIA");
    err.userMessage = "❌ Hãy reply ảnh/GIF/video/sticker rồi gõ lệnh.";
    throw err;
  }

  const file = await converter.makeStickerFile(url, CACHE_DIR, forceStatic, pickFetcher(api, url));
  let stickerUrl = null;

  try {
    // Không gửi ảnh xem trước (preview) — upload + gửi sticker trực tiếp.
    let uploaded;
    try {
      uploaded = await api.uploadStickerImage({ filePath: file.path, threadId, threadType: type });
    } catch (error) {
      const detail = [error?.code != null ? `code=${error.code}` : "", error?.message || String(error)]
        .filter(Boolean).join(" ");
      console.error("[stk] Zalo upload failed:", detail, error?.stack ? "\n" + error.stack : "");
      const err = new Error("ZALO_UPLOAD_FAILED");
      err.cause = error;
      err.userMessage = uploadErrorMessage(detail || "lỗi kết nối/API");
      throw err;
    }

    const u = (uploaded && typeof uploaded === "object") ? uploaded : {};
    const d = (u.data && typeof u.data === "object" && !Array.isArray(u.data)) ? u.data : u;
    const cdnUrl = d.normalUrl || d.hdUrl || d.thumbUrl || d.url || d.oriUrl ||
      u.normalUrl || u.hdUrl || u.thumbUrl || u.url;

    if (!cdnUrl) {
      console.error("[stk] Zalo upload returned no URL:", JSON.stringify(uploaded).slice(0, 600));
      const err = new Error("ZALO_UPLOAD_NO_URL");
      err.userMessage = uploadErrorMessage("không nhận được URL từ Zalo");
      throw err;
    }

    stickerUrl = buildStickerUrl(String(cdnUrl), file.format === "webp");
  } finally {
    try { fs.unlinkSync(file.path); } catch { /* bỏ qua */ }
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

  return { via: "zalo", width: file.width, height: file.height, format: file.format };
}

module.exports = { createAndSend, pickMediaUrl, cleanMediaUrl };
