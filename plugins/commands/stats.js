const metrics = require("../../core/metrics");
const { allStats } = require("../../core/cache");

const BRAND = "ᴶᴼᴴᴺ ᵀᴿᴬᴺ";

module.exports.config = {
  name: "stats",
  aliases: ["thongke", "metrics"],
  version: "2.0.0",
  role: 0,
  author: BRAND,
  description: "Thống kê hoạt động bot và cache",
  category: "Hệ thống",
  usage: "stats",
  cooldowns: 5,
  dependencies: {}
};

module.exports.run = async ({ reply }) => {
  const stats = metrics.getDayStats();
  const cacheStats = allStats();

  const top = metrics.topCommands();
  const topLines = top.length > 0
    ? top.map(([name, count], i) => `${i + 1}. ${name} — ${count} lần`)
    : ["Chưa có dữ liệu"];

  await reply.card({
    theme: "brand",
    title: "Thống kê hôm nay",
    subtitle: `Ngày ${stats.day}`,
    progress: { percent: Math.min(100, Math.round((stats.commands / 100) * 100)), label: `Lệnh đã dùng (mục tiêu 100)` },
    rows: [
      { icon: "chart", label: "Hoạt động", lines: [
        `Lệnh đã xử lý: ${stats.commands}`,
        `Tìm nhạc: ${stats.musicSearch} • Tải nhạc: ${stats.musicDownload}`,
        `AI: ${stats.aiRequests} • Giọng nói: ${stats.ttsRequests}`,
        `Lỗi: ${stats.errors}`
      ]},
      { icon: "list", label: "Top lệnh", lines: topLines },
      { icon: "spark", label: "Cache nội bộ", lines: Object.entries(cacheStats).map(([name, s]) => `${name}: ${s.size}/${s.max} (hit ${s.hitRate})`) }
    ],
    footer: `${BRAND} • uptime ${Math.floor(process.uptime() / 60)} phút`
  });
};
