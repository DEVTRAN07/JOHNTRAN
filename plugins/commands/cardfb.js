// /cardfb — thẻ hồ sơ người dùng Facebook (ảnh canvas, kiểu mới)
//   /cardfb <username | uid>   (vd: zuck hoặc 4)
// Cần token Graph API: config.yml → services.facebook_access_token hoặc env FB_ACCESS_TOKEN.
const profile = require("../../core/canvas/profile");
const services = require("../../core/services");

module.exports.config = {
  name: "cardfb",
  aliases: ["fb", "facebook"],
  version: "2.1.0",
  role: 0,
  author: "ᴶᴼᴴᴺ ᵀᴿᴬᴺ",
  description: "Thẻ hồ sơ người dùng Facebook",
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
  if (!raw) return reply.error(`Cách dùng: ${global.config.prefix}cardfb <username hoặc uid>`);

  const username = raw.replace(/^@/, "").replace(/^https?:\/\/(www\.|m\.|web\.)?facebook\.com\//, "").replace(/\/.*$/, "").replace(/\/+$/, "");

  const token = services.serviceUrl("facebook_access_token") || process.env.FB_ACCESS_TOKEN;
  const base = services.serviceUrl("facebook_api_url") || "https://graph.facebook.com/v19.0";

  if (!token) {
    return reply.error(
      "Thiếu Facebook Graph API token.\n\n" +
      "💡 config.yml → services.facebook_access_token: \"EAA...\"\n" +
      "Lấy token: developers.facebook.com → Graph API Explorer"
    );
  }

  try {
    const res = await require("axios").get(`${base}/${encodeURIComponent(username)}`, {
      params: {
        fields: "id,name,username,picture.width(800),cover,followers_count,fan_count,about,link,gender,birthday,location,is_verified",
        access_token: token
      },
      timeout: 30000
    });
    const info = res.data || {};
    if (!info.id) return reply.error(`Không tìm thấy người dùng Facebook: ${username}`);

    const avatar = info.picture?.data?.url || info.picture?.url || "";
    const cardPath = await profile.renderProfile({
      skin: "facebook",
      title: String(info.name || username),
      handle: `@${info.username || info.id}`,
      subtitle: info.link ? String(info.link).replace(/^https?:\/\/(www\.)?/, "") : undefined,
      avatar: avatar || undefined,
      rows: [
        { icon: "👥", label: "Người theo dõi", value: shortNum(info.followers_count) },
        { icon: "📄", label: "Lượt thích trang", value: shortNum(info.fan_count) },
        { icon: "⚧", label: "Giới tính", value: info.gender || "Không công khai" },
        { icon: "🎂", label: "Ngày sinh", value: info.birthday || "Không công khai" },
        { icon: "📍", label: "Địa điểm", value: info.location?.name || "Không công khai" },
        { icon: "✅", label: "Xác minh", value: info.is_verified ? "Đã xác minh ✅" : "Chưa xác minh" },
        { icon: "🆔", label: "ID", value: String(info.id) }
      ],
      footer: "CARD FACEBOOK"
    });

    try {
      await api.sendMessage({ msg: "", attachments: cardPath, ttlKind: "card" }, threadId, type);
    } catch (error) {
      return reply.error(`Có hồ sơ nhưng gửi ảnh thất bại: ${error.message}`);
    } finally {
      profile.cleanup(cardPath);
    }
  } catch (error) {
    const code = error.response?.status;
    const msg = error.response?.data?.error?.message || error.message;
    console.error("cardfb:", code, msg);
    if (code === 190 || code === 400) return reply.error(`Facebook từ chối token (${code}): ${msg}`);
    return reply.error(`Không lấy được hồ sơ Facebook: ${String(msg).slice(0, 130)}`);
  }
};
