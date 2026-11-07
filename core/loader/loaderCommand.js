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

async function loadCommands(commandName = null) {
  const dir = path.join(__dirname, "../..", "plugins", "commands");
  let files;

  if (commandName) {
    const base = commandName.replace(/\.js$/, "");
    if (!/^[a-zA-Z0-9_-]+$/.test(base)) {
      logger.log(`Tên command không hợp lệ: ${commandName}`, "error");
      return { status: false, error: `Tên command không hợp lệ: ${commandName}` };
    }
    files = [`${base}.js`];
  } else {
    files = fs.readdirSync(dir).filter(file => file.endsWith(".js"));
  }

  let shouldRestart = false;

  var result = {};

  for (const file of files) {
    const filePath = path.join(dir, file);

    if (!fs.existsSync(filePath)) {
      logger.log(`Không tìm thấy file: ${file}`, "error");
      result = { status: false, error: `Không tìm thấy file: ${file}` };
      continue;
    }

    const resolved = path.resolve(filePath);
    const dirResolved = path.resolve(dir);
    if (!resolved.startsWith(dirResolved + path.sep)) {
      logger.log(`Phát hiện path traversal trong commandName: ${commandName}`, "error");
      result = { status: false, error: `Path traversal bị từ chối: ${commandName}` };
      continue;
    }

    const dependencies = extractDependencies(filePath);

    for (const [pkgName, version] of Object.entries(dependencies)) {
      try {
        require.resolve(pkgName);
      } catch {
        logger.log(`Đang cài package: ${pkgName}@${version || "latest"}`, "info");
        try {
          execSync(`npm install ${pkgName}@${version || "latest"}`, {
            stdio: "inherit",
            cwd: path.join(__dirname, "../../")
          });
          logger.log(`Đã cài xong ${pkgName}`, "info");
          shouldRestart = true;
        } catch (err) {
          logger.log(`Lỗi khi cài ${pkgName}: ${err.message}`, "error");
          result = { status: false, error: `Lỗi khi cài ${pkgName}: ${err.message}` };
          continue;
        }
      }
    }

    if (shouldRestart) continue;

    delete require.cache[require.resolve(filePath)];

    let command;
    try {
      command = require(filePath);
    } catch (err) {
      logger.log(`Không thể require file ${file}: ${err.message}`, "error");
      result = { status: false, error: `Không thể require file ${file}: ${err.message}` };
      continue;
    }

    if (!command.config || (!command.config.name && command.config.name !== '') || !command.config.cooldowns || typeof command.run !== "function") {
      logger.log(`Command ${file} không hợp lệ`, "warn");
      result = { status: false, error: `Command ${file} không hợp lệ` };
      continue;
    }

    const name = command.config.name.toLowerCase();
    global.client.commands.set(name, command);

    if (typeof command.onLoad === "function") {
      logger.log(`Đang chạy onLoad cho command ${name}`, "info");
      try {
        await command.onLoad({ api: global.api, Users, Threads });
      } catch (e) {
        logger.log(`Lỗi trong onLoad của command ${name}: ${e.message}`, "error");
        result = { status: false, error: `Lỗi trong onLoad của command ${name}: ${e.message}` };
        continue;
      }
    }
  }

  logger.log(
    commandName
      ? `Đã tải lại command "${commandName}"`
      : `Đã tải thành công ${global.client.commands.size} lệnh`,
    "info"
  );

  if (shouldRestart && commandName == null) {
    logger.log("Đã cài thêm package. Đang khởi động lại bot...", "warn");
    process.exit(2);
  } else {
    result = { status: true, restart: shouldRestart };
    return result;
  }
}

module.exports = loadCommands;
