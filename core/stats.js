// Thu thập thống kê bot: hồ sơ (avatar, SĐT), bạn bè, nhóm đang ở.
// Bot con lưu vào store mỗi 30s; panel API đọc từ store để hiển thị.
const cache = require("./cache");
const logger = require("../utils/logger");
const { ThreadType } = require("zalo-client");

const FRIENDS_CACHE_TTL = 300000; // 5 phút
const GROUPS_CACHE_TTL = 300000;
const MAX_LIST = 50; // số bạn/nhóm tối đa gửi lên panel

let friendsCache = null;
let groupsCache = null;

async function getProfile(api) {
  try {
    const uid = await api.getOwnId();
    const info = await api.fetchAccountInfo();
    const profile = info?.profile || {};
    return {
      uid: String(uid || profile.userId || ""),
      displayName: profile.displayName || profile.zaloName || "",
      avatar: profile.avatar || "",
      phoneNumber: profile.phoneNumber || "",
      status: profile.status || "",
      gender: profile.gender
    };
  } catch (error) {
    logger.log(`[stats] Không lấy được hồ sơ: ${error.message}`, "warn");
    return null;
  }
}

async function getFriends(api) {
  if (friendsCache && friendsCache.expiresAt > Date.now()) return friendsCache.data;
  try {
    const friends = (await api.getAllFriends(500)) || [];
    friendsCache = {
      expiresAt: Date.now() + FRIENDS_CACHE_TTL,
      data: {
        total: friends.length,
        list: friends.slice(0, MAX_LIST).map((f) => ({
          uid: String(f.userId || ""),
          displayName: f.displayName || "",
          avatar: f.avatar || ""
        }))
      }
    };
    return friendsCache.data;
  } catch (error) {
    logger.log(`[stats] Không lấy được danh sách bạn bè: ${error.message}`, "warn");
    return { total: 0, list: [] };
  }
}

async function getGroups(api) {
  if (groupsCache && groupsCache.expiresAt > Date.now()) return groupsCache.data;
  try {
    const { gridVerMap } = (await api.getAllGroups()) || {};
    const ids = Object.keys(gridVerMap || {});
    const list = [];
    for (const gid of ids.slice(0, MAX_LIST)) {
      try {
        // dùng cache sẵn có của api wrapper (5 phút) để không gọi lại Zalo
        const info = await cache.caches.groupInfo.remember(gid, () => api.getGroupInfo(gid));
        const g = info?.gridInfoMap?.[gid];
        if (g) {
          list.push({
            gid: String(gid),
            name: g.name || "",
            totalMember: g.totalMember || 0,
            avatar: g.avt || ""
          });
        }
      } catch { /* bỏ qua nhóm lỗi */ }
    }
    groupsCache = {
      expiresAt: Date.now() + GROUPS_CACHE_TTL,
      data: { total: ids.length, list }
    };
    return groupsCache.data;
  } catch (error) {
    logger.log(`[stats] Không lấy được danh sách nhóm: ${error.message}`, "warn");
    return { total: 0, list: [] };
  }
}

async function collectStats(api) {
  const profile = await getProfile(api);
  const friends = await getFriends(api);
  const groups = await getGroups(api);

  return {
    collectedAt: Date.now(),
    profile,
    friends,
    groups,
    process: {
      uptimeMs: process.uptime() * 1000,
      memoryMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
      node: process.version,
      pid: process.pid
    }
  };
}

function invalidate() {
  friendsCache = null;
  groupsCache = null;
}

module.exports = { collectStats, invalidate, getFriends, getGroups, getProfile };
