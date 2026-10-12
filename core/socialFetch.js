// ===== LẤY HỒ SƠ TIKTOK / FACEBOOK (Node.js thuần) =====
// Node fetch + đủ header trình duyệt lấy được trang công khai. User bị
// anti-bot riêng (statusCode 209002) thì cần cookie đăng nhập:
//   config.yml → media.tiktok_cookies  hoặc  env TIKTOK_COOKIES
//
// Xem core/socialInfo.js để biết cách parse.
const logger = require("../utils/logger");

/**
 * @param {"tiktok"|"facebook"} platform
 * @param {string} target  username / id / URL
 * @returns {Promise<{data?: object, error?: string, code?: string}>}
 *   code: not_found | empty | private | blocked | unknown
 */
async function fetchSocial(platform, target) {
  const { tiktok, facebook, SocialError } = require("./socialInfo");
  const fn = platform === "facebook" ? facebook : tiktok;
  const label = platform === "facebook" ? "Facebook" : "TikTok";
  try {
    const data = await fn(String(target || "").trim());
    logger.log(`[social] ${platform}/${target} → ${data.nickname || data.name || "OK"}`, "verbose");
    return { data };
  } catch (error) {
    const code = error instanceof SocialError ? error.code : "unknown";
    logger.log(`[social] ${platform}/${target} thất bại [${code}]: ${error.message}`, "warn");
    return { error: error.message || "Không lấy được hồ sơ", code };
  }
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

// Kiểm tra môi trường: có cookie TikTok không + Node fetch hoạt động không
async function checkEnvironment() {
  const hasCookie = Boolean((global.config?.media?.tiktok_cookies || process.env.TIKTOK_COOKIES || "").trim());
  let nodeOk = false;
  try {
    const { tiktok } = require("./socialInfo");
    await tiktok("tiktok");
    nodeOk = true;
  } catch {
    nodeOk = false;
  }
  return {
    python: "không cần (Node.js)",
    curlCffi: nodeOk,
    script: true,
    cookie: hasCookie,
    error: nodeOk ? null : "Không lấy được TikTok — kiểm tra mạng/cookie"
  };
}

module.exports = { fetchSocial, checkEnvironment, explain };
