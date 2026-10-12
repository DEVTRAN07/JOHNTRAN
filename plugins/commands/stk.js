// /stk — TẠO STICKER THẬT từ nội dung reply (ảnh/GIF/video/sticker)
// Reply tin ảnh/GIF/video/sticker rồi gõ /stk:
//   1. Tải media về → convert WebP (ffmpeg, 480px, tối đa 8s).
//   2. Upload lên CDN Zalo → URL.
//   3. Gửi photo_url + hậu tố "?sticker.webp" + properties type:3
//      → Zalo app hiển thị thành STICKER THẬT (không khung ảnh).
const { createAndSend } = require("../../core/stickerCreate");

module.exports.config = {
  name: "stk",
  aliases: ["sticker"],
  version: "7.0.0",
  role: 0,
  author: "ᴶᴼᴴᴺ ᵀᴿᴬᴺ",
  description: "Tạo sticker thật từ ảnh/GIF/video (reply)",
  category: "Tiện ích",
  usage: "stk (reply ảnh/gif/video/sticker)",
  cooldowns: 5,
  dependencies: {}
};

const GUIDE =
  "❌ Hãy reply ảnh/GIF/video/sticker rồi gõ /stk\n" +
  "Bot sẽ biến nội dung đó thành sticker Zalo thật.";

module.exports.run = async function ({ api, event, args }) {
  const { threadId, type, data } = event;

  // Không có reply → hướng dẫn
  const hasQuote = Boolean(data?.quote);
  if (!hasQuote) {
    return api.sendMessage({ plain: true, msg: GUIDE }, threadId, type);
  }

  await api.sendMessage({ msg: "⏳ Đang tạo sticker...", plain: true, ttl: 60000 }, threadId, type);

  try {
    const result = await createAndSend({ api, event, variant: "ai" });
    console.log(`[stk] đã gửi sticker ${result.width}x${result.height} (${result.format}, via ${result.via})`);
  } catch (error) {
    const msg = error.userMessage || `❌ Tạo sticker thất bại: ${error.message}`;
    console.error("[stk]", error.message);
    return api.sendMessage({ plain: true, msg, ttl: 60000 }, threadId, type);
  }
};
