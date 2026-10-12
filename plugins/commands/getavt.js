// /getavt — lấy ảnh đại diện Zalo (người dùng hoặc nhóm)
//   /getavt              → ảnh của chính mình
//   /getavt <uid>        → ảnh theo UID
//   /getavt @nguoi_dung  → ảnh người được tag
//   /getavt box          → ảnh đại diện nhóm
//   /getavt debug        → gửi thông tin chẩn đoán (uid, Zalo trả gì)
const profile = require("../../core/canvas/profile");
const { fetchProfile } = require("../../core/zaloProfile");

module.exports.config = {
  name: "getavt",
  aliases: ["avt", "avatar"],
  version: "3.2.0",
  role: 0,
  author: "ᴶᴼᴴᴺ ᵀᴿᴬᴺ",
  description: "Lấy ảnh đại diện người dùng hoặc nhóm",
  category: "Tiện ích",
  usage: "getavt [uid | @tag | box | debug]",
  cooldowns: 3,
  dependencies: {}
};

// Gửi lỗi dạng TEXT để đọc được (ảnh thẻ canvas không copy được nội dung)
function say(api, threadId, type, msg) {
  return api.sendMessage({ plain: true, msg }, threadId, type);
}

// URL avatar Zalo hợp lệ (Zalo trả "/default" hoặc "" khi chưa đặt ảnh)
function usableAvatar(user) {
  const u = String(user?.avatar || "").trim();
  return /^https?:\/\//i.test(u) ? u : null;
}

// Lấy uid cần xem: uid → tag → chính mình
function resolveUid(args, data) {
  if (args[0] && /^\d{6,}$/.test(args[0])) return args[0];
  if (data.mentions && Object.keys(data.mentions).length > 0) return String(Object.keys(data.mentions)[0]);
  return String(data.uidFrom);
}

module.exports.run = async function ({ api, event, args, reply }) {
  const { threadId, type, data } = event;
  const arg = (args[0] || "").toLowerCase();

  // ===== CHẨN ĐOÁN: cho admin biết Zalo đang trả gì =====
  if (["debug", "chandoan", "info"].includes(arg)) {
    const uid = args[1] && /^\d{6,}$/.test(args[1]) ? args[1] : String(data.uidFrom);
    let raw;
    let err = null;
    try {
      ({ raw } = await fetchProfile(api, uid));
    } catch (e) {
      err = e.message;
    }
    const keys = raw ? Object.keys(raw).join(", ") : "(không có response)";
    const cp = raw?.changed_profiles;
    const cpKeys = cp ? (Array.isArray(cp) ? `mảng[${cp.length}]` : Object.keys(cp).join(", ")) : "không có";
    const up = raw?.unchanged_profiles;
    const upKeys = up ? Object.keys(up).join(", ") : "không có";
    return say(api, threadId, type,
      `🔍 CHẨN ĐOÁN /getavt\n` +
      `• uid gửi lên: ${uid}\n` +
      `• lỗi API: ${err || "không có"}\n` +
      `• top-level fields: ${keys}\n` +
      `• changed_profiles keys: ${cpKeys}\n` +
      `• unchanged_profiles keys: ${upKeys}\n` +
      `💡 Copy nội dung này gửi admin để sửa cho đúng.`
    );
  }

  // ===== Ảnh nhóm =====
  if (["box", "group", "nhom"].includes(arg)) {
    let group;
    try {
      const info = await api.getGroupInfo(threadId);
      group = info?.gridInfoMap?.[threadId];
    } catch (error) {
      return say(api, threadId, type, `❌ Không đọc được thông tin nhóm: ${error.message}`);
    }
    const avt = String(group?.avt || group?.avatar || "").trim();
    if (!/^https?:\/\//i.test(avt)) {
      return say(api, threadId, type, "❌ Nhóm không có ảnh đại diện (Zalo trả rỗng).");
    }
    const filePath = await profile.downloadImage(avt, "grp");
    if (!filePath) return say(api, threadId, type, "❌ Tải ảnh nhóm thất bại.");
    try {
      await api.sendMessage({ msg: `🖼️ Ảnh đại diện nhóm: ${group?.name || "—"}`, attachments: filePath, ttlKind: "media" }, threadId, type);
    } catch (error) {
      return say(api, threadId, type, `❌ Gửi ảnh thất bại: ${error.message}`);
    } finally {
      profile.cleanup(filePath);
    }
    return;
  }

  // ===== Ảnh người dùng =====
  const uid = resolveUid(args, data);
  let user;
  try {
    ({ user } = await fetchProfile(api, uid));
  } catch (error) {
    return say(api, threadId, type, `❌ Không đọc được thông tin của ${uid}: ${error.message}`);
  }
  if (!user) {
    return say(api, threadId, type, `❌ Zalo không trả về hồ sơ của ${uid}. Gõ ${global.config.prefix}getavt debug ${uid} để xem chi tiết.`);
  }

  const avatar = usableAvatar(user);
  if (!avatar) {
    return say(api, threadId, type,
      `❌ ${user.displayName || uid} chưa đặt ảnh đại diện Zalo.\n` +
      `(Zalo trả về đường dẫn "${String(user.avatar || "").trim() || "trống"}")`
    );
  }

  const filePath = await profile.downloadImage(avatar, "avt");
  if (!filePath) {
    return say(api, threadId, type, `❌ Tải ảnh thất bại. Link Zalo trả về có thể đã hỏng: ${avatar.slice(0, 60)}`);
  }
  try {
    await api.sendMessage({ msg: `🖼️ Ảnh đại diện: ${user.displayName || uid}`, attachments: filePath, ttlKind: "media" }, threadId, type);
  } catch (error) {
    return say(api, threadId, type, `❌ Gửi ảnh thất bại: ${error.message}`);
  } finally {
    profile.cleanup(filePath);
  }
};
