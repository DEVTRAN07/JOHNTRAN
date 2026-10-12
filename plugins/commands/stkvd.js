// /stkvd — Sticker ĐỘNG từ ảnh/GIF/video (reply)
//   reply GIF/video/sticker động → tìm sticker ĐỘNG trong kho Zalo (searchSticker)
//   ưu tiên type = 1 → gõ /stkvd <số> để gửi sticker động thật.
//   reply sticker động gốc → gửi nguyên.
const http = require("../../core/http");
const { analyze } = require("../../core/imageAnalyze");
const stickerStore = require("../../core/stickerStore");
const { parseQuote } = require("../../core/mediaReply");

module.exports.config = {
  name: "stkvd",
  aliases: ["stkvideo"],
  version: "5.0.0",
  role: 0,
  author: "ᴶᴼᴴᴺ ᵀᴿᴬᴺ",
  description: "Sticker ĐỘNG từ ảnh/GIF/video (reply)",
  category: "Tiện ích",
  usage: "stkvd (reply gif/video/sticker động) | stkvd <số>",
  cooldowns: 5,
  dependencies: {}
};

// Sticker động Zalo = type 1
const ANIMATED = 1;

module.exports.run = async function ({ api, event, args }) {
  const { threadId, type, data } = event;

  // ===== Gõ số → gửi sticker động =====
  if (/^\d{1,2}$/.test(args[0] || "")) {
    const list = stickerStore.getSearch(threadId, data.uidFrom);
    const target = list?.[parseInt(args[0], 10) - 1];
    if (!target) return api.sendMessage({ plain: true, msg: "❌ Số không có trong kết quả. Reply ảnh rồi gõ /stkvd trước." }, threadId, type);
    try {
      await api.sendSticker({ id: target.id, cateId: target.cateId, type: ANIMATED }, threadId, type);
    } catch (error) {
      return api.sendMessage({ plain: true, msg: `❌ Gửi sticker động thất bại: ${error.message}` }, threadId, type);
    }
    return;
  }

  const media = parseQuote(event);
  if (!media) {
    return api.sendMessage({
      plain: true,
      msg: "❌ Hãy reply GIF/video/sticker động rồi gõ /stkvd"
    }, threadId, type);
  }

  // ===== Reply sticker động gốc → gửi nguyên =====
  if (media.isSticker && media.sticker.type === ANIMATED && media.sticker.cateId > 0) {
    try {
      await api.sendSticker({ id: media.sticker.id, cateId: media.sticker.cateId, type: ANIMATED }, threadId, type);
      return;
    } catch (error) {
      console.error("stkvd (sticker động gốc):", error.message);
    }
  }

  const url = media.image || media.video || media.file;
  if (!url) return api.sendMessage({ plain: true, msg: "❌ Tin reply không có media để phân tích." }, threadId, type);

  await api.sendMessage({ msg: "🔎 Đang phân tích và tìm sticker ĐỘNG...", plain: true }, threadId, type);

  let found = [];
  let info;
  try {
    const { buffer } = await http.getBuffer(url, { timeout: 60000 });
    info = await analyze(buffer);
    const seen = new Set();
    for (const keyword of info.keywords) {
      try {
        const ids = await api.searchSticker(`${keyword} dễ thương`, 40);
        if (!Array.isArray(ids) || !ids.length) continue;
        const details = await api.getStickersDetail(ids.slice(0, 24));
        // ưu tiên sticker động (type 1)
        const animated = (details || []).filter((d) => Number(d?.type) === ANIMATED && d?.id);
        const rest = (details || []).filter((d) => Number(d?.type) !== ANIMATED && d?.id);
        for (const d of [...animated, ...rest]) {
          if (seen.has(d.id)) continue;
          seen.add(d.id);
          found.push({ id: d.id, cateId: d.cateId, type: Number(d.type) || ANIMATED, keyword });
          if (found.length >= 10) break;
        }
      } catch { /* thử từ khóa tiếp */ }
      if (found.length) break;
    }
  } catch (error) {
    console.error("stkvd:", error.message);
    return api.sendMessage({ plain: true, msg: `❌ Tìm sticker thất bại: ${error.message}` }, threadId, type);
  }

  if (!found.length) {
    return api.sendMessage({ plain: true, msg: "❌ Không tìm thấy sticker động phù hợp. Thử ảnh khác." }, threadId, type);
  }

  stickerStore.setSearch(threadId, data.uidFrom, found);
  const animatedCount = found.filter((s) => s.type === ANIMATED).length;
  const shown = found.map((s, i) => `${i + 1}. ${s.type === ANIMATED ? "[động]" : "[tĩnh]"} id=${s.id} • kho ${s.cateId} (từ "${s.keyword}")`).join("\n");
  return api.sendMessage({
    plain: true,
    msg: `🎯 PHÂN TÍCH ẢNH\n• màu chủ đạo: ${info.dominant}\n• gợi ý: ${info.keywords.join(", ")}\n` +
         `• tìm thấy ${animatedCount} sticker động\n\n${shown}\n\n` +
         `Gõ ${global.config.prefix}stkvd <số> để gửi sticker động thật.`
  }, threadId, type);
};
