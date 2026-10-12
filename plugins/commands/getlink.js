// /getlink — lấy URL media/link từ tin nhắn hoặc link dán vào
//   reply tin nhắn (ảnh/video/file/link) rồi gõ /getlink
//   hoặc: /getlink <url>
const http = require("../../core/http");

// Zalo gửi link dạng text hoặc object { href }
function urlFromContent(content) {
  if (typeof content === "string") {
    const m = content.match(/https?:\/\/[^\s<>"']+/i);
    return m ? m[1] : null;
  }
  if (content && typeof content === "object") {
    if (typeof content.href === "string" && /^https?:\/\//i.test(content.href)) return content.href;
    if (typeof content.title === "string") {
      const m = content.title.match(/https?:\/\/[^\s<>"']+/i);
      if (m) return m[1];
    }
  }
  return null;
}

// Link media trong tin (ảnh/video/voice/gif): ưu tiên playUrl/thumb/url
function mediaFromContent(content) {
  if (!content || typeof content !== "object") return null;
  const keys = ["playUrl", "thumbUrl", "normalUrl", "hdUrl", "oriUrl", "fileUrl", "thumb", "url", "src", "oriUrl"];
  for (const key of keys) {
    const value = content[key];
    if (typeof value === "string" && /^https?:\/\//i.test(value)) return { kind: "media", url: value, key };
  }
  return null;
}

module.exports.config = {
  name: "getlink",
  aliases: ["link", "gl"],
  version: "3.0.0",
  role: 0,
  author: "ᴶᴼᴴᴺ ᵀᴿᴬᴺ",
  description: "Lấy link từ tin nhắn hoặc URL",
  category: "Tiện ích",
  usage: "getlink (reply tin) hoặc getlink <url>",
  cooldowns: 3,
  dependencies: {}
};

module.exports.run = async function ({ api, event, args }) {
  const { threadId, type, data } = event;

  // 1) URL gõ tay
  if (args[0]) {
    const url = args[0].trim();
    if (!/^https?:\/\//i.test(url)) {
      return api.sendMessage({ plain: true, msg: "❌ Đây không phải URL hợp lệ (phải bắt đầu bằng http:// hoặc https://)." }, threadId, type);
    }
    return api.sendMessage({
      plain: true,
      msg: `🔗 LINK\n━━━━━━━━━━\n${url}\n━━━━━━━━━━\nCopy link ở trên để dùng.`
    }, threadId, type);
  }

  // 2) Tin được reply
  const quote = data?.quote || data?.dQuote || event?.data?.quote;
  if (!quote?.content) {
    // 3) Tin đang ở sau (nếu link trong caption chính tin này)
    const own = urlFromContent(data?.content) || mediaFromContent(data?.content);
    if (own) {
      return api.sendMessage({ plain: true, msg: `🔗 LINK\n━━━━━━━━━━\n${own.url || own}` }, threadId, type);
    }
    return api.sendMessage({
      plain: true,
      msg: "Reply tin nhắn có link/ảnh/video rồi gõ /getlink\n" +
           "hoặc gõ trực tiếp: /getlink <url>"
    }, threadId, type);
  }

  const found = urlFromContent(quote.content) || mediaFromContent(quote.content);
  if (!found) {
    return api.sendMessage({ plain: true, msg: "❌ Tin được reply không chứa link hoặc media công khai." }, threadId, type);
  }

  const url = found.url || found;
  const kind = found.key ? ` (${found.key})` : "";
  // Kiểm tra link còn sống không (chỉ ghi chú, không bắt buộc)
  let note = "";
  try {
    const head = await http.request(url, { method: "HEAD", timeout: 12000 });
    if (head.status === 200) note = "✅ Link sống";
  } catch { /* bỏ qua */ }

  return api.sendMessage({
    plain: true,
    msg: `🔗 LINK${kind}\n━━━━━━━━━━\n${url}\n━━━━━━━━━━\n${note}`
  }, threadId, type);
};
