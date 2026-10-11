const os = require("os");
const moment = require("moment-timezone");

function getUptime() {
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
  return parts.join(" ");
}

function getSystemInfo() {
  const totalMem = os.totalmem() / (1024 * 1024);
  const freeMem = os.freemem() / (1024 * 1024);
  const usedMem = totalMem - freeMem;
  const load = os.loadavg()[0];

  return `🚀 Hệ thống bot:\n` +
    `⏰ Hiện tại: ${moment().tz("Asia/Ho_Chi_Minh").format("HH:mm:ss | DD/MM/YYYY")}\n` +
    `⏳ Hoạt động: ${getUptime()}\n` +
    `💾 RAM: ${usedMem.toFixed(0)}MB / ${totalMem.toFixed(0)}MB\n` +
    `📊 CPU Load: ${load.toFixed(2)}\n` +
    `🧠 Node: ${process.version} | PID ${process.pid}`;
}

module.exports.config = {
  name: "uptime",
  version: "2.0.0",
  role: 0,
  author: "ᴶᴼᴴᴺ ᵀᴿᴬᴺ",
  description: "Xem thời gian hoạt động và thông tin hệ thống",
  category: "Hệ thống",
  usage: "uptime",
  cooldowns: 5,
  dependencies: {}
};

module.exports.run = async ({ api, event }) => {
  const { threadId, type } = event;
  try {
    const message = await api.sendMessage({ msg: getSystemInfo(), ttl: 60000 }, threadId, type);
    setTimeout(() => {
      try {
        api.deleteMessage(message.messageId, threadId, type);
      } catch { /* bỏ qua */ }
    }, 10000);
  } catch (error) {
    console.error("Lỗi uptime:", error.message);
    api.sendMessage({ msg: "❌ Không lấy được thông tin hệ thống", ttl: 30000 }, threadId, type);
  }
};
