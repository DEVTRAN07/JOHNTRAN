// /stkvd — Sticker ĐỘNG (chỉ GIF / video / sticker động) — reply
//   reply sticker động → gửi lại bằng sendSticker (type 1)
//   reply GIF/video    → gửi lại dạng GIF/video
const fs = require("fs");
const path = require("path");
const os = require("os");
const { parseQuote, hint } = require("../../core/mediaReply");

module.exports.config = {
  name: "stkvd",
  aliases: ["stkvideo"],
  version: "4.0.0",
  role: 0,
  author: "ᴶᴼᴴᴺ ᵀᴿᴬᴺ",
  description: "Chỉ GIF / video / sticker động (reply)",
  category: "Tiện ích",
  usage: "stkvd (reply gif/video/sticker động)",
  cooldowns: 5,
  dependencies: {}
};

// Sticker động Zalo = type 1
const ANIMATED_TYPE = 1;

// Từ chối ảnh tĩnh (không phải GIF/video/sticker động)
function isStaticImage(url, ext) {
  return /\.(jpg|jpeg|png|webp|bmp)(\?|$)/i.test(url) && !/gif/i.test(String(ext || ""));
}

module.exports.run = async function ({ api, event }) {
  const { threadId, type } = event;

  const media = parseQuote(event);
  if (!media) {
    return api.sendMessage({
      plain: true,
      msg: "❌ Hãy reply tin GIF/video/sticker động rồi gõ /stkvd"
    }, threadId, type);
  }

  // 1) Sticker động gốc → gửi lại nguyên (type 1)
  if (media.isSticker && media.sticker.cateId > 0 && media.sticker.type === ANIMATED_TYPE) {
    try {
      await api.sendSticker({
        id: media.sticker.id,
        cateId: media.sticker.cateId,
        type: ANIMATED_TYPE
      }, threadId, type);
      return;
    } catch (error) {
      console.error("stkvd (sticker động):", error.message);
    }
  }

  const url = media.video || media.file || media.image;
  if (!url) return api.sendMessage({ plain: true, msg: hint("gif") }, threadId, type);

  // Ảnh tĩnh không phải sticker động → từ chối
  if (!media.video && isStaticImage(url, media.ext)) {
    return api.sendMessage({
      plain: true,
      msg: "❌ Lệnh này chỉ nhận GIF / video / sticker động.\n" +
           "Nếu là ảnh tĩnh, dùng /stk."
    }, threadId, type);
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "jt_stkvd_"));
  try {
    const http = require("../../core/http");
    const { buffer } = await http.getBuffer(url, { timeout: 90000 });
    if (!buffer || !buffer.length) throw new Error("File rỗng");

    const ext = String(url).split("?")[0].match(/\.([a-z0-9]{2,5})$/i)?.[1]?.toLowerCase() || (media.video ? "mp4" : "gif");
    const filePath = path.join(tmpDir, `vd_${Date.now()}.${ext}`);
    fs.writeFileSync(filePath, buffer);

    await api.sendMessage({ msg: "", attachments: [filePath] }, threadId, type);
  } catch (error) {
    console.error("stkvd:", error.message);
    return api.sendMessage({ plain: true, msg: `❌ Gửi sticker động thất bại: ${error.message}` }, threadId, type);
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* bỏ qua */ }
  }
};
