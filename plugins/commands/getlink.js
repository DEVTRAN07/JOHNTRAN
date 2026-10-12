// /getlink — Lấy link từ tin nhắn được reply
//   reply tin có link/ảnh/video/file rồi gõ /getlink
const { parseQuote, hint } = require("../../core/mediaReply");

module.exports.config = {
  name: "getlink",
  aliases: ["link", "gl"],
  version: "4.0.0",
  role: 0,
  author: "ᴶᴼᴴᴺ ᵀᴿᴬᴺ",
  description: "Lấy link từ tin nhắn được reply",
  category: "Tiện ích",
  usage: "getlink (reply tin)",
  cooldowns: 3,
  dependencies: {}
};

module.exports.run = async function ({ api, event }) {
  const { threadId, type } = event;

  const media = parseQuote(event);
  if (!media) {
    return api.sendMessage({
      plain: true,
      msg: "❌ Hãy reply tin nhắn cần lấy link rồi gõ /getlink"
    }, threadId, type);
  }

  // Ưu tiên link video, rồi ảnh, rồi file
  const url = media.video || media.image || media.file;
  if (!url) return api.sendMessage({ plain: true, msg: hint("file") }, threadId, type);

  const kind = media.video ? "🎬 Video" : media.image ? "🖼️ Ảnh" : "📎 File";

  // Thử HEAD để biết link còn sống (chỉ ghi chú, không bắt buộc)
  let note = "";
  try {
    const http = require("../../core/http");
    const head = await http.request(url, { method: "HEAD", timeout: 12000 });
    if (head?.status === 200) note = "✅ Link sống";
  } catch { /* bỏ qua */ }

  return api.sendMessage({
    plain: true,
    msg: `🔗 ${kind}\n━━━━━━━━━━\n${url}\n━━━━━━━━━━\n${note}`
  }, threadId, type);
};
