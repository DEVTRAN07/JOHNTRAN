// Bàn thờ (giai đoạn) — chèn avatar người bị tag vào ảnh nền
const fs = require("fs");
const path = require("path");
const { createCanvas, loadImage } = require("canvas");
const http = require("../../core/http");
const { getUserInfo } = require("../../core/userInfo");

const BG_URL = () => global.config?.services?.bantho_bg_url || "https://i.imgur.com/brK0Hbb.jpg";

module.exports.config = {
  name: "bantho",
  aliases: ["cho","ban tho"],

  version: "2.0.0",
  role: 0,
  author: "ᴶᴼᴴᴺ ᵀᴿᴬᴺ",
  description: "Tạo ảnh bàn thờ của người bị tag",
  category: "Giải trí",
  usage: "bantho [@tag | để trống = chính mình]",
  cooldowns: 5,
  dependencies: {}
};

module.exports.run = async function ({ api, event }) {
  const { threadId, type, data } = event;

  let targetId = data.uidFrom;
  if (data.mentions && Object.keys(data.mentions).length > 0) {
    targetId = Object.values(data.mentions)[0].uid || Object.keys(data.mentions)[0];
  }

  const tempDir = path.join(__dirname, "temp");
  const outPath = path.join(tempDir, `bantho_${Date.now()}.png`);
  let filePath = null;

  try {
    fs.mkdirSync(tempDir, { recursive: true });
    const [user, bgBuffer] = await Promise.all([
      getUserInfo(api, targetId),
      http.getBuffer(BG_URL(), { timeout: 15000 })
    ]);

    const canvas = createCanvas(960, 634);
    const ctx = canvas.getContext("2d");
    const bg = await loadImage(bgBuffer.buffer);
    ctx.drawImage(bg, 0, 0, canvas.width, canvas.height);

    if (user.avatar) {
      try {
        const { buffer } = await http.getBuffer(user.avatar, { timeout: 12000, retries: 1 });
        const avatar = await loadImage(buffer);
        // bo tròn avatar bằng clip
        const size = 205;
        const ax = 353;
        const ay = 158;
        ctx.save();
        ctx.beginPath();
        ctx.arc(ax + size / 2, ay + size / 2, size / 2, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(avatar, ax, ay, size, size);
        ctx.restore();
      } catch { /* bỏ qua avatar */ }
    }

    fs.writeFileSync(outPath, canvas.toBuffer("image/png"));
    await api.sendMessage({ msg: "", attachments: outPath, ttl: 120000 }, threadId, type);
    fs.unlinkSync(outPath);
  } catch (error) {
    console.error("Lỗi bantho:", error.message);
    api.sendMessage({ msg: "❌ Không tạo được ảnh.", ttl: 30000 }, threadId, type);
  }
};
