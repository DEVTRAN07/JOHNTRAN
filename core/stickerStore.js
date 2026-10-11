// Kho sticker "hiệu ứng vào màn hình" (Zalo: effectId != 0).
// Nguồn danh mục: https://stickers.zaloapp.com/sticker (public, không cần login)
// Chi tiết từng sticker (kèm effectId): api.getStickerCategoryDetail(cateId)
// Sticker hiệu ứng là loại nặng nhất — gây lag/đứng máy khí gửi liên tiếp.
const http = require("./http");
const logger = require("../utils/logger");

const STORE_URL = "https://stickers.zaloapp.com/sticker";
const POOL_TTL_MS = 30 * 60 * 1000; // 30 phút nạp lại
const MAX_CATES = 24; // số bộ sticker quét mỗi lần nạp (quét hết 214 bộ rất lâu)

let pool = [];
let builtAt = 0;
let building = null;

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
function isEffectSticker(sticker) {
  return sticker && sticker.id && Number(sticker.effectId) > 0;
}

async function build(api) {
  if (building) return building;
  building = (async () => {
    const cateIds = shuffle(await fetchCateIds());
    const limit = Math.min(MAX_CATES, cateIds.length);
    const picked = [];

    for (const cateId of cateIds.slice(0, limit)) {
      try {
        const stickers = await api.getStickerCategoryDetail(cateId);
        if (!Array.isArray(stickers)) continue;
        for (const st of stickers) {
          if (isEffectSticker(st)) {
            picked.push({
              id: st.id,
              cateId: st.cateId ?? cateId,
              type: Number(st.type) || 1,
              effectId: Number(st.effectId)
            });
          }
        }
      } catch (error) {
        logger.log(`[sticker] Bỏ qua bộ ${cateId}: ${error.message}`, "warn");
      }
    }

    if (!picked.length) throw new Error("Không có sticker hiệu ứng nào trong các bộ đã quét");
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
  return { total: pool.length, ageMs: builtAt ? Date.now() - builtAt : null, fresh: isFresh() };
}

module.exports = { build, ensure, pick, stats, isFresh, STORE_URL };
