const fs = require("fs");
const path = require("path");
const logger = require("../utils/logger");

const COMMANDS_DIR = path.join(__dirname, "..", "plugins", "commands");
const EVENTS_DIR = path.join(__dirname, "..", "plugins", "events");
const DEBOUNCE_MS = 400;

let watcher = null;
let pending = new Map();

function registerCommand(filePath, { silent = true } = {}) {
  const fileName = path.basename(filePath, ".js");
  try {
    delete require.cache[require.resolve(filePath)];
    const plugin = require(filePath);
    if (!plugin?.config?.name) throw new Error("plugin thiếu config.name");
    const name = plugin.config.name.toLowerCase();
    global.client.commands.set(name, plugin);
    if (!silent) logger.log(`[hot-reload] Đã nạp lệnh '${name}'`, "info");
    return name;
  } catch (error) {
    logger.log(`[hot-reload] Lỗi nạp '${fileName}': ${error.message}`, "error");
    return null;
  }
}

function registerEvent(filePath, { silent = true } = {}) {
  const fileName = path.basename(filePath, ".js");
  try {
    delete require.cache[require.resolve(filePath)];
    const plugin = require(filePath);
    if (!plugin?.config?.name) throw new Error("plugin thiếu config.name");
    const name = plugin.config.name.toLowerCase();
    global.client.events.set(name, plugin);
    if (!silent) logger.log(`[hot-reload] Đã nạp event '${name}'`, "info");
    return name;
  } catch (error) {
    logger.log(`[hot-reload] Lỗi nạp '${fileName}': ${error.message}`, "error");
    return null;
  }
}

function handleChange(dir, type) {
  return (eventType, fileName) => {
    if (!fileName || !fileName.endsWith(".js")) return;
    const filePath = path.join(dir, fileName);
    if (!fs.existsSync(filePath)) return;
    if (pending.has(fileName)) return;
    pending.set(fileName, setTimeout(() => {
      pending.delete(fileName);
      if (type === "command") registerCommand(filePath, { silent: false });
      else registerEvent(filePath, { silent: false });
    }, DEBOUNCE_MS));
  };
}

function start() {
  if (watcher) return watcher;
  try {
    watcher = fs.watch(COMMANDS_DIR, handleChange(COMMANDS_DIR, "command"));
    // Thư mục events có thể không tồn tại (bot thuần lệnh) → bỏ qua, không chết watcher
    if (fs.existsSync(EVENTS_DIR)) fs.watch(EVENTS_DIR, handleChange(EVENTS_DIR, "event"));
    logger.log("[hot-reload] Đang theo dõi thay đổi plugin (sửa file là tự nạp lại)", "info");
  } catch (error) {
    logger.log(`[hot-reload] Không thể bật: ${error.message}`, "error");
  }
  return watcher;
}

function stop() {
  if (watcher) {
    watcher.close();
    watcher = null;
    for (const timer of pending.values()) clearTimeout(timer);
    pending.clear();
    logger.log("[hot-reload] Đã dừng theo dõi", "warn");
  }
}

function reloadAll() {
  let count = 0;
  if (!fs.existsSync(COMMANDS_DIR)) return count;
  for (const file of fs.readdirSync(COMMANDS_DIR)) {
    if (file.endsWith(".js") && registerCommand(path.join(COMMANDS_DIR, file))) count++;
  }
  if (fs.existsSync(EVENTS_DIR)) {
    for (const file of fs.readdirSync(EVENTS_DIR)) {
      if (file.endsWith(".js") && registerEvent(path.join(EVENTS_DIR, file))) count++;
    }
  }
  return count;
}

module.exports = { start, stop, reloadAll, registerCommand, registerEvent };
