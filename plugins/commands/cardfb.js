// /cardfb — thẻ thông tin người dùng Facebook (ảnh canvas)
//   /cardfb <username hoặc uid>   (vd: zuck)
// Cần Facebook Graph API token (chỉ admin cấu hình được):
//   config.yml → services.facebook_access_token
// Không có token → bot báo rõ cách bật, KHÔNG báo lỗi mơ hồ.
const { renderVipCard } = require("../../core/canvas/vip");
const services = require("../../core/services");

module.exports.config = {
  name: "cardfb",
  aliases: ["fb", "facebook"],
  version: "1.0.0",
  role: 0,
  author: "ᴶᴼᴴᴺ ᵀᴿᴬᴺ",
  description: "Thẻ thông tin người dùng Facebook",
  category: "Tiện ích",
  usage: "cardfb <username | uid>",
  cooldowns: 5,
  dependencies: {}
};

function shortNum(n) {
  const v = Number(n) || 0;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
  return String(v);
}

module.exports.run = async function ({ api, event, args, reply }) {
  const { threadId, type } = event;
  const raw = (args[0] || "").trim();
  if (!raw) {
    return reply.error(`Cách dùng: ${global.config.prefix}cardfb <username hoặc uid>`);
  }
  const username = raw.replace(/^@/, "").replace(/\/+$/, "");

  // Token: config.yml hoặc biến môi trường (ưu tiên env cho an toàn)
  const token = services.serviceUrl("facebook_access_token") || process.env.FB_ACCESS_TOKEN;
  const base = services.serviceUrl("facebook_api_url") || "https://graph.facebook.com/v19.0";
  if (!token) {
    return reply.error(
      "Lệnh này cần Facebook Graph API token.\n" +
      "Cách bật: đặt token vào config.yml → services.facebook_access_token\n" +
      "(hoặc biến môi trường FB_ACCESS_TOKEN). Lấy token tại\n" +
      "https://developers.facebook.com → công cụ Graph API Explorer."
    );
  }

  try {
    const res = await require("axios").get(`${base}/${encodeURIComponent(username)}`, {
      params: {
        fields: "id,name,username,picture.width(800),cover,followers_count,fan_count,about,link,gender,birthday,location",
        access_token: token
      },
      timeout: 30000
    });
    const info = res.data || {};
    if (!info.id) {
      return reply.error(`Không tìm thấy người dùng Facebook: ${username}`);
    }

    const avatar = info.picture?.data?.url || info.picture?.url || "";
    const cardPath = await renderVipCard({
      theme: "music",
      icon: "📘",
      title: String(info.name || username),
      subtitle: `@${info.username || info.id} • 🆔 ${info.id}`,
      background: avatar || undefined,
      rows: [
        { label: "Theo dõi", lines: [
          `👥 ${shortNum(info.followers_count)} người theo dõi`,
          `📄 ${shortNum(info.fan_count)} trang/lượt thích`
        ] },
        { label: "Thông tin", lines: [
          info.gender ? `⚧ ${info.gender}` : "⚧ Không công khai",
          info.birthday ? `🎂 ${info.birthday}` : "🎂 Không công khai",
          info.location?.name ? `📍 ${info.location.name}` : "📍 Không công khai"
        ] },
        { label: "Giới thiệu", lines: [info.about ? String(info.about).slice(0, 80) : "Không có"] }
      ],
      footer: "ᴶᴼᴴᴺ ᵀᴿᴬᴺ • CARD FACEBOOK",
      ttl: 300000
    });

    try {
      await api.sendMessage({ msg: "", attachments: cardPath, ttlKind: "card" }, threadId, type);
    } catch (error) {
      return reply.error(`Có thông tin nhưng không gửi được ảnh: ${error.message}`);
    } finally {
      const fs = require("fs");
      if (fs.existsSync(cardPath)) fs.unlinkSync(cardPath);
    }
  } catch (error) {
    const code = error.response?.status;
    const msg = error.response?.data?.error?.message || error.message;
    console.error("Lỗi cardfb:", code, msg);
    if (code === 400 || code === 190) {
      return reply.error(`Facebook từ chối token (${code}). ${msg}`);
    }
    return reply.error(`Không lấy được thông tin Facebook: ${String(msg).slice(0, 120)}`);
  }
};
