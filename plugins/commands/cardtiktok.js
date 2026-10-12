// /cardtiktok — thẻ hồ sơ TikTok (ảnh canvas)
//   /cardtiktok @tiktok  |  /cardtiktok tiktok  |  /cardtiktok <link profile>
// Dữ liệu lấy qua scripts/social_info.py (curl_cffi giả lập TLS Chrome —
// Node.js thuần bị Cloudflare chặn nên không lấy được).
const profile = require("../../core/canvas/profile");
const { fetchSocial, explain } = require("../../core/socialFetch");

module.exports.config = {
  name: "cardtiktok",
  aliases: ["tiktok", "tt"],
  version: "3.0.0",
  role: 0,
  author: "ᴶᴼᴴᴺ ᵀᴿᴬᴺ",
  description: "Thẻ hồ sơ người dùng TikTok",
  category: "Tiện ích",
  usage: "cardtiktok <username | link>",
  cooldowns: 10,
  dependencies: {}
};

function shortNum(n) {
  const v = Number(n) || 0;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
  return String(v);
}

// Chấp nhận: @user | user | https://www.tiktok.com/@user | .../video/123
function parseTarget(raw) {
  return String(raw || "")
    .trim()
    .replace(/^@/, "")
    .replace(/^https?:\/\/(www\.|m\.)?tiktok\.com\/@?/, "")
    .replace(/^https?:\/\/vt\.tiktok\.com\/\w+/, "")
    .replace(/\/+$/, "")
    .replace(/\/.*$/, "")
    .trim();
}

module.exports.run = async function ({ api, event, args, reply }) {
  const { threadId, type } = event;

  const raw = (args[0] || "").trim();
  if (!raw) {
    return api.sendMessage({ plain: true, msg: `Cách dùng: ${global.config.prefix}cardtiktok <username hoặc link>` }, threadId, type);
  }
  const target = parseTarget(raw);
  if (!target || target.length < 2) {
    return api.sendMessage({ plain: true, msg: `❌ Không đọc được username từ: ${raw}` }, threadId, type);
  }

  const { data: info, error, code } = await fetchSocial("tiktok", target);
  if (!info) {
    return api.sendMessage({ plain: true, msg: `❌ ${explain(code, target, "tiktok")}` }, threadId, type);
  }

  const cardPath = await profile.renderProfile({
    skin: "tiktok",
    title: String(info.nickname || info.username || target),
    handle: `@${info.username || target}`,
    subtitle: info.private ? "🔒 Tài khoản riêng tư" : (info.bio ? String(info.bio).slice(0, 44) : undefined),
    avatar: info.avatar || undefined,
    rows: [
      { icon: "👥", label: "Người theo dõi", value: shortNum(info.followers) },
      { icon: "❤️", label: "Lượt thích", value: shortNum(info.hearts) },
      { icon: "🎬", label: "Số video", value: shortNum(info.videos) },
      { icon: "🤝", label: "Đang theo dõi", value: shortNum(info.following) },
      { icon: "✅", label: "Xác minh", value: info.verified ? "Đã xác minh ✅" : "Chưa xác minh" },
      { icon: "🆔", label: "Username", value: `@${info.username || target}` }
    ],
    footer: "CARD TIKTOK"
  });

  try {
    await api.sendMessage({ msg: "", attachments: cardPath, ttlKind: "card" }, threadId, type);
  } catch (error) {
    return api.sendMessage({ plain: true, msg: `Có hồ sơ nhưng gửi ảnh thất bại: ${error.message}` }, threadId, type);
  } finally {
    profile.cleanup(cardPath);
  }
};
