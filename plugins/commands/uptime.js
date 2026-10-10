module.exports.config = {
  name: 'uptime',
  version: '2.0.0',
  role: 0,
  author: 'ᴶᴼᴴᴺ ᵀᴿᴬᴺ',
  description: 'Hiển thị thời gian hoạt động của bot',
  category: 'Hệ thống',
  usage: 'uptime',
  cooldowns: 2,
  dependencies: {}
};

module.exports.run = async ({ event, reply }) => {
  const uptime = process.uptime();
  const days = Math.floor(uptime / 86400);
  const hours = Math.floor((uptime % 86400) / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  const seconds = Math.floor(uptime % 60);

  const parts = [];
  if (days > 0) parts.push(`${days} ngày`);
  if (hours > 0) parts.push(`${hours} giờ`);
  if (minutes > 0) parts.push(`${minutes} phút`);
  parts.push(`${seconds} giây`);

  return reply.card({
    theme: "success",
    title: "Bot đang hoạt động",
    subtitle: global.config.name_bot,
    sections: [{ title: "Thời gian uptime", lines: [`Uptime: ${parts.join(" ")}`] }],
    footer: `PID ${process.pid} • Node ${process.version}`
  });
};
