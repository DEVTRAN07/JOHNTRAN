const fs = require("fs");
const path = require("path");
const logger = require("../../utils/logger");

const DEFAULT_FLUSH_DELAY = 400;

class JsonStore {
  constructor(file, tables = []) {
    this.file = path.resolve(file);
    this.data = {};
    this.flushTimer = null;
    this.pendingFlush = false;

    for (const table of tables) this.data[table] = {};

    this.load(tables);

    // ghi nốt dữ liệu khi thoát
    const flush = () => this.flushSync();
    process.on("exit", flush);
    process.on("SIGINT", () => { flush(); process.exit(0); });
    process.on("SIGTERM", () => { flush(); process.exit(0); });
  }

  load(tables) {
    try {
      if (fs.existsSync(this.file)) {
        const parsed = JSON.parse(fs.readFileSync(this.file, "utf8"));
        for (const table of tables) {
          this.data[table] = parsed[table] || {};
        }
        const count = Object.values(this.data).reduce((sum, table) => sum + Object.keys(table).length, 0);
        logger.log(`Đã nạp ${count} bản ghi từ ${path.basename(this.file)}`, "info");
      }
    } catch (error) {
      logger.log(`Không thể đọc ${this.file}: ${error.message}`, "error");
    }
  }

  table(name) {
    if (!this.data[name]) this.data[name] = {};
    return this.data[name];
  }

  has(table, idField, id) {
    return Object.prototype.hasOwnProperty.call(this.table(table), String(id));
  }

  get(table, idField, id) {
    const record = this.table(table)[String(id)];
    return record ? { ...record } : null;
  }

  set(table, idField, id, dataObj, extra = {}) {
    const key = String(id);
    const record = { [idField]: key, data: dataObj, ...extra, updatedAt: Date.now() };
    this.table(table)[key] = record;
    this.scheduleFlush();
    return record;
  }

  delete(table, idField, id) {
    const key = String(id);
    const existed = this.has(table, idField, key);
    delete this.table(table)[key];
    this.scheduleFlush();
    return existed;
  }

  all(table) {
    return Object.values(this.table(table));
  }

  count(table) {
    return Object.keys(this.table(table)).length;
  }

  scheduleFlush() {
    this.pendingFlush = true;
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      if (this.pendingFlush) this.flushSync();
    }, DEFAULT_FLUSH_DELAY);
    this.flushTimer.unref?.();
  }

  flushSync() {
    this.pendingFlush = false;
    const tmpFile = `${this.file}.tmp`;
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      fs.writeFileSync(tmpFile, JSON.stringify(this.data, null, 2), "utf8");
      fs.renameSync(tmpFile, this.file);
      return true;
    } catch (error) {
      logger.log(`Không thể ghi ${this.file}: ${error.message}`, "error");
      try { fs.unlinkSync(tmpFile); } catch { /* bỏ qua */ }
      return false;
    }
  }
}

module.exports = { JsonStore };
