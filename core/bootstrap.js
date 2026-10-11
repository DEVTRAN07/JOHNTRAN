const fs = require("fs");
const path = require("path");
const logger = require("../utils/logger");

/**
 * Khôi phục file quan trọng từ biến môi trường — BẮT BUỘC khi deploy lên
 * nền tảng có ổ đĩa tạm (Render free, Koyeb...):
 * mỗi lần restart, account.json / cookie.json / store.json bị xoá sạch.
 *
 * Cách lấy giá trị: chạy bot local đến khi đăng nhập xong, rồi:
 *   JT_ACCOUNT_JSON = nội dung file account.json
 *   JT_COOKIE_JSON = nội dung file cookie.json
 */
function resolve(target) {
  // core/bootstrap.js → __dirname = <botroot>/core → 1 cấp lên = thư mục gốc bot
  // (giống resolveBotPath() trong core/login.js để cùng một cách phân giải)
  return path.isAbsolute(target) ? target : path.join(__dirname, "..", String(target));
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function bootstrapFiles() {
  const config = global.config || {};
  const accountFile = resolve(config.account_file || "account.json");

  // 1. Ghi account.json
  const accountJson = process.env.JT_ACCOUNT_JSON;
  if (accountJson && typeof accountJson === "string" && accountJson.trim()) {
    try {
      JSON.parse(accountJson); // kiểm tra hợp lệ trước
      fs.mkdirSync(path.dirname(accountFile), { recursive: true });
      fs.writeFileSync(accountFile, accountJson, "utf8");
    } catch (error) {
      logger.log(`Bootstrap account.json thất bại (JSON không hợp lệ): ${error.message}`, "error");
    }
  }

  // 2. Xác định đường dẫn cookie ĐÚNG nơi core/login.js sẽ đọc:
  //    login.resolveBotPath() phân giải đường dẫn tương đối so với thư mục gốc bot
  //    (CÙNG cách resolve() ở trên), chứ không phải thư mục của account.json.
  let cookieFile = process.env.JT_COOKIE_FILE ? resolve(process.env.JT_COOKIE_FILE) : null;

  if (!cookieFile) {
    const account = safeJsonParse(fs.existsSync(accountFile) ? fs.readFileSync(accountFile, "utf8") : accountJson);
    cookieFile = account && account.cookie
      ? resolve(account.cookie)
      : path.join(path.dirname(accountFile), "cookie.json");
  }

  // 3. Ghi cookie.json
  const cookieJson = process.env.JT_COOKIE_JSON;
  if (cookieJson && typeof cookieJson === "string" && cookieJson.trim()) {
    try {
      JSON.parse(cookieJson);
      fs.mkdirSync(path.dirname(cookieFile), { recursive: true });
      fs.writeFileSync(cookieFile, cookieJson, "utf8");
    } catch (error) {
      logger.log(`Bootstrap cookie.json thất bại (JSON không hợp lệ): ${error.message}`, "error");
    }
  }

  // 4. Ghi database (chế độ JSON store — Supabase thì không cần)
  const dbJson = process.env.JT_DB_JSON;
  if (dbJson && typeof dbJson === "string" && dbJson.trim()) {
    const target = process.env.JT_DB_FILE
      ? resolve(process.env.JT_DB_FILE)
      : path.join(__dirname, "..", "..", "data", "store.json");
    try {
      JSON.parse(dbJson);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, dbJson, "utf8");
    } catch (error) {
      logger.log(`Bootstrap store.json thất bại (JSON không hợp lệ): ${error.message}`, "error");
    }
  }
}

module.exports = { bootstrapFiles };
