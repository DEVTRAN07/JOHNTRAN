// Card thông tin người dùng — bố cục ngang (canvas), ho tro Zalo / TikTok / Facebook
const fs = require("fs");
const usercard = require("../../core/canvas/usercard");
const social = require("../../core/social");
const { getUserInfo } = require("../../core/userInfo");

function formatCount(n) {
  if (!n) return "—";
  const num = Number(n);
  if (num >= 1e6) return (num / 1e6).toFixed(1) + "M";
  if (num >= 1e3) return (num / 1e3).toFixed(1) + "K";
  return String(num);
}

module.exports.config = {
  name: "cardinfo",
  version: "3.0.0",
  role: 0,
  author: "ᴶᴼᴴᴺ ᵀᴿᴬᴺ",
  description: "Tạo card thông tin người dùng (bố cục ngang, Zalo/TikTok/Facebook)",
  category: "Tiện ích",
  usage: "cardinfo [@tag | id | link TikTok/Facebook | để trống = chính mình]",
  cooldowns: 5,
  dependencies: {}
};

module.exports.run = async function ({ api, event, args }) {
  const { threadId, type, data } = event;

  if (args[0] && /tiktok\.com|facebook\.com|fb\.com|^@\w+/i.test(args[0])) {
    await api.sendMessage({ msg: "⏳ Đang lấy thông tin mạng xã hội...", ttl: 60000 }, threadId, type);
    let filePath = null;
    try {
      const info = await social.lookup(args[0]);
      filePath = await usercard.renderCardInfo({
        user: {
          userId: info.username,
          displayName: info.displayName,
          avatar: info.avatar,
          gender: "",
          sdob: "",
          status: info.platform,
          isActive: true,
          extra: [
            ["Followers", formatCount(info.followers)],
            ["Lượt thích", formatCount(info.likes)]
          ]
        }
      });
      await api.sendMessage({ msg: "", attachments: filePath, ttl: 120000 }, threadId, type);
    } catch (error) {
      console.error("Lỗi cardinfo social:", error.message);
      api.sendMessage({ msg: `❌ ${error.message}`, ttl: 30000 }, threadId, type);
    } finally {
      if (filePath && fs.existsSync(filePath)) {
        try { fs.unlinkSync(filePath); } catch { /* bỏ qua */ }
      }
    }
    return;
  }

  await api.sendMessage({ msg: "⏳ Đang khởi tạo hình ảnh, vui lòng chờ trong giây lát...", ttl: 60000 }, threadId, type);

  let targetId = data.uidFrom;
  if (args[0] && /^\d{6,}$/.test(args[0])) targetId = args[0];
  else if (data.mentions && Object.keys(data.mentions).length > 0) {
    targetId = Object.keys(data.mentions)[0];
  }

  let filePath = null;
  try {
    const user = await getUserInfo(api, targetId);
    filePath = await usercard.renderCardInfo({ user });
    await api.sendMessage({ msg: "", attachments: filePath, ttl: 120000 }, threadId, type);
  } catch (error) {
    console.error("Lỗi cardinfo:", error.message);
    api.sendMessage({ msg: "❌ Không tạo được card.", ttl: 30000 }, threadId, type);
  } finally {
    if (filePath && fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch { /* bỏ qua */ }
    }
  }
};
