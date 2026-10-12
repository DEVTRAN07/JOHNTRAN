// /getavt — lấy ảnh đại diện Zalo (người dùng hoặc nhóm)
//   /getavt              → ảnh của chính mình
//   /getavt <uid>        → ảnh theo UID
//   /getavt @nguoi_dung  → ảnh người được tag
//   /getavt box          → ảnh đại diện nhóm
const profile = require("../../core/canvas/profile");

module.exports.config = {
  name: "getavt",
  aliases: ["avt", "avatar"],
  version: "3.1.0",
  role: 0,
  author: "ᴶᴼᴴᴺ ᵀᴿᴬᴺ",
  description: "Lấy ảnh đại diện người dùng hoặc nhóm",
  category: "Tiện ích",
  usage: "getavt [uid | @tag | box]",
  cooldowns: 3,
  dependencies: {}
};

module.exports.run = async function ({ api, event, args, reply }) {
  const { threadId, type, data } = event;
  const arg = (args[0] || "").toLowerCase();

  // ===== Ảnh nhóm =====
  if (["box", "group", "nhom"].includes(arg)) {
    let group;
    try {
      const info = await api.getGroupInfo(threadId);
      group = info?.gridInfoMap?.[threadId];
    } catch (error) {
      console.error("getavt box:", error.message);
      return reply.error("Không đọc được thông tin nhóm.");
    }
    const avt = group?.avt || group?.avatar;
    if (!avt) return reply.error("Nhóm không có ảnh đại diện.");
    const filePath = await profile.downloadImage(avt, "grp");
    if (!filePath) return reply.error("Tải ảnh nhóm thất bại.");
    try {
      await api.sendMessage({ msg: `🖼️ Ảnh đại diện nhóm: ${group?.name || "—"}`, attachments: filePath, ttlKind: "media" }, threadId, type);
    } catch (error) {
      return reply.error(`Gửi ảnh thất bại: ${error.message}`);
    } finally {
      profile.cleanup(filePath);
    }
    return;
  }

  // ===== Ảnh người dùng: uid → tag → chính mình =====
  let uid = null;
  if (args[0] && /^\d{6,}$/.test(args[0])) uid = args[0];
  else if (data.mentions && Object.keys(data.mentions).length > 0) uid = String(Object.keys(data.mentions)[0]);
  else uid = String(data.uidFrom);

  let user;
  try {
    const info = await api.getUserInfo(uid);
    user = info?.changed_profiles?.[uid] || info?.unchanged_profiles?.[uid];
  } catch (error) {
    console.error("getavt:", error.message);
    return reply.error(`Không đọc được thông tin của ${uid}.`);
  }

  if (!user?.avatar) return reply.error(`Không có ảnh đại diện (${user?.displayName || uid}).`);

  const filePath = await profile.downloadImage(user.avatar, "avt");
  if (!filePath) return reply.error("Tải ảnh đại diện thất bại.");
  try {
    await api.sendMessage({ msg: `🖼️ Ảnh đại diện: ${user.displayName || uid}`, attachments: filePath, ttlKind: "media" }, threadId, type);
  } catch (error) {
    return reply.error(`Gửi ảnh thất bại: ${error.message}`);
  } finally {
    profile.cleanup(filePath);
  }
};
