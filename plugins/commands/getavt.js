// /getavt — lấy ảnh đại diện Zalo người dùng hoặc nhóm
//   /getavt              → ảnh của chính mình
//   /getavt <uid>        → ảnh theo id
//   /getavt @nguoi_dùng  → ảnh người được tag (trả lời kèm ảnh)
//   /getavt box          → ảnh đại diện nhóm
const fs = require("fs");
const path = require("path");
const http = require("../../core/http");
const { ThreadType } = require("zalo-client");

module.exports.config = {
  name: "getavt",
  aliases: ["avt", "avatar"],
  version: "3.0.0",
  role: 0,
  author: "ᴶᴼᴴᴺ ᵀᴿᴬᴺ",
  description: "Lấy ảnh đại diện người dùng hoặc nhóm",
  category: "Tiện ích",
  usage: "getavt [uid | @tag | box]",
  cooldowns: 3,
  dependencies: {}
};

// Tải ảnh về file tạm rồi gửi (Zalo cần file cục bộ)
async function sendAvatar(api, threadId, type, imageUrl, msg, ttlKind) {
  const tempDir = path.join(__dirname, "temp");
  fs.mkdirSync(tempDir, { recursive: true });
  const filePath = path.join(tempDir, `avt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.jpg`);
  try {
    const { buffer } = await http.getBuffer(imageUrl, { timeout: 15000, retries: 1 });
    fs.writeFileSync(filePath, buffer);
    await api.sendMessage({ msg: msg || "", attachments: filePath, ttlKind }, threadId, type);
  } finally {
    if (fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch { /* bỏ qua */ }
    }
  }
}

module.exports.run = async function ({ api, event, args, reply }) {
  const { threadId, type, data } = event;
  const arg = (args[0] || "").toLowerCase();

  // ===== Ảnh nhóm =====
  if (["box", "group", "nhom", "nam"].includes(arg)) {
    try {
      const info = await api.getGroupInfo(threadId);
      const group = info?.gridInfoMap?.[threadId];
      const avt = group?.avt || group?.avatar;
      if (!avt) return reply.error("Không lấy được ảnh đại diện của nhóm.");
      const name = group?.name || "nhóm";
      return sendAvatar(api, threadId, type, avt, `🖼️ Ảnh đại diện nhóm: ${name}`, "media");
    } catch (error) {
      console.error("Lỗi getavt box:", error.message);
      return reply.error("Không lấy được thông tin nhóm.");
    }
  }

  // ===== Xác định người dùng: uid → tag → chính mình =====
  let targetId = null;
  if (args[0] && /^\d{6,}$/.test(args[0])) {
    targetId = args[0];
  } else if (data.mentions && Object.keys(data.mentions).length > 0) {
    targetId = String(Object.keys(data.mentions)[0]);
  } else {
    targetId = String(data.uidFrom);
  }

  try {
    const info = await api.getUserInfo(targetId);
    const user = info?.changed_profiles?.[targetId] || info?.unchanged_profiles?.[targetId];
    if (!user || !user.avatar) {
      return reply.error(`Không lấy được ảnh đại diện của ${user?.displayName || targetId}.`);
    }
    return sendAvatar(api, threadId, type, user.avatar, `🖼️ Ảnh đại diện: ${user.displayName || targetId}`, "media");
  } catch (error) {
    console.error("Lỗi getavt:", error.message);
    return reply.error("Không thể lấy ảnh đại diện.");
  }
};
