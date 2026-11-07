const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const logger = require("../../utils/logger");

const Users = require("../controller/controllerUsers");
const Threads = require("../controller/controllerThreads");

const SUSPICIOUS_DEP = /(require\s*\(|process\b|global\b|Function\s*\(|eval\s*\(|setTimeout\s*\(|setInterval\s*\(|\.\s*call\s*\(|\.\s*apply\s*\(|->|=>)/i;
const DEP_PAIR = /(?:'([^']+)'|"([^"]+)"|([a-zA-Z_$][a-zA-Z0-9_$]*))\s*:\s*(?:'([^']*)'|"([^"]*)")/g;

function extractDependencies(filePath) {
  try {
    const content = fs.readFileSync(filePath, "utf8");
    const match = content.match(/dependencies\s*:\s*\{/);
    if (!match) return {};

    let start = match.index + match[0].length - 1;
    let depth = 0;
    let end = -1;
    for (let i = start; i < content.length; i++) {
      if (content[i] === "{") depth++;
      else if (content[i] === "}") {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    if (end === -1) return {};

    const block = content.slice(start + 1, end);

    if (SUSPICIOUS_DEP.test(block)) {
      logger.log(`Phát hiện nội dung đáng ngờ trong dependencies của ${filePath}, bỏ qua block`, "warn");
      return {};
    }

    const deps = {};
    let m;
    while ((m = DEP_PAIR.exec(block)) !== null) {
      const key = m[1] !== undefined ? m[1] : m[2] !== undefined ? m[2] : m[3];
      const val = m[4] !== undefined ? m[4] : m[5];
      if (key) deps[key] = val;
    }
    return deps;
  } catch (err) {
    logger.log(`Lỗi khi đọc dependencies từ ${filePath}: ${err.message}`, "error");
    return {};
  }
}

async function loadEvents(dir = path.join(__dirname, "../..", "plugins", "events")) {
  // Bot thuần lệnh: thư mục events có thể không tồn tại (git không theo dõi
  // thư mục rỗng → clone mới trên Render không có dir này). Thiếu dir = 0 event, không lỗi.
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter(file => file.endsWith(".js")) : [];
  let shouldRestart = false;

  for (const file of files) {
    const filePath = path.join(dir, file);

    const dependencies = extractDependencies(filePath);

    for (const [pkgName, version] of Object.entries(dependencies)) {
      try {
        require.resolve(pkgName);
      } catch {
        logger.log(`Cài đặt package: ${pkgName}@${version || "latest"}`, "info");
        try {
          execSync(`npm install ${pkgName}@${version || "latest"}`, {
            stdio: "inherit",
            cwd: path.join(__dirname, "../../")
          });
          logger.log(`Đã cài xong ${pkgName}`, "info");
          shouldRestart = true;
        } catch (err) {
          logger.log(`Lỗi khi cài ${pkgName}: ${err.message}`, "error");
        }
      }
    }

    if (shouldRestart) continue;

    let event;
    try {
      event = require(filePath);
    } catch (err) {
      logger.log(`Không thể require file ${file}: ${err.message}`, "error");
      continue;
    }

    if (
      !event.config ||
      !Array.isArray(event.config.event_type) ||
      typeof event.run !== "function"
    ) {
      logger.log(`Event ${file} không hợp lệ`, "warn");
      continue;
    }

    const eventName = event.config.name?.toLowerCase() || file.replace(/\.js$/, "");
    global.client.events.set(eventName, event);

    if (typeof event.onLoad === "function") {
      try {
        await event.onLoad({ api: global.api, Users, Threads });
      } catch (e) {
        logger.log(`Lỗi trong onLoad của event ${eventName}: ${e.message}`, "error");
      }
    }
  }

  logger.log(`Đã tải ${global.client.events.size} event module`, "info");

  if (shouldRestart) {
    logger.log("Đã cài thêm package mới, đang khởi động lại bot...", "warn");
    process.exit(1);
  }
}

module.exports = loadEvents;
