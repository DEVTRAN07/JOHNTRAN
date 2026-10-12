// /cardfb — thẻ hồ sơ Facebook (ảnh canvas)
//   /cardfb zuck  |  /cardfb 4  |  /cardfb https://www.facebook.com/zuck
// Dữ liệu lấy qua scripts/social_info.py (curl_cffi giả lập TLS Chrome).
const profile = require("../../core/canvas/profile");
const { fetchSocial, explain } = require("../../core/socialFetch");

module.exports.config = {
  name: "cardfb",
  aliases: ["fb", "facebook"],
  version: "3.0.0",
  role: 0,
  author: "ᴶᴼᴴᴺ ᵀᴿᴬᴺ",
  description: "Thẻ hồ sơ người dùng Facebook",
  category: "Tiện ích",
  usage: "cardfb <username | uid | link>",
  cooldowns: 10,
  dependencies: {}
};

function shortNum(n) {
  const v = Number(n) || 0;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
  return String(v);
}

function parseTarget(raw) {
  return String(raw || "")
    .trim()
    .replace(/^@/, "")
    .replace(/^https?:\/\/(www\.|m\.|web\.|business\.)?facebook\.com\//, "")
    .replace(/\?.*$/, "")
    .replace(/\/+$/, "")
    .replace(/\/.*$/, "")
    .replace(/profile\.php\?id=/, "")
    .trim();
}

module.exports.run = async function ({ api, event, args, reply }) {
  const { threadId, type } = event;

  const raw = (args[0] || "").trim();
  if (!raw) {
    return api.sendMessage({ plain: true, msg: `Cách dùng: ${global.config.prefix}cardfb <username, uid hoặc link>` }, threadId, type);
  }
  const target = parseTarget(raw);
  if (!target || target.length < 1) {
    return api.sendMessage({ plain: true, msg: `❌ Không đọc được username từ: ${raw}` }, threadId, type);
  }

  const { data: info, error, code } = await fetchSocial("facebook", target);
  if (!info) {
    return api.sendMessage({ plain: true, msg: `❌ ${explain(code, target, "facebook")}` }, threadId, type);
  }

  const cardPath = await profile.renderProfile({
    skin: "facebook",
    title: String(info.name || target),
    handle: info.username ? `@${info.username}` : (info.fb_id ? `🆔 ${info.fb_id}` : undefined),
    subtitle: info.category ? String(info.category).slice(0, 40) : undefined,
    avatar: info.avatar || undefined,
    rows: [
      { icon: "👤", label: "Tên", value: info.name || "—" },
      { icon: "📄", label: "Người theo dõi", value: shortNum(info.followers) },
      { icon: "💬", label: "Giới thiệu", value: info.about ? String(info.about).slice(0, 60) : "Không công khai" },
      { icon: "🏷️", label: "Loại trang", value: info.category || "Cá nhân" },
      { icon: "✅", label: "Xác minh", value: info.verified ? "Đã xác minh ✅" : "Chưa xác minh" },
      { icon: "🆔", label: "ID", value: info.fb_id || target }
    ],
    footer: "CARD FACEBOOK"
  });

  try {
    await api.sendMessage({ msg: "", attachments: cardPath, ttlKind: "card" }, threadId, type);
  } catch (error) {
    return api.sendMessage({ plain: true, msg: `Có hồ sơ nhưng gửi ảnh thất bại: ${error.message}` }, threadId, type);
  } finally {
    profile.cleanup(cardPath);
  }
};
