// Card thông tin người dùng (canvas)
const fs = require("fs");
const usercard = require("../../core/canvas/usercard");
const { getUserInfo } = require("../../core/userInfo");

module.exports.config = {
  name: "carduser",
  version: "2.0.0",
  role: 0,
  author: "ᴶᴼᴴᴺ ᵀᴿᴬᴺ",
  description: "Tạo card thông tin người dùng",
  category: "Tiện ích",
  usage: "carduser [@tag | id | để trống = chính mình]",
  cooldowns: 5,
  dependencies: {}
};

module.exports.run = async function ({ api, event, args }) {
  const { threadId, type, data } = event;
  await api.sendMessage({ msg: "⏳ Đang khởi tạo hình ảnh, vui lòng chờ trong giây lát...", ttl: 60000 }, threadId, type);

  let targetId = data.uidFrom;
  if (args[0] && /^\d{6,}$/.test(args[0])) targetId = args[0];
  else if (data.mentions && Object.keys(data.mentions).length > 0) {
    targetId = Object.keys(data.mentions)[0];
  }

  let filePath = null;
  try {
    const user = await getUserInfo(api, targetId);
    filePath = await usercard.renderCardUser({ user });
    await api.sendMessage({ msg: "", attachments: filePath, ttl: 120000 }, threadId, type);
  } catch (error) {
    console.error("Lỗi carduser:", error.message);
    api.sendMessage({ msg: "❌ Không tạo được card.", ttl: 30000 }, threadId, type);
  } finally {
    if (filePath && fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch { /* bỏ qua */ }
    }
  }
};
