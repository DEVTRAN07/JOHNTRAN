const fs = require("fs");
const path = require("path");
const logger = require("../utils/logger");

/**
 * Khôi phục file quan trọng từ biến môi trường — BẮT BUỘC khi deploy lên
 * nền tảng có ổ đĩa tạm (Render free, Koyeb free, Railway trial...):
 * mỗi lần restart, account.json / cookie.json / store.json bị xoá sạch.
 *
 * Cách lấy giá trị: chạy bot local đến khi đăng nhập xong, rồi:
 *   JT_ACCOUNT_JSON = nội dung file account.json
 *   JT_COOKIE_JSON  = nội dung file cookie.json
 *   JT_DB_JSON      = nội dung file data/store.json (tuỳ chọn)
 */
function resolve(target) {
  return path.isAbsolute(target) ? target : path.join(__dirname, "..", String(target));
}

function bootstrapFiles() {
  const config = global.config || {};
  const accountFile = resolve(config.account_file || "account.json");
  // cookie mặc định nằm CÙNG thư mục với account (bot con: bots/<tên>/cookie.json)
  const cookieFile = process.env.JT_COOKIE_FILE
    || path.join(path.dirname(accountFile), "cookie.json");

  const jobs = [
    {
      env: process.env.JT_ACCOUNT_JSON,
      target: accountFile,
      label: "account.json"
    },
    {
      env: process.env.JT_COOKIE_JSON,
      target: resolve(cookieFile),
      label: "cookie.json"
    },
    {
      env: process.env.JT_DB_JSON,
      target: process.env.JT_DB_FILE
        ? resolve(process.env.JT_DB_FILE)
        : path.join(__dirname, "..", "data", "store.json"),
      label: "store.json (database)"
    }
  ];

  const restored = [];
  for (const job of jobs) {
    if (!job.env || typeof job.env !== "string" || !job.env.trim()) continue;
    try {
      // chỉ ghi nếu nội dung là JSON hợp lệ
      JSON.parse(job.env);
      fs.mkdirSync(path.dirname(job.target), { recursive: true });
      fs.writeFileSync(job.target, job.env, "utf8");
      restored.push(job.label);
    } catch (error) {
      logger.log(`Bootstrap ${job.label} thất bại (JSON không hợp lệ): ${error.message}`, "error");
    }
  }

  if (restored.length > 0) {
    logger.log(`Đã khôi phục từ biến môi trường: ${restored.join(", ")}`, "info");
  }
  return restored;
}

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

module.exports = { bootstrapFiles };
