/**
 * Chạy RIÊNG panel quản lý (không cần panel mode của index.js):
 *   npm run panel
 * → panel API trên port panel.port (mặc định 3000), điều khiển bot con.
 * Dùng khi đã có bot chính chạy (JohnTran.js) và muốn mở thêm panel.
 */
const path = require("path");
const configSystem = require("../core/config");
const logger = require("../utils/logger");
const { BotManager } = require("./botManager");
const { startPanel } = require("./server");

const config = configSystem.load();
global.config = config;

logger.log("─── PANEL QUẢN LÝ (standalone) ───", "info");
logger.log(`Panel: http://${config.panel.host === "0.0.0.0" ? "localhost" : config.panel.host}:${config.panel.port}/`, "info");
if (!config.panel.token) {
  logger.log("Cảnh báo: panel.token đang trống — ai biết URL cũng điều khiển được bot!", "warn");
}

const manager = new BotManager();
startPanel({ manager, config });

const shutdown = async () => {
  logger.log("Đang dừng panel và bot con...", "warn");
  await manager.stopAll();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
