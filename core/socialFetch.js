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
 * @returns {Promise<object|null>}  dữ liệu hồ sơ hoặc null
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
        resolve(null);
        return;
      }
      try {
        const parsed = JSON.parse(lines[lines.length - 1]);
        if (parsed.ok && parsed.data) {
          logger.log(`[social] ${platform}/${target} → ${parsed.data.nickname || parsed.data.name || "OK"}`, "verbose");
          resolve(parsed.data);
          return;
        }
        logger.log(`[social] ${platform}/${target} thất bại: ${parsed.error || "không rõ"}`, "warn");
      } catch (error) {
        console.error("social_info.py parse lỗi:", error.message);
      }
      resolve(null);
    });
  });
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

module.exports = { fetchSocial, checkEnvironment };
