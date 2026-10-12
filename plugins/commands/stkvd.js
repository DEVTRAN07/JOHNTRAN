// /stkvd — TẠO STICKER ĐỘNG từ video/GIF/sticker động (reply)
// Cùng cơ chế /stk nhưng dùng biến thể payload "@STICKER" (bản gốc của
// repo ZALO-BOT) và nhận thêm URL .webp trực tiếp: /stkvd <url>
const { createAndSend, pickMediaUrl } = require("../../core/stickerCreate");
const { parseQuote } = require("../../core/mediaReply");

module.exports.config = {
  name: "stkvd",
  aliases: ["stkvideo"],
  version: "7.0.0",
  role: 0,
  author: "ᴶᴼᴴᴺ ᵀᴿᴬᴺ",
  description: "Tạo sticker ĐỘNG từ video/GIF (reply) hoặc URL .webp",
  category: "Tiện ích",
  usage: "stkvd (reply gif/video/sticker động) | stkvd <url .webp>",
  cooldowns: 5,
  dependencies: {}
};

const GUIDE =
  "❌ Hãy reply GIF/video/sticker động rồi gõ /stkvd\n" +
  "hoặc: /stkvd <link .webp>\n" +
  "Bot sẽ biến nó thành sticker Zalo thật.";

function isValidMediaUrl(url) {
  return /^https?:\/\/\S+$/i.test(String(url || ""));
}

module.exports.run = async function ({ api, event, args }) {
  const { threadId, type, data } = event;

  // ===== /stkvd <url .webp> — gửi sticker từ URL có sẵn =====
  const urlArg = (args || []).find((a) => isValidMediaUrl(a));
  if (urlArg) {
    await api.sendMessage({ msg: "⏳ Đang gửi sticker...", plain: true, ttl: 60000 }, threadId, type);
    try {
      await api.sendCustomStickerUrl({
        staticImgUrl: urlArg,
        animationImgUrl: urlArg,
        threadId,
        threadType: type,
        reply: data?.quote?.msgId || null,
        variant: "std"
      });
    } catch (error) {
      console.error("[stkvd]", error.message);
      return api.sendMessage({ plain: true, msg: `❌ Gửi sticker thất bại: ${error.message}`, ttl: 60000 }, threadId, type);
    }
    return;
  }

  // ===== Reply media → tạo sticker động =====
  if (!data?.quote) {
    return api.sendMessage({ plain: true, msg: GUIDE }, threadId, type);
  }

  // Kiểm tra nhanh: reply có media không (tránh báo lỗi khó hiểu từ tầng dưới)
  const media = parseQuote(event);
  if (!pickMediaUrl(media)) {
    return api.sendMessage({ plain: true, msg: "❌ Tin reply không có ảnh/video/GIF để tạo sticker." }, threadId, type);
  }

  await api.sendMessage({ msg: "⏳ Đang tạo sticker động...", plain: true, ttl: 60000 }, threadId, type);

  try {
    const result = await createAndSend({ api, event, variant: "std" });
    console.log(`[stkvd] đã gửi sticker ${result.width}x${result.height} (${result.format}, via ${result.via})`);
  } catch (error) {
    const msg = error.userMessage || `❌ Tạo sticker thất bại: ${error.message}`;
    console.error("[stkvd]", error.message);
    return api.sendMessage({ plain: true, msg, ttl: 60000 }, threadId, type);
  }
};
