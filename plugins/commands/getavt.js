// /getavt — lấy ảnh đại diện Zalo (người dùng hoặc nhóm)
//   /getavt              → ảnh của chính mình
//   /getavt <uid>        → ảnh theo UID
//   /getavt @nguoi_dung  → ảnh người được tag
//   /getavt box          → ảnh đại diện nhóm
const profile = require("../../core/canvas/profile");
const { fetchProfile } = require("../../core/zaloProfile");

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

// Gửi lỗi dạng TEXT để đọc được (ảnh thẻ canvas không copy được nội dung)
function fail(api, threadId, type, msg) {
  return api.sendMessage({ plain: true, msg }, threadId, type);
}

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
      return fail(api, threadId, type, "❌ Không đọc được thông tin nhóm.");
    }
    const avt = group?.avt || group?.avatar;
    if (!avt) return fail(api, threadId, type, "❌ Nhóm không có ảnh đại diện.");
    const filePath = await profile.downloadImage(avt, "grp");
    if (!filePath) return fail(api, threadId, type, "❌ Tải ảnh nhóm thất bại.");
    try {
      await api.sendMessage({ msg: `🖼️ Ảnh đại diện nhóm: ${group?.name || "—"}`, attachments: filePath, ttlKind: "media" }, threadId, type);
    } catch (error) {
      return fail(api, threadId, type, `❌ Gửi ảnh thất bại: ${error.message}`);
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
    ({ user } = await fetchProfile(api, uid));
  } catch (error) {
    console.error("getavt:", error.message);
    return fail(api, threadId, type, `❌ Không đọc được thông tin của ${uid}: ${error.message}`);
  }

  const avatarUrl = String(user?.avatar || "").trim();
  const hasAvatar = /^https?:\/\//i.test(avatarUrl);
  if (!hasAvatar) return fail(api, threadId, type, `❌ Người dùng này chưa đặt ảnh đại diện Zalo (Zalo trả về "${avatarUrl || "trống"}").`);

  const filePath = await profile.downloadImage(avatarUrl, "avt");
  if (!filePath) return reply.error("Tải ảnh đại diện thất bại.");
  try {
    await api.sendMessage({ msg: `🖼️ Ảnh đại diện: ${user.displayName || uid}`, attachments: filePath, ttlKind: "media" }, threadId, type);
  } catch (error) {
    return reply.error(`Gửi ảnh thất bại: ${error.message}`);
  } finally {
    profile.cleanup(filePath);
  }
};
