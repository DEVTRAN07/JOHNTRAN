const fs = require("fs");
const path = require("path");
const login = require("./core/login");
const logger = require("./utils/logger");
const listener = require("./core/listen");
const loaderCommand = require("./core/loader/loaderCommand");
const loaderEvent = require("./core/loader/loaderEvent");
const configSystem = require("./core/config");
const { installAxiosGuard } = require("./core/http/axios");
const musicSystem = require("./core/music");
const hotReload = require("./core/hotReload");
const { startHealthServer } = require("./core/health");
const { bootstrapFiles } = require("./core/bootstrap");
const db = require("./utils/db");
const stats = require("./core/stats");
const schedule = require("node-schedule");
const { cleanOldMessages } = require("./utils/index");

global.client = new Object({
    commands: new Map(),
    events: new Map(),
    cooldowns: new Map()
});

global.users = {
  admin: [],
  support: []
};

global.config = new Object();

global.api = null;

const IS_CHILD = process.env.JT_PANEL_CHILD === "1";
const BOT_TAG = process.env.JT_BOT_NAME ? ` [${process.env.JT_BOT_NAME}]` : "";

// ===== Safety net: bot 24/7 không được chết vì 1 lỗi không mong đợi =====
process.on("unhandledRejection", (reason) => {
  logger.log(`Unhandled rejection${BOT_TAG}: ${reason?.message || reason}`, "error");
});
process.on("uncaughtException", (error) => {
  logger.log(`Uncaught exception${BOT_TAG}: ${error?.message || error}`, "error");
});

(async () => {

try {
    global.config = configSystem.load();
    global.users = {
      admin: global.config.admin_bot,
      support: global.config.support_bot
    };
    installAxiosGuard();
    logger.log(`Đã tải cấu hệ thống thành công${BOT_TAG} (privacy guard: bật)`, "info");
    // deploy cloud (Render/Koyeb...): khôi phục account/cookie/db từ env trước khi login
    bootstrapFiles();
    // mở health server TRƯỚC login: cloud platform cần port mở ngay
    startHealthServer();
} catch (error) {
    logger.log(`Lỗi khi đọc config: ${error.message || error}`, "error");
    process.exit(1);
}

const tempFolderCommand = path.join(__dirname, "plugins", "commands", "temp");
const tempFolderEvent = path.join(__dirname, "plugins", "events", "temp");

try {
  if (fs.existsSync(tempFolderCommand)) {
    fs.rmSync(tempFolderCommand, { recursive: true, force: true });
    logger.log("Đã dọn dẹp folder temp của commands", "info");
  } 
  if (fs.existsSync(tempFolderEvent)) {
    fs.rmSync(tempFolderEvent, { recursive: true, force: true });
    logger.log("Đã dọn dẹp folder temp của events", "info");
  }
} catch (error) {
  logger.log(`Lỗi khi dọn folder temp: ${error.message || error}`, "error");
}

logger.log("\n┏━━━━━━━━━━━━━━━━━━━━━━━━━━┓");
for (let i = 0; i <= global.users.admin.length - 1; i++) {
    const dem = i + 1;
    logger.log(` ID ADMIN ${dem}: ${!global.users.admin[i] ? "Trống" : global.users.admin[i]}`);
}
for (let i = 0; i <= global.users.support.length - 1; i++) {
    const dem = i + 1;
    logger.log(` ID SUPPORT ${dem}: ${!global.users.support[i] ? "Trống" : global.users.support[i]}`);
}
logger.log(` NAME BOT${BOT_TAG}: ${global.config.name_bot}`);
logger.log(` PREFIX: ${global.config.prefix}`)
logger.log(` NHẠC: ${musicSystem.listProviders().map((p) => p.name.toUpperCase()).join(" • ")}`);
logger.log("┗━━━━━━━━━━━━━━━━━━━━━━━━━━┛\n");
if (IS_CHILD) logger.log(`Bot con đang chạy${BOT_TAG} | pid ${process.pid}`, "info");

schedule.scheduleJob("0 * * * * *", () => {
    cleanOldMessages();
});

const api = await login();

global.api = api;

logger.log("Đã đăng nhập thành công", "info");

// Supabase: đợi đồng bộ mirror xong mới xử lý tin (tránh mất settings nhóm)
try {
  await db.ready?.();
} catch (error) {
  logger.log(`Chưa đồng bộ được database: ${error.message}`, "warn");
}

await loaderCommand();
await loaderEvent();

if (global.config.hot_reload) {
  hotReload.start();
}

// Gửi thống kê (hồ sơ, bạn bè, nhóm) lên store để panel hiển thị
const STATS_INTERVAL = 30000;
const sendStats = async () => {
  if (!global.api) return;
  try {
    const data = await stats.collectStats(global.api);
    db.saveData("BotStats", "name", process.env.JT_BOT_NAME || "main", {
      ...data,
      status: "online",
      updatedAt: Date.now()
    });
  } catch (error) {
    logger.log(`Không gửi được thống kê: ${error.message}`, "warn");
  }
};
sendStats();
setInterval(sendStats, STATS_INTERVAL).unref();

listener(api);

// Preload NỀN các thư viện nặng (jimp ~1.6s, cheerio ~4s, canvas ~0.9s,
// axios ~0.3s): bot đã chạy xong mới nạp — lệnh dùng lần ĐẦU cũng tức thì
// thay vì người dùng đầu tiên phải chờ. setImmediate + unref: không chặn,
// không giữ process.
setImmediate(() => {
  const heavy = ["jimp", "cheerio", "axios", "canvas"];
  for (const mod of heavy) {
    try { require(mod); } catch { /* thiếu module thì thôi */ }
  }
  logger.log("Đã preload nền: " + heavy.join(", "), "info");
});

})();
