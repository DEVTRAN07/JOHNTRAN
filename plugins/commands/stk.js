// /stk — Sticker từ ảnh/GIF/video/sticker (reply)
//   reply sticker  → gửi lại chính sticker đó (sendSticker)
//   reply ảnh/gif  → gửi lại dạng ảnh/GIF
//   reply video    → gửi lại dạng video
const fs = require("fs");
const path = require("path");
const os = require("os");
const { parseQuote, hint } = require("../../core/mediaReply");

module.exports.config = {
  name: "stk",
  aliases: ["sticker"],
  version: "4.0.0",
  role: 0,
  author: "ᴶᴼᴴᴺ ᵀᴿᴬᴺ",
  description: "Sticker từ ảnh/GIF/video/sticker (reply)",
  category: "Tiện ích",
  usage: "stk (reply ảnh/gif/video/sticker)",
  cooldowns: 5,
  dependencies: {}
};

// Tải file về rồi gửi lại theo đúng loại
async function sendFile(api, threadId, type, url, label, gif = false) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "jt_stk_"));
  try {
    const http = require("../../core/http");
    const { buffer } = await http.getBuffer(url, { timeout: 90000 });
    if (!buffer || !buffer.length) throw new Error("File rỗng");

    const ext = gif ? "gif" : (String(url).split("?")[0].match(/\.([a-z0-9]{2,5})$/i)?.[1] || "jpg").toLowerCase();
    const filePath = path.join(tmpDir, `reply_${Date.now()}.${ext}`);
    fs.writeFileSync(filePath, buffer);

    await api.sendMessage({ msg: label, attachments: [filePath] }, threadId, type);
    return true;
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* bỏ qua */ }
  }
}

module.exports.run = async function ({ api, event }) {
  const { threadId, type } = event;

  const media = parseQuote(event);
  if (!media) {
    return api.sendMessage({
      plain: true,
      msg: "❌ Hãy reply tin ảnh/GIF/video/sticker rồi gõ /stk"
    }, threadId, type);
  }

  // 1) Sticker gốc → gửi lại bằng sendSticker (giữ nguyên chất lượng)
  if (media.isSticker && media.sticker.cateId > 0) {
    try {
      await api.sendSticker({
        id: media.sticker.id,
        cateId: media.sticker.cateId,
        type: media.sticker.type || 0
      }, threadId, type);
      return;
    } catch (error) {
      console.error("stk (sticker gốc):", error.message);
      // rơi xuống gửi file bên dưới nếu có URL
    }
  }

  // 2) GIF/video → gửi lại file
  const url = media.video || media.file || media.image;
  if (!url) return api.sendMessage({ plain: true, msg: hint("sticker") }, threadId, type);

  const isGif = media.isGif || /\.gif(\?|$)/i.test(url) || /gif/i.test(String(media.ext || ""));
  try {
    await sendFile(api, threadId, type, url, "", isGif);
  } catch (error) {
    console.error("stk:", error.message);
    return api.sendMessage({ plain: true, msg: `❌ Gửi sticker thất bại: ${error.message}` }, threadId, type);
  }
};
