// /stk — Sticker từ ảnh/GIF/video (reply)
//   reply ảnh/GIF/video → phân tích màu → gợi ý từ khóa → TÌM STICKER ZALO
//   THẬT trong kho (searchSticker) → hiện danh sách → gõ /stk <số> để gửi.
//   reply sticker gốc → gửi lại chính sticker đó.
// (Zalo API không cho bot TẠO sticker mới từ ảnh nên cách này lấy sticker
//  có sẵn giống nhất — vẫn là sticker thật trong nhãn dán Zalo.)
const http = require("../../core/http");
const { analyze } = require("../../core/imageAnalyze");
const stickerStore = require("../../core/stickerStore");

module.exports.config = {
  name: "stk",
  aliases: ["sticker"],
  version: "5.0.0",
  role: 0,
  author: "ᴶᴼᴴᴺ ᵀᴿᴬᴺ",
  description: "Sticker từ ảnh/GIF/video (reply) — tìm sticker Zalo thật",
  category: "Tiện ích",
  usage: "stk (reply ảnh/gif/video/sticker) | stk <số>",
  cooldowns: 5,
  dependencies: {}
};

const SEARCH_TTL = 3 * 60 * 1000;

// Reply sticker gốc → gửi nguyên
async function sendOriginalSticker(api, threadId, type, sticker) {
  try {
    await api.sendSticker({ id: sticker.id, cateId: sticker.cateId, type: sticker.type || 0 }, threadId, type);
    return true;
  } catch (error) {
    console.error("stk (sticker gốc):", error.message);
    return false;
  }
}

// Reply ảnh/GIF/video → tìm sticker Zalo thật
async function findStickers(api, url, animated) {
  const { buffer } = await http.getBuffer(url, { timeout: 60000 });
  const info = await analyze(buffer);

  const found = [];
  const seen = new Set();
  for (const keyword of info.keywords) {
    try {
      const ids = await api.searchSticker(`${keyword} dễ thương`, animated ? 30 : 20);
      if (!Array.isArray(ids) || !ids.length) continue;
      const details = await api.getStickersDetail(ids.slice(0, 12));
      for (const d of details || []) {
        if (!d?.id || !d?.cateId || seen.has(d.id)) continue;
        seen.add(d.id);
        found.push({ id: d.id, cateId: d.cateId, type: Number(d.type) || (animated ? 1 : 0), keyword });
        if (found.length >= 10) break;
      }
    } catch { /* thử từ khóa tiếp */ }
    if (found.length) break;
  }
  return { found, info };
}

module.exports.run = async function ({ api, event, args }) {
  const { threadId, type, data } = event;
  const { parseQuote } = require("../../core/mediaReply");

  // ===== Gõ số → gửi sticker từ kết quả tìm =====
  if (/^\d{1,2}$/.test(args[0] || "")) {
    const list = stickerStore.getSearch(threadId, data.uidFrom);
    const target = list?.[parseInt(args[0], 10) - 1];
    if (!target) return api.sendMessage({ plain: true, msg: "❌ Số không có trong kết quả. Reply ảnh rồi gõ /stk trước." }, threadId, type);
    try {
      await api.sendSticker({ id: target.id, cateId: target.cateId, type: target.type || 0 }, threadId, type);
    } catch (error) {
      return api.sendMessage({ plain: true, msg: `❌ Gửi sticker thất bại: ${error.message}` }, threadId, type);
    }
    return;
  }

  // ===== Reply sticker gốc → gửi nguyên =====
  const media = parseQuote(event);
  if (media?.isSticker && media.sticker.cateId > 0) {
    const ok = await sendOriginalSticker(api, threadId, type, media.sticker);
    if (ok) return;
    // gửi không được → rơi xuống tìm theo URL nếu có
  }

  // ===== Reply ảnh/GIF/video → tìm sticker =====
  const url = media?.image || media?.video || media?.file;
  if (!url) {
    return api.sendMessage({
      plain: true,
      msg: "❌ Hãy reply ảnh/GIF/video/sticker rồi gõ /stk\n" +
           "Bot sẽ phân tích màu và tìm sticker Zalo thật trong kho."
    }, threadId, type);
  }

  await api.sendMessage({ msg: "🔎 Đang phân tích ảnh và tìm sticker...", plain: true }, threadId, type);

  let found;
  let info;
  try {
    ({ found, info } = await findStickers(api, url, false));
  } catch (error) {
    console.error("stk:", error.message);
    return api.sendMessage({ plain: true, msg: `❌ Tìm sticker thất bại: ${error.message}` }, threadId, type);
  }

  if (!found.length) {
    return api.sendMessage({ plain: true, msg: "❌ Không tìm thấy sticker phù hợp. Thử ảnh khác." }, threadId, type);
  }

  stickerStore.setSearch(threadId, data.uidFrom, found);
  const shown = found.map((s, i) => `${i + 1}. [${s.type ? "động" : "tĩnh"}] id=${s.id} • kho ${s.cateId} (từ "${s.keyword}")`).join("\n");
  return api.sendMessage({
    plain: true,
    msg: `🎯 PHÂN TÍCH ẢNH\n• màu chủ đạo: ${info.dominant}\n• độ sáng: ${info.brightness}/255\n` +
         `• gợi ý: ${info.keywords.join(", ")}\n\n${shown}\n\n` +
         `Gõ ${global.config.prefix}stk <số> để gửi sticker thật.`
  }, threadId, type);
};
