const moment = require("moment-timezone");

module.exports.config = {
  name: "useprefix",
  version: "2.0.0",
  role: 0,
  author: "ᴶᴼᴴᴺ ᵀᴿᴬᴺ",
  description: "Hiện thông tin nhanh khi gửi prefix",
  category: "NO PREFIX",
  usage: "useprefix",
  cooldowns: 2,
  dependencies: {}
};

module.exports.run = async ({ event, reply }) => {
    const timeDate = moment.tz("Asia/Ho_Chi_Minh");
    const uptime = process.uptime();
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);

    const parts = [];
    if (hours > 0) parts.push(`${hours} giờ`);
    if (minutes > 0) parts.push(`${minutes} phút`);
    parts.push(`${seconds} giây`);

    return reply.card({
        theme: "brand",
        title: global.config.name_bot,
        subtitle: `Thời gian hoạt động: ${parts.join(" ")}`,
        sections: [{ title: "Bây giờ", lines: [`${timeDate.format("HH:mm:ss")} • ${timeDate.format("DD/MM/YYYY")}`] }],
        footer: "Dùng /menu hoặc /help để xem danh sách lệnh"
    });
};
