// Kho sticker "hiệu ứng vào màn hình" (Zalo: effectId > 0).
// Nguồn danh mục: https://stickers.zaloapp.com/sticker (public, không cần login)
// Chi tiết từng sticker (kèm effectId): api.getStickerCategoryDetail(cateId)
// Sticker hiệu ứng là loại nặng nhất — gửi liên tiếp sẽ lag điện thoại.
//
// LƯU Ý: API Zalo có thể trả shape khác nhau tuỳ phiên bản nên code ở đây
// chấp nhận NHIỀU dạng dữ liệu và có nhiều lớp dự phòng (xem extractStickers).
const http = require("./http");
const logger = require("../utils/logger");

const STORE_URL = "https://stickers.zaloapp.com/sticker";
const POOL_TTL_MS = 30 * 60 * 1000; // 30 phút nạp lại
const MAX_CATES = 24; // số bộ sticker quét mỗi lần nạp (quét hết 214 bộ rất lâu)

let pool = [];
let builtAt = 0;
let building = null;
let lastBuildLog = []; // log chi tiết lần nạp gần nhất (để user báo lỗi)

function shuffle(list) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

async function fetchCateIds() {
  const { data } = await http.getJson(STORE_URL, { timeout: 20000, retries: 1 });
  const sets = data?.value?.all || data?.value?.hot || data?.value?.popular || [];
  const ids = [...new Set((sets || []).map((s) => String(s?.id || "")).filter(Boolean))];
  if (!ids.length) throw new Error("stickers.zaloapp.com không trả về bộ sticker nào");
  return ids;
}

// effectId > 0 = sticker có hiệu ứng full màn hình (bắn confetti, chữ to...)
// Không có field effectId (API đổi shape) → fallback theo type: sticker động
// (type >= 1) cũng là loại nặng, vẫn gây lag.
function isEffectSticker(sticker) {
  if (!sticker || !sticker.id) return false;
  if (sticker.effectId !== undefined && sticker.effectId !== null) return Number(sticker.effectId) > 0;
  return Number(sticker.type) >= 1;
}

// Nhận diện danh sách sticker từ nhiều shape trả về khác nhau của API
function extractStickers(response, cateId) {
  if (Array.isArray(response)) return response;
  if (!response || typeof response !== "object") return [];
  for (const key of ["stickers", "items", "data", "list", "result"]) {
    const value = response[key];
    if (Array.isArray(value)) return value;
    if (value && typeof value === "object" && Array.isArray(value.items)) return value.items;
  }
  return [];
}

async function loadCategory(api, cateId) {
  // Zalo nhận cateId dạng chuỗi (hash) hoặc số tuỳ phiên bản — thử cả hai
  const attempts = [cateId, Number(cateId)].filter((v, i, arr) => arr.indexOf(v) === i);
  for (const cid of attempts) {
    try {
      const response = await api.getStickerCategoryDetail(cid);
      const stickers = extractStickers(response, cid);
      if (stickers.length) return stickers.map((sticker) => ({ ...sticker, cateId: sticker.cateId ?? cateId }));
    } catch { /* thử dạng tiếp theo */ }
  }
  return [];
}

async function build(api) {
  if (building) return building;
  building = (async () => {
    const cateIds = shuffle(await fetchCateIds());
    const limit = Math.min(MAX_CATES, cateIds.length);
    const picked = [];
    const log = [];

    for (const cateId of cateIds.slice(0, limit)) {
      try {
        const stickers = await loadCategory(api, cateId);
        const effects = stickers.filter(isEffectSticker);
        log.push(`${cateId}: ${stickers.length} sticker${effects.length ? `, ${effects.length} hiệu ứng` : ""}`);
        for (const st of effects) {
          picked.push({
            id: st.id,
            cateId: st.cateId ?? cateId,
            type: Number(st.type) || 1,
            effectId: Number(st.effectId) || 0
          });
        }
      } catch (error) {
        log.push(`${cateId}: LỖI ${error.message.slice(0, 60)}`);
      }
    }

    lastBuildLog = log;
    if (!picked.length) {
      throw new Error(
        `Không tìm thấy sticker hiệu ứng (đã quét ${limit} bộ). ` +
        `Chi tiết: ${log.slice(0, 3).join(" | ")}${log.length > 3 ? " ..." : ""}`
      );
    }
    pool = picked;
    builtAt = Date.now();
    logger.log(`[sticker] Đã nạp ${pool.length} sticker hiệu ứng (quét ${limit} bộ)`, "info");
    return pool;
  })();

  try {
    return await building;
  } finally {
    building = null;
  }
}

function isFresh() {
  return pool.length > 0 && Date.now() - builtAt < POOL_TTL_MS;
}

async function ensure(api) {
  return isFresh() ? pool : build(api);
}

function pick() {
  if (!pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

function stats() {
  return { total: pool.length, ageMs: builtAt ? Date.now() - builtAt : null, fresh: isFresh(), log: lastBuildLog.slice(0, 5) };
}

// ===== Kết quả TÌM sticker tạm thời (dùng cho /stk find rồi gõ số) =====
const searches = new Map();
const SEARCH_TTL_MS = 3 * 60 * 1000;

function sKey(threadId, uid) {
  return `${threadId}:${uid}`;
}

function setSearch(threadId, uid, list) {
  searches.set(sKey(threadId, uid), { list, at: Date.now() });
}

function getSearch(threadId, uid) {
  const entry = searches.get(sKey(threadId, uid));
  if (!entry) return null;
  if (Date.now() - entry.at > SEARCH_TTL_MS) {
    searches.delete(sKey(threadId, uid));
    return null;
  }
  return entry.list;
}

module.exports = { build, ensure, pick, stats, isFresh, STORE_URL, setSearch, getSearch };
