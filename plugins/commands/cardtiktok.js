// /cardtiktok — thẻ thông tin người dùng TikTok (ảnh canvas)
//   /cardtiktok <username>     (vd: @tiktok)
// Dùng API công khai (tikwm...). Nếu API chết/không cấu hình thì báo rõ,
// KHÔNG báo lỗi mơ hồ. Admin có thể trỏ API khác trong config.yml:
//   services.tiktok_api_url
const { renderVipCard } = require("../../core/canvas/vip");
const services = require("../../core/services");

module.exports.config = {
  name: "cardtiktok",
  aliases: ["tiktok", "tt"],
  version: "1.0.0",
  role: 0,
  author: "ᴶᴼᴴᴺ ᵀᴿᴬᴺ",
  description: "Thẻ thông tin người dùng TikTok",
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
  if (!raw) {
    return reply.error(`Cách dùng: ${global.config.prefix}cardtiktok <username>`);
  }
  const username = raw.replace(/^@/, "").replace(/\/+$/, "");

  // Chuỗi API thử lần lượt: endpoint admin tự cấu hình → tikwm
  const bases = [...new Set([services.serviceUrl("tiktok_api_url"), "https://www.tikwm.com/api"].filter(Boolean))];
  const errors = [];

  for (const base of bases) {
    try {
      const res = await require("axios").get(`${base}/user/info`, {
        params: { unique_id: username, count: 0 },
        timeout: 30000,
        headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36", Accept: "application/json" }
      });
      const info = res.data?.data?.user || res.data?.user;
      const stats = res.data?.data?.stats || res.data?.stats;
      if (info) {
        const cardPath = await renderVipCard({
          theme: "ai",
          icon: "🎵",
          title: `@${info.unique_id || username}`,
          subtitle: `${info.nickname || "TikTok"}${info.private_account ? " • 🔒 Riêng tư" : ""}`,
          background: info.avatarLarger || info.avatarMedium || info.avatarThumb || undefined,
          rows: [
            { label: "Thống kê", lines: [
              `👥 ${shortNum(stats?.followerCount)} người theo dõi`,
              `❤️ ${shortNum(stats?.heartCount || stats?.heart)} lượt thích`,
              `🎬 ${shortNum(stats?.videoCount)} video`
            ] },
            { label: "Chữ ký", lines: [info.signature ? String(info.signature).slice(0, 80) : "Không có"] }
          ],
          footer: "ᴶᴼᴴᴺ ᵀᴿᴬᴺ • CARD TIKTOK",
          ttl: 300000
        });
        const fs = require("fs");
        try {
          await api.sendMessage({ msg: "", attachments: cardPath, ttlKind: "card" }, threadId, type);
          return;
        } catch (error) {
          return reply.error(`Có thông tin nhưng không gửi được ảnh: ${error.message}`);
        } finally {
          if (fs.existsSync(cardPath)) fs.unlinkSync(cardPath);
        }
      }
      errors.push(`${base}: ${res.data?.msg || "không có dữ liệu"}`);
    } catch (error) {
      errors.push(`${base}: ${error.message}`);
    }
  }

  console.error("Lỗi cardtiktok:", errors.join(" | "));
  return reply.error(
    `Không lấy được thông tin TikTok của @${username}.\n` +
    `Chi tiết: ${errors.join(" | ").slice(0, 160)}\n\n` +
    `💡 Các API TikTok công khai hiện hay chặn. Nếu bạn có API riêng, đặt vào config.yml → services.tiktok_api_url.`
  );
};
