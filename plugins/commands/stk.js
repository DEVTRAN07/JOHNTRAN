// /stk — TẠO STICKER THẬT từ nội dung reply (ảnh/GIF/video/sticker) hoặc URL
const { createAndSend, pickMediaUrl } = require("../../core/stickerCreate");
const { parseQuote } = require("../../core/mediaReply");

module.exports.config = {
  name: "stk",
  aliases: ["sticker", "stkvd", "stkvideo"],
  version: "7.0.0",
  role: 0,
  author: "ᴶᴼᴴᴺ ᵀᴿᴬᴺ",
  description: "Tạo sticker thật từ ảnh/GIF/video (reply) hoặc URL .webp",
  category: "Tiện ích",
  usage: "stk (reply ảnh/gif/video/sticker) | stk <url .webp>",
  cooldowns: 5,
  dependencies: {}
};

const GUIDE =
  "❌ Hãy reply ảnh/GIF/video/sticker rồi gõ /stk\n" +
  "hoặc: /stk <link .webp>\n" +
  "Bot sẽ biến nó thành sticker Zalo thật.";

function isValidMediaUrl(url) {
  return /^https?:\/\/\S+$/i.test(String(url || ""));
}

module.exports.run = async function ({ api, event, args }) {
  const { threadId, type, data } = event;

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
      console.error("[stk]", error.message);
      return api.sendMessage({ plain: true, msg: `❌ Gửi sticker thất bại: ${error.message}`, ttl: 60000 }, threadId, type);
    }
    return;
  }

  const hasQuote = Boolean(data?.quote);
  if (!hasQuote) {
    return api.sendMessage({ plain: true, msg: GUIDE }, threadId, type);
  }

  const media = parseQuote(event);
  if (!pickMediaUrl(media)) {
    return api.sendMessage({ plain: true, msg: "❌ Tin reply không có ảnh/video/GIF để tạo sticker." }, threadId, type);
  }

  await api.sendMessage({ msg: "⏳ Đang tạo sticker...", plain: true, ttl: 60000 }, threadId, type);

  const variant = (media && (media.video || media.webpUrl)) ? "std" : "ai";

  try {
    const result = await createAndSend({ api, event, variant });
    console.log();
  } catch (error) {
    const msg = error.userMessage || `❌ Tạo sticker thất bại: ${error.message}`;
    console.error("[stk]", error.message);
    return api.sendMessage({ plain: true, msg, ttl: 60000 }, threadId, type);
  }
};
