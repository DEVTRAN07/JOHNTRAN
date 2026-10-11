// Lấy ảnh đại diện Zalo theo UID / tag / chính mình
const fs = require("fs");
const path = require("path");
const { getUserInfo } = require("../../core/userInfo");

module.exports.config = {
  name: "getavt",
  aliases: ["avt"],
  version: "2.0.0",
  role: 0,
  author: "ᴶᴼᴴᴺ ᵀᴿᴬᴺ",
  description: "Lấy ảnh đại diện người dùng",
  category: "Tiện ích",
  usage: "getavt [id | tag | để trống = chính mình]",
  cooldowns: 3,
  dependencies: {}
};

module.exports.run = async function ({ api, event, args }) {
  const { threadId, type, data } = event;

  let targetId = null;

  if (args[0] && /^\d{6,}$/.test(args[0])) {
    targetId = args[0];
  } else if (data.mentions && Object.keys(data.mentions).length > 0) {
    targetId = Object.keys(data.mentions)[0];
  } else {
    targetId = data.uidFrom;
  }

  try {
    const user = await getUserInfo(api, targetId);
    if (!user.avatar) {
      return api.sendMessage({ msg: `❌ Không lấy được ảnh đại diện của ${user.displayName}.`, ttl: 60000 }, threadId, type);
    }
    const tempDir = path.join(__dirname, "temp");
    fs.mkdirSync(tempDir, { recursive: true });
    const filePath = path.join(tempDir, `avt_${targetId}_${Date.now()}.jpg`);
    const { buffer } = await require("../../core/http").getBuffer(user.avatar, { timeout: 15000 });
    fs.writeFileSync(filePath, buffer);

    await api.sendMessage({ msg: "", attachments: filePath, ttl: 300000 }, threadId, type);
    fs.unlinkSync(filePath);
  } catch (error) {
    console.error("Lỗi getavt:", error.message);
    api.sendMessage({ msg: "❌ Không thể lấy ảnh đại diện.", ttl: 30000 }, threadId, type);
  }
};
