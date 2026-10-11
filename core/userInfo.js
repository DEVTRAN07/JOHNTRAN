// Lấy thông tin người dùng Zalo (chuẩn hóa về 1 dạng dùng chung)
async function getUserInfo(api, uid) {
  const id = String(uid);
  let profile = {};
  try {
    const res = await api.getUserInfo(id);
    profile = res?.changed_profiles?.[id] || res?.profiles?.[id] || {};
  } catch {
    profile = {};
  }
  return {
    userId: id,
    displayName: profile.displayName || profile.zaloName || id,
    zaloName: profile.zaloName || "",
    avatar: profile.avatar || "",
    gender: profile.gender,
    sdob: profile.sdob || "",
    status: profile.status || "",
    lastActionTime: profile.lastActionTime || 0,
    isActive: Number(profile.lastActionTime || 0) > 0
  };
}

module.exports = { getUserInfo };
