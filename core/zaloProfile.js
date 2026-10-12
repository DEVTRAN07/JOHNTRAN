// ===== LẤY HỒ SƠ ZALO CHUẨN (dùng cho getavt / cardzalo) =====
// getUserInfo của Zalo map uid thành "uid_0" trước khi gọi API, nên key trong
// changed_profiles/unchanged_profiles KHÔNG phải uid trơn mà bạn gửi vào.
// Helper này thử mọi khả năng để không bao giờ trả về null oan.
const AVATAR_LARGE = 240;

// Chọn đúng bản ghi user trong response (thử uid, uid_0, prefix, hoặc entry duy nhất)
function pickUser(info, uid) {
  if (!info) return null;
  const maps = [info.changed_profiles, info.unchanged_profiles];
  for (const map of maps) {
    if (!map || typeof map !== "object") continue;
    if (map[uid]) return map[uid];
    if (map[`${uid}_0`]) return map[`${uid}_0`];
    const keys = Object.keys(map);
    for (const key of keys) {
      if (key === uid || key.startsWith(`${uid}_`) || key.startsWith(uid)) return map[key];
    }
    if (keys.length === 1) return map[keys[0]];
  }
  return null;
}

/**
 * Lấy hồ sơ + avatar kích thước lớn.
 * @returns {Promise<{user: object|null, raw: object}>}
 */
async function fetchProfile(api, uid) {
  let raw;
  try {
    raw = await api.getUserInfo(String(uid), AVATAR_LARGE);
  } catch (error) {
    // Thử lại không kèm avatarSize (một số phiên bản không nhận tham số 2)
    try {
      raw = await api.getUserInfo(String(uid));
    } catch (error2) {
      throw error;
    }
  }
  return { user: pickUser(raw, String(uid)), raw };
}

module.exports = { pickUser, fetchProfile, AVATAR_LARGE };
