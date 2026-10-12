// /cardtiktok — thẻ hồ sơ người dùng TikTok (ảnh canvas, kiểu mới)
//   /cardtiktok <username>   (vd: @tiktok hoặc tiktok)
// Nguồn dữ liệu: services.tiktok_api_url (admin tự cấu hình) → tikwm mặc định.
const profile = require("../../core/canvas/profile");
const services = require("../../core/services");

module.exports.config = {
  name: "cardtiktok",
  aliases: ["tiktok", "tt"],
  version: "2.1.0",
  role: 0,
  author: "ᴶᴼᴴᴺ ᵀᴿᴬᴺ",
  description: "Thẻ hồ sơ người dùng TikTok",
  category: "Tiện ích",
  usage: "cardtiktok <username>",
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
  if (!raw) return reply.error(`Cách dùng: ${global.config.prefix}cardtiktok <username>`);

  const username = raw.replace(/^@/, "").replace(/^https?:\/\/(www\.)?tiktok\.com\/@?/, "").replace(/\/.*$/, "").replace(/\/+$/, "");
  const bases = [...new Set([services.serviceUrl("tiktok_api_url"), "https://www.tikwm.com/api"].filter(Boolean))];
  const errors = [];

  for (const base of bases) {
    try {
      const res = await require("axios").get(`${base}/user/info`, {
        params: { unique_id: username, count: 0 },
        timeout: 30000,
        headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36", Accept: "application/json" }
      });
      const d = res.data?.data || res.data;
      const info = d?.user || d;
      const stats = d?.stats || info?.stats;
      if (!info?.unique_id && !info?.nickname) {
        errors.push(`${base}: ${res.data?.msg || "không có hồ sơ"}`);
        continue;
      }

      const avatar = info.avatarLarger || info.avatarMedium || info.avatarThumb || info.avatar || "";
      const cardPath = await profile.renderProfile({
        skin: "tiktok",
        title: String(info.nickname || username),
        handle: `@${info.unique_id || username}`,
        subtitle: info.private_account ? "🔒 Tài khoản riêng tư" : (info.signature ? String(info.signature).slice(0, 46) : undefined),
        avatar: avatar || undefined,
        rows: [
          { icon: "👥", label: "Người theo dõi", value: shortNum(stats?.followerCount) },
          { icon: "❤️", label: "Lượt thích", value: shortNum(stats?.heartCount || stats?.heart) },
          { icon: "🎬", label: "Số video", value: shortNum(stats?.videoCount) },
          { icon: "🤝", label: "Đang theo dõi", value: shortNum(stats?.followingCount) },
          { icon: "✅", label: "Xác minh", value: info.verified || info.custom_verify ? "Đã xác minh ✅" : "Chưa xác minh" }
        ],
        footer: "CARD TIKTOK"
      });

      try {
        await api.sendMessage({ msg: "", attachments: cardPath, ttlKind: "card" }, threadId, type);
        return;
      } catch (error) {
        return reply.error(`Có hồ sơ nhưng gửi ảnh thất bại: ${error.message}`);
      } finally {
        profile.cleanup(cardPath);
      }
    } catch (error) {
      errors.push(`${base}: ${error.response?.data?.msg || error.message}`);
    }
  }

  console.error("cardtiktok:", errors.join(" | "));
  return reply.error(
    `Không lấy được hồ sơ TikTok @${username}.\n` +
    `Chi tiết: ${errors.join(" | ").slice(0, 150)}\n\n` +
    `💡 API TikTok công khai hay bị chặn. Nếu bạn có nguồn riêng, đặt vào config.yml → services.tiktok_api_url.`
  );
};
