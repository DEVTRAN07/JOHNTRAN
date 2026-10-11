// Spam sticker Zalo — cần ID/CATE sticker hợp lệ
const { Reactions } = require("zalo-client");

module.exports.config = {
  name: "spamsticker",
  aliases: ["sst", "sticker"],
  version: "2.0.0",
  role: 2,
  author: "ᴶᴼᴴᴺ ᵀᴿᴬᴺ",
  description: "Spam sticker Zalo (admin bot)",
  category: "Hệ thống",
  usage: "spamsticker [cateId] [stickerId] [số lần] | spamsticker off",
  cooldowns: 5,
  dependencies: {}
};

const running = new Map(); // threadId -> { timer, count }

module.exports.run = async function ({ api, event, args }) {
  const { threadId, type } = event;

  const sub = (args[0] || "").toLowerCase();

  if (sub === "off" || sub === "stop") {
    const job = running.get(threadId);
    if (!job) {
      return api.sendMessage({ msg: "❌ Không có spam sticker nào đang chạy.", ttl: 60000 }, threadId, type);
    }
    clearInterval(job.timer);
    running.delete(threadId);
    return api.sendMessage({ msg: `✅ Đã dừng spam sticker (đã gửi ${job.count} lần).`, ttl: 60000 }, threadId, type);
  }

  // Xem danh mục sticker (dùng API Zalo)
  if (sub === "list" || sub === "cate") {
    try {
      const cates = await api.getStickers();
      const lines = (cates || []).slice(0, 20).map((c) => `• ${c.id} — ${c.name}`);
      return api.sendMessage({ msg: `📋 Danh mục sticker:\n${lines.join("\n") || "(trống)"}`, ttl: 60000 }, threadId, type);
    } catch {
      return api.sendMessage({ msg: "❌ Không lấy được danh mục sticker.", ttl: 30000 }, threadId, type);
    }
  }

  const cateId = parseInt(args[0], 10);
  const stickerId = parseInt(args[1], 10);
  const times = Math.min(parseInt(args[2], 10) || 10, 100);

  if (!Number.isFinite(cateId) || !Number.isFinite(stickerId)) {
    return api.sendMessage({
      msg: `⚠️ Cách dùng:\n${global.config.prefix}spamsticker <cateId> <stickerId> <số lần>\n` +
           `${global.config.prefix}spamsticker list — xem danh mục\n` +
           `${global.config.prefix}spamsticker off — dừng\n\n` +
           "Ví dụ: /spamsticker 23338 6 10 (gửi sticker id 6, cate 23338, 10 lần)",
      ttl: 60000
    }, threadId, type);
  }

  if (running.has(threadId)) {
    return api.sendMessage({ msg: "⚠️ Spam sticker đang chạy trong nhóm này. Gõ /spamsticker off để dừng.", ttl: 60000 }, threadId, type);
  }

  const job = { count: 0, timer: null };
  job.timer = setInterval(async () => {
    if (job.count >= times) {
      clearInterval(job.timer);
      running.delete(threadId);
      return api.sendMessage({ msg: `✅ Đã spam xong ${job.count} sticker.`, ttl: 60000 }, threadId, type);
    }
    try {
      await api.sendSticker({
        id: stickerId,
        cateId: cateId,
        type: 0
      }, threadId, type);
      job.count++;
    } catch (error) {
      console.error("Lỗi gửi sticker:", error.message);
      clearInterval(job.timer);
      running.delete(threadId);
      return api.sendMessage({ msg: "❌ Lỗi khi gửi sticker — kiểm tra lại cateId/stickerId.", ttl: 30000 }, threadId, type);
    }
  }, 1000);

  running.set(threadId, job);
  return api.sendMessage({ msg: `▶️ Bắt đầu spam ${times} sticker (cate ${cateId}, id ${stickerId}).\nDừng: ${global.config.prefix}spamsticker off`, ttl: 60000 }, threadId, type);
};
