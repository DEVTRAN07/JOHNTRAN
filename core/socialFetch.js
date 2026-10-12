// ===== LẤY HỒ SƠ TIKTOK / FACEBOOK QUA PYTHON (social_info.py) =====
// Vì sao phải qua Python: Node.js (https module) dùng TLS fingerprint riêng,
// bị Cloudflare của TikTok/Facebook chặn. curl_cffi bên Python giả lập được
// fingerprint Chrome (JA3) nên lấy được trang công khai.
//
// Script: scripts/social_info.py (cần `pip3 install curl_cffi`)
const { execFile } = require("child_process");
const path = require("path");
const logger = require("../utils/logger");

const SCRIPT = path.join(__dirname, "..", "scripts", "social_info.py");

/**
 * @param {"tiktok"|"facebook"} platform
 * @param {string} target  username / id / URL
 * @returns {Promise<{data?: object, error?: string, code?: string}>}
 *   code: not_found | empty | private | blocked | unknown
 */
function fetchSocial(platform, target) {
  return new Promise((resolve) => {
    const py = process.env.PYTHON_BIN || "python3";
    execFile(py, [SCRIPT, platform, String(target || "").trim()], { timeout: 40000, maxBuffer: 16 * 1024 * 1024 }, (error, stdout, stderr) => {
      const text = (stdout || "").trim();
      // Lấy dòng JSON cuối cùng (tránh nhiễu warning của pip/curl)
      const lines = text.split("\n").filter((l) => l.trim().startsWith("{"));
      if (!lines.length) {
        if (stderr) console.error("social_info.py stderr:", stderr.split("\n").slice(-2).join(" "));
        resolve({ error: "Chưa cài curl_cffi (hoặc Python lỗi)", code: "blocked" });
        return;
      }
      try {
        const parsed = JSON.parse(lines[lines.length - 1]);
        if (parsed.ok && parsed.data) {
          logger.log(`[social] ${platform}/${target} → ${parsed.data.nickname || parsed.data.name || "OK"}`, "verbose");
          resolve({ data: parsed.data });
          return;
        }
        logger.log(`[social] ${platform}/${target} thất bại [${parsed.code}]: ${parsed.error}`, "warn");
        resolve({ error: parsed.error || "Không lấy được hồ sơ", code: parsed.code || "unknown" });
      } catch (error) {
        console.error("social_info.py parse lỗi:", error.message);
        resolve({ error: "Phản hồi không đọc được", code: "unknown" });
      }
    });
  });
}

/** Thông điệp lỗi dễ hiểu theo mã lỗi */
function explain(code, target, platform) {
  const label = platform === "facebook" ? "Facebook" : "TikTok";
  switch (code) {
    case "not_found":
      return `Không tìm thấy @${target} trên ${label}.\nKiểm tra lại username (phần sau dấu @ trong link profile).`;
    case "blocked":
      if (platform === "tiktok") {
        return `TikTok đang chặn truy cập @${target} (anti-bot cho user này).\n\n` +
               `💡 Cách sửa — set cookie TikTok cho bot:\n` +
               `1) Đăng nhập tiktok.com trên trình duyệt\n` +
               `2) F12 → Console → gõ: document.cookie → Enter\n` +
               `3) Copy chuỗi cookie vào config.yml:\n` +
               `   media: → tiktok_cookies: "chuỗi vừa copy"\n` +
               `   (hoặc env TIKTOK_COOKIES)\n\n` +
               `Nếu không, thử lại sau ít phút.`;
      }
      return `${label} đang chặn yêu cầu. Thử lại sau ít phút.`;
    case "empty":
    case "not_found":
    default:
      if (platform === "tiktok") {
        return `Không tìm thấy @${target} trên TikTok.\n\n` +
               `Có thể do:\n` +
               `• username sai (username là phần sau dấu @ trong link profile, không phải tên hiển thị)\n` +
               `• hồ sơ bị riêng tư hoặc đã bị khóa\n\n` +
               `Ví dụ link: https://www.tiktok.com/@username\n` +
               `→ gõ: /tiktok username`;
      }
      return `@${target} chưa có nội dung công khai hoặc không tồn tại trên ${label}.`;
    case "private":
      return `Hồ sơ ${target} ở chế độ riêng tư nên không xem được.`;
  }
}

// Kiểm tra môi trường có chạy được không (dùng cho /cardtiktok debug)
function checkEnvironment() {
  return new Promise((resolve) => {
    const py = process.env.PYTHON_BIN || "python3";
    execFile(py, ["-c", "import curl_cffi, sys; print(sys.version.split()[0])"], { timeout: 20000 }, (error, stdout, stderr) => {
      resolve({
        python: !error && String(stdout || "").trim(),
        curlCffi: !error,
        error: error ? (stderr || error.message || "").split("\n")[0].slice(0, 80) : null,
        script: require("fs").existsSync(SCRIPT)
      });
    });
  });
}

module.exports = { fetchSocial, checkEnvironment, explain };
