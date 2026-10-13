const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const logger = require("../utils/logger");

const ROOT = path.join(__dirname, "..");
const BOTS_DIR = path.join(ROOT, "bots");
const REGISTRY_FILE = path.join(ROOT, "data", "bots.json");

const MAX_LOG_LINES = 400;
const SIGKILL_DELAY = 5000;

function ensureDirs() {
  fs.mkdirSync(BOTS_DIR, { recursive: true });
  fs.mkdirSync(path.dirname(REGISTRY_FILE), { recursive: true });
}

function readRegistry() {
  try {
    if (fs.existsSync(REGISTRY_FILE)) {
      return JSON.parse(fs.readFileSync(REGISTRY_FILE, "utf8"));
    }
  } catch (error) {
    logger.log(`Không thể đọc registry bot: ${error.message}`, "error");
  }
  return { bots: {} };
}

function writeRegistry(registry) {
  ensureDirs();
  fs.writeFileSync(REGISTRY_FILE, JSON.stringify(registry, null, 2), "utf8");
}

function botDir(name) {
  return path.join(BOTS_DIR, name);
}

function botPaths(name) {
  const dir = botDir(name);
  return {
    dir,
    dbFile: path.join(dir, "store.json"),
    accountFile: path.join(dir, "account.json"),
    qrFile: path.join(dir, "qr.png")
  };
}

class BotInstance {
  constructor(name, options = {}) {
    // Cổng cầu nối chat nội bộ — bot con tăng dần từ 3902
    this.bridgePort = Number(options.bridgePort) || (name === "main" ? 3901 : 0);
    this.name = name;
    this.autoRestart = options.autoRestart !== false;
    this.process = null;
    this.startedAt = null;
    this.stoppedByUser = false;
    this.restarts = 0;
    this.flapping = false;
    this.logs = [];
  }

  get status() {
    if (this.process && !this.process.killed) return "online";
    if (this.stoppedByUser) return "stopped";
    if (this.restarting) return "restarting";
    return "offline";
  }

  get pid() {
    return this.process?.pid || null;
  }

  pushLog(line) {
    this.logs.push(line);
    if (this.logs.length > MAX_LOG_LINES) this.logs.shift();
  }

  start() {
    if (this.process) {
      throw new Error(`Bot '${this.name}' đang chạy`);
    }
    const paths = botPaths(this.name);
    fs.mkdirSync(paths.dir, { recursive: true });

    const env = {
      ...process.env,
      JT_BOT_NAME: this.name,
      JT_DB_FILE: paths.dbFile,
      JT_ACCOUNT_FILE: paths.accountFile,
      JT_QRCODE_PATH: paths.qrFile,
      JT_PANEL_CHILD: "1",
      JT_BRIDGE_PORT: String(this.bridgePort || 3901),
      // Chuẩn bị sẵn phiên đăng nhập cho bot con (nếu host set sẵn qua env)
      ...(process.env.JT_ACCOUNT_JSON ? { JT_ACCOUNT_JSON: process.env.JT_ACCOUNT_JSON } : {}),
      ...(process.env.JT_COOKIE_JSON ? { JT_COOKIE_JSON: process.env.JT_COOKIE_JSON } : {})
    };
    // Bot con KHÔNG mở panel/health riêng và không chiếm PORT của master
    // (panel + health do master lo; tránh tranh giật cổng trên Koyeb)
    delete env.PORT;
    delete env.JT_PANEL__ENABLED;
    delete env.JT_PANEL__TOKEN;
    delete env.JT_PANEL__PORT;

    const child = spawn(process.execPath, [path.join(ROOT, "JohnTran.js")], {
      cwd: ROOT,
      env,
      stdio: ["ignore", "pipe", "pipe"]
    });

    this.process = child;
    this.startedAt = Date.now();
    this.stoppedByUser = false;

    const prefix = `[${this.name}]`;
    child.stdout.on("data", (data) => {
      const text = data.toString();
      this.pushLog(text.replace(/\n$/, ""));
      process.stdout.write(`${prefix} ${text}`);
    });
    child.stderr.on("data", (data) => {
      const text = data.toString();
      this.pushLog(text.replace(/\n$/, ""));
      process.stdout.write(`${prefix} ${text}`);
    });
    child.on("exit", (code) => {
      this.process = null;
      this.restarts += 1;
      // watchdog: quá 5 lần khởi động lại trong 10 phút → đánh dấu bất thường
      if (this.restarts > 5 && this.startedAt && Date.now() - this.startedAt < 600000) {
        if (!this.flapping) {
          this.flapping = true;
          logger.log(`Cảnh báo: bot con '${this.name}' khởi động lại liên tục (${this.restarts} lần)`, "error");
        }
      }
      this.pushLog(`[system] tiến trình thoát với code ${code}`);
      logger.log(`Bot con '${this.name}' thoát (code ${code})`, this.stoppedByUser ? "info" : "warn");
      if (!this.stoppedByUser && this.autoRestart && this.restarts <= 5) {
        this.restarting = true;
        setTimeout(() => {
          this.restarting = false;
          if (!this.stoppedByUser) this.start();
        }, 3000);
      } else if (!this.stoppedByUser && this.autoRestart) {
        this.pushLog("[watchdog] Tự khởi động lại đã bị dừng do crash quá nhiều — cần kiểm tra");
      }
    });

    logger.log(`Đã khởi động bot con '${this.name}' (pid ${child.pid})`, "info");
    return child.pid;
  }

  async stop() {
    if (!this.process) return false;
    this.stoppedByUser = true;
    const child = this.process;
    return new Promise((resolve) => {
      const killTimer = setTimeout(() => {
        child.kill("SIGKILL");
      }, SIGKILL_DELAY);
      child.on("exit", () => {
        clearTimeout(killTimer);
        this.process = null;
        resolve(true);
      });
      child.kill("SIGTERM");
    });
  }

  async restart() {
    await this.stop();
    this.stoppedByUser = false;
    return this.start();
  }

  toJSON() {
    return {
      name: this.name,
      status: this.status,
      pid: this.pid,
      autoRestart: this.autoRestart,
      uptimeMs: this.startedAt ? Date.now() - this.startedAt : 0,
      restarts: this.restarts,
      flapping: this.flapping,
      hasQr: fs.existsSync(botPaths(this.name).qrFile),
      lastLogs: this.logs.slice(-20),
      bridgePort: this.bridgePort || 3901
    };
  }
}

class BotManager {
  constructor() {
    this.bots = new Map();
    ensureDirs();
    const registry = readRegistry();
    for (const name of Object.keys(registry.bots || {})) {
      this.bots.set(name, new BotInstance(name, registry.bots[name]));
    }
  }

  list() {
    return [...this.bots.values()].map((bot) => bot.toJSON());
  }

  get(name) {
    return this.bots.get(name) || null;
  }

  create(name, options = {}) {
    if (!/^[a-zA-Z0-9_-]{1,32}$/.test(name)) {
      throw new Error("Tên bot chỉ được chứa chữ, số, gạch ngang, gạch dưới (tối đa 32 ký tự)");
    }
    if (this.bots.has(name)) {
      throw new Error(`Bot '${name}' đã tồn tại`);
    }
    let bridgePort = options.bridgePort;
    if (!bridgePort) {
      // cấp cổng trống tiếp theo từ 3902
      bridgePort = 3902;
      const used = new Set([3901, ...[...this.bots.values()].map((b) => b.bridgePort).filter(Boolean)]);
      while (used.has(bridgePort)) bridgePort += 1;
    }
    const bot = new BotInstance(name, { ...options, bridgePort });
    this.bots.set(name, bot);
    this.persist();
    return bot;
  }

  async remove(name) {
    const bot = this.bots.get(name);
    if (!bot) return false;
    await bot.stop();
    this.bots.delete(name);
    this.persist();
    fs.rmSync(botDir(name), { recursive: true, force: true });
    return true;
  }

  setAutoRestart(name, value) {
    const bot = this.bots.get(name);
    if (!bot) throw new Error(`Bot '${name}' không tồn tại`);
    bot.autoRestart = Boolean(value);
    this.persist();
    return bot;
  }

  persist() {
    const registry = { bots: {} };
    for (const [name, bot] of this.bots.entries()) {
      registry.bots[name] = { name, autoRestart: bot.autoRestart, createdAt: Date.now() };
    }
    writeRegistry(registry);
  }

  async stopAll() {
    await Promise.all([...this.bots.values()].map((bot) => bot.stop()));
  }
}

module.exports = { BotManager, botPaths, botDir, BOTS_DIR };
