const fs = require("fs");
const path = require("path");
const os = require("os");
const { ZaloClient, LoginQRCallbackEventType } = require("zalo-client");
const Jimp = require("jimp");
const logger = require("../utils/logger");
const { getJsonData, displayQRCodeInConsole } = require("../utils/index");

const USER_AGENTS = {
  mac: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:133.0) Gecko/20100101 Firefox/133.0",
  windows: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0",
  linux: "Mozilla/5.0 (X11; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0",
  iphone: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  android: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36"
};

function resolveBotPath(target) {
    return path.isAbsolute(target) ? target : path.join(__dirname, "..", String(target));
}

// Thiết bị đăng nhập: ưu tiên config.device.user_agent, nếu không thì tự đo theo OS
function resolveUserAgent() {
  const configured = global.config?.device?.user_agent;
  if (configured && String(configured).trim()) return String(configured).trim();
  const platform = os.platform();
  if (platform === "darwin") return USER_AGENTS.mac;
  if (platform === "win32") return USER_AGENTS.windows;
  if (platform === "linux") return USER_AGENTS.linux;
  return USER_AGENTS.mac;
}

function deviceLabel(userAgent) {
  if (userAgent.includes("iPhone")) return "iPhone";
  if (userAgent.includes("Android")) return "Android";
  if (userAgent.includes("Macintosh")) return "macOS";
  if (userAgent.includes("Windows")) return "Windows";
  if (userAgent.includes("Linux")) return "Linux";
  return "Không rõ";
}

// Đọc width/height trực tiếp từ header ảnh (PNG/GIF/JPEG) — không cần decode toàn ảnh.
// Trả về null nếu không parse được, lúc đó fallback sang Jimp.
function readImageHeaderSize(buf) {
  // PNG: IHDR ở byte 16 (width) và 20 (height), big-endian
  if (buf.length >= 24 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  // GIF: logical screen descriptor, little-endian
  if (buf.length >= 10 && buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) {
    return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
  }
  // JPEG: quét các marker SOF0-SOF15 để lấy kích thước
  if (buf.length >= 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < buf.length) {
      if (buf[offset] !== 0xff) { offset += 1; continue; }
      const marker = buf[offset + 1];
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { height: buf.readUInt16BE(offset + 5), width: buf.readUInt16BE(offset + 7) };
      }
      const segmentLength = buf.readUInt16BE(offset + 2);
      offset += 2 + segmentLength;
    }
  }
  return null;
}

// zalo-client bắt buộc imageMetadataGetter mới gửi được ảnh/local file (card canvas...)
function createZaloClient() {
  return new ZaloClient({
    ...global.config.zalo_client_config,
    imageMetadataGetter: async (filePath) => {
      const fileHandle = await fs.promises.open(filePath, "r");
      try {
        const header = Buffer.alloc(64);
        const { bytesRead } = await fileHandle.read(header, 0, 64, 0);
        const size = (await fileHandle.stat()).size;
        const headerSize = readImageHeaderSize(header.subarray(0, bytesRead));
        if (headerSize) {
          return { width: headerSize.width, height: headerSize.height, size };
        }
      } finally {
        await fileHandle.close();
      }
      // Fallback cho webp/định dạng lạ: decode bằng jimp
      const image = await Jimp.read(filePath);
      return { width: image.bitmap.width, height: image.bitmap.height, size: fs.statSync(filePath).size };
    }
  });
}

async function loginWithQR() {
    try {
        const userAgent = resolveUserAgent();
        const zalo = createZaloClient();
        const accountPath = resolveBotPath(global.config.account_file);
        fs.mkdirSync(path.dirname(accountPath), { recursive: true });

        const accountData = getJsonData(accountPath);
        const cookieFileName = accountData.cookie || "cookie.json";
        const cookiePath = resolveBotPath(cookieFileName);

        const api = await zalo.loginQR({ userAgent }, async (qrData) => {
            const eventType = qrData?.type;
            const data = qrData?.data || {};

            if (eventType === LoginQRCallbackEventType.QRCodeGenerated) {
                // QRCodeGenerated
                const { image } = data;
                if (!image) return;

                logger.log("Vui lòng quét mã QRCode bên dưới để đăng nhập:", "info");

                const qrPath = resolveBotPath(global.config.qrcode_path);
                await displayQRCodeInConsole(image, qrPath);
                return;
            }

            if (eventType === LoginQRCallbackEventType.QRCodeScanned) {
                // QRCodeScanned
                logger.log("Đã quét QRCode, vui lòng xác nhận trên điện thoại", "info");
                return;
            }

            if (eventType === LoginQRCallbackEventType.QRCodeExpired) {
                // QRCodeExpired
                logger.log("QRCode đã hết hạn, đang tạo mã mới...", "warn");
                qrData.actions.retry();
                return;
            }

            if (eventType === LoginQRCallbackEventType.QRCodeDeclined) {
                // QRCodeDeclined
                logger.log("QRCode bị từ chối, đang tạo mã mới...", "warn");
                qrData.actions.retry();
                return;
            }

            if (eventType === LoginQRCallbackEventType.GotLoginInfo) {
                // GotLoginInfo
                const { cookie, imei, userAgent } = data;
                if (!userAgent || !cookie || !imei) return;
                if (!global.config.save_cookie) return;

                try {
                    fs.writeFileSync(cookiePath, JSON.stringify(cookie, null, 2), "utf8");

                    const newAccountData = {
                        imei,
                        userAgent,
                        cookie: cookieFileName
                    };
                    fs.writeFileSync(accountPath, JSON.stringify(newAccountData, null, 2), "utf8");
                    // chỉ xoá màn hình khi không chạy dev (nodemon) và không phải bot con
                    const isDev = (process.env.npm_lifecycle_script || "").includes("nodemon");
                    if (!isDev && process.env.JT_PANEL_CHILD !== "1") console.clear();
                    logger.clearReplaceable();
                    logger.log(`Đã lưu cookie vào ${cookieFileName} và cập nhật ${path.basename(accountPath)}`, "info");
                } catch (err) {
                    logger.log(`Lỗi khi ghi file: ${err.message || err}`, "error");
                    process.exit(1);
                }
            }
        });

        return api;
    } catch (error) {
        logger.log(`Lỗi đăng nhập Zalo bằng QR: ${error.message || error}`, "error");
        process.exit(1);
    }
}

async function loginWithCookie() {
    try {
        const zalo = createZaloClient();
        const accountPath = resolveBotPath(global.config.account_file);
        fs.mkdirSync(path.dirname(accountPath), { recursive: true });

        const accountData = getJsonData(accountPath);
        const cookie = getJsonData(resolveBotPath(accountData.cookie));

        const api = await zalo.login({
            cookie: cookie,
            imei: accountData.imei,
            userAgent: accountData.userAgent
        });

        return api;
    } catch (error) {
        logger.log(`Lỗi đăng nhập Zalo bằng Cookie: ${error.message || error}`, "error");
        throw new Error();
    }
}

async function login() {
    try {
        logger.log("Tiến hành login bằng Cookie", "info");
        return await loginWithCookie();
    } catch (error) {
        if (!global.config.login_qrcode) {
            logger.log("Cookie không hợp lệ", "error");
            process.exit(1);
        }
        logger.log("Login bằng Cookie thất bại, chuyển sang QRCode...", "warn");
        logger.log(`Thiết bị đăng nhập: ${deviceLabel(resolveUserAgent())}`, "info");
        return await loginWithQR();
    }
}

module.exports = login;
module.exports.resolveUserAgent = resolveUserAgent;
module.exports.deviceLabel = deviceLabel;
module.exports.USER_AGENTS = USER_AGENTS;
