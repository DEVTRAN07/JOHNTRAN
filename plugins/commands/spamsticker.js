// Spam sticker HIỆU ỨNG màn hình (gây lag) — nguồn stickers.zaloapp.com
// Kho sticker tự nạp: catalog → lọc effectId > 0 (hoặc sticker động) → gửi ngẫu nhiên.
// Dùng: /spamsticker on [số lần] | off | list | test | reload
const stickerStore = require("../../core/stickerStore");

module.exports.config = {
  name: "spamsticker",
  aliases: ["sst", "sticker"],
  version: "3.1.0",
  role: 2,
  author: "ᴶᴼᴴᴺ ᵀᴿᴬᴺ",
  description: "Spam sticker hiệu ứng màn hình (admin bot)",
  category: "Hệ thống",
  usage: "spamsticker on [số lần] | spamsticker off | list | test | reload",
  cooldowns: 5,
  dependencies: {}
};

const running = new Map(); // threadId -> { timer, count, times }
const SEND_DELAY_MS = 1200; // sticker hiệu ứng nặng: gửi nhanh Zalo chặn
const MAX_TIMES = 500;

module.exports.run = async function ({ api, event, args }) {
  const { threadId, type } = event;
  const sub = (args[0] || "").toLowerCase();

  // ===== TẮT =====
  if (sub === "off" || sub === "stop") {
    const job = running.get(threadId);
    if (!job) return api.sendMessage({ msg: "❌ Không có spam sticker nào đang chạy.", ttl: 60000 }, threadId, type);
    clearInterval(job.timer);
    running.delete(threadId);
    return api.sendMessage({ msg: `✅ Đã dừng spam sticker (đã gửi ${job.count}/${job.times}).`, ttl: 60000 }, threadId, type);
  }

  // ===== KIỂM TRA NGUỒN (test 1 bộ, không spam) =====
  if (sub === "test" || sub === "check") {
    try {
      const pool = await stickerStore.build(api);
      const sample = pool.slice(0, 3).map((s, i) => `${i + 1}. id=${s.id} cate=${String(s.cateId).slice(0, 10)} type=${s.type} effect=${s.effectId || "?"}`).join("\n");
      return api.sendMessage({
        msg: `✅ Nguồn sticker OK — ${pool.length} sticker hiệu ứng\n${sample}\n\nGõ /spamsticker on để bắt đầu.`,
        ttl: 60000
      }, threadId, type);
    } catch (error) {
      return api.sendMessage({ msg: `❌ Không nạp được sticker: ${error.message}`, ttl: 60000 }, threadId, type);
    }
  }

  // ===== XEM KHO =====
  if (sub === "list" || sub === "info" || sub === "stats") {
    const s = stickerStore.stats();
    return api.sendMessage({
      msg: `📦 Kho sticker hiệu ứng: ${s.total} sticker\n` +
           `Trạng thái: ${s.fresh ? "sẵn sàng ✅" : "cần nạp lại (dùng /spamsticker reload)"}` +
           (s.total ? "" : `\n\n🔎 Log nạp gần nhất:\n${(s.log || []).join("\n") || "(chưa nạp)"}`),
      ttl: 60000
    }, threadId, type);
  }

  // ===== NẠP LẠI KHO =====
  if (sub === "reload" || sub === "load") {
    try {
      const pool = await stickerStore.build(api);
      return api.sendMessage({ msg: `✅ Đã nạp ${pool.length} sticker hiệu ứng từ stickers.zaloapp.com.`, ttl: 60000 }, threadId, type);
    } catch (error) {
      return api.sendMessage({ msg: `❌ Nạp sticker thất bại: ${error.message}`, ttl: 60000 }, threadId, type);
    }
  }

  // ===== BẬT =====
  if (sub !== "on" && sub !== "start" && sub !== "bat") {
    return api.sendMessage({
      msg: `⚠️ Cách dùng:\n` +
           `${global.config.prefix}spamsticker on [số lần] — bật spam sticker hiệu ứng\n` +
           `${global.config.prefix}spamsticker off — tắt\n` +
           `${global.config.prefix}spamsticker list — xem kho sticker\n` +
           `${global.config.prefix}spamsticker test — kiểm tra nguồn (không spam)\n` +
           `${global.config.prefix}spamsticker reload — nạp lại kho\n\n` +
           "Sticker hiệu ứng = loại bắn hiệu ứng full màn hình, gửi liên tiếp sẽ lag điện thoại.",
      ttl: 60000
    }, threadId, type);
  }

  if (running.has(threadId)) {
    return api.sendMessage({ msg: "⚠️ Spam sticker đang chạy trong nhóm này. Gõ /spamsticker off để dừng.", ttl: 60000 }, threadId, type);
  }

  try {
    await api.sendMessage({ msg: "⏳ Đang nạp sticker hiệu ứng từ stickers.zaloapp.com...", ttl: 60000 }, threadId, type);
  } catch { /* không bắt buộc */ }

  let pool;
  try {
    pool = await stickerStore.ensure(api);
  } catch (error) {
    return api.sendMessage({ msg: `❌ ${error.message}`, ttl: 60000 }, threadId, type);
  }

  // Số lần: mặc định 100, 0 = không giới hạn (dừng bằng off)
  const wanted = parseInt(args[1], 10);
  const times = !Number.isFinite(wanted) || wanted < 0 ? 100 : Math.min(wanted || MAX_TIMES, MAX_TIMES);
  const timesText = wanted === 0 ? "∞ (tới khi off)" : String(times);

  const job = { count: 0, times, timer: null };
  job.timer = setInterval(async () => {
    if (wanted !== 0 && job.count >= times) {
      clearInterval(job.timer);
      running.delete(threadId);
      return api.sendMessage({ msg: `✅ Đã spam xong ${job.count} sticker hiệu ứng.`, ttl: 60000 }, threadId, type);
    }
    const sticker = stickerStore.pick();
    if (!sticker) {
      clearInterval(job.timer);
      running.delete(threadId);
      return api.sendMessage({ msg: "❌ Kho sticker rỗng — dùng /spamsticker reload.", ttl: 60000 }, threadId, type);
    }
    try {
      await api.sendSticker({
        id: sticker.id,
        cateId: sticker.cateId,
        type: sticker.type
      }, threadId, type);
      job.count++;
    } catch (error) {
      console.error("Lỗi gửi sticker:", error.message);
      clearInterval(job.timer);
      running.delete(threadId);
      return api.sendMessage({ msg: `❌ Lỗi khi gửi sticker (đã gửi ${job.count}/${timesText}) — Zalo có thể đang chặn.\n${error.message}`.slice(0, 300), ttl: 60000 }, threadId, type);
    }
  }, SEND_DELAY_MS);

  running.set(threadId, job);
  return api.sendMessage({
    msg: `▶️ Bắt đầu spam ${timesText} sticker hiệu ứng (kho ${pool.length} sticker).\n` +
         `Tắt: ${global.config.prefix}spamsticker off`,
    ttl: 60000
  }, threadId, type);
};
