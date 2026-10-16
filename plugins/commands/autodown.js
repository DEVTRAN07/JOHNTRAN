// =====================================================================
// AUTODOWN v5.0 — plugin, cơ chế logic hoàn toàn mới
// Không dùng yt-dlp/Python. Gọi core/autodownEngine để trích xuất link
// trực tiếp từ HTML, tải file, xử lý ffmpeg, gửi lên Zalo.
// Đặc điểm: queue tuần tự, dedup link, rate limiter, circuit breaker,
// chỉ báo lỗi 1 lần, không spam lặp lại.
// =====================================================================
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const { Reactions, ThreadType } = require("zalo-client");
const engine = require("../../core/autodownEngine");
const { processVideo, processAudio } = require("../../utils/index");

module.exports.config = {
  name: "autodown",
  version: "5.0.0",
  role: 2,
  author: "ᴶᴼᴴᴺ ᵀᴿᴬᴺ",
  description: "Tự động tải media từ link chia sẻ trong nhóm (Tiktok, Youtube, Facebook, Instagram...)",
  category: "Tiện ích",
  usage: "autodown on | autodown off | autodown status",
  cooldowns: 5
};

const TEMP_DIR = path.join(__dirname, "temp");
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

function cleanupFile(filePath) {
  try { if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch { /* bỏ qua */ }
}

function sanitizeError(msg) {
  return String(msg || "lỗi không xác định").replace(/https?:\/\/\S+/g, "[link]").slice(0, 200);
}

// ---------- Tải file về tạm ----------
async function downloadToFile(url, outputPath) {
  const res = await axios.get(url, {
    responseType: "stream",
    timeout: 60000,
    headers: { ...engine.CONFIG.REQUEST_HEADERS || {}, "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36" },
    maxRedirects: 10
  });
  if (!res.data) throw new_error("Tải về rỗng");
  const writer = fs.createWriteStream(outputPath);
  res.data.pipe(writer);
  await new Promise((resolve, reject) => {
    writer.on("finish", resolve);
    writer.on("error", reject);
  });
  if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size === 0) throw new_error("File tải về rỗng");
  return outputPath;
}

function new_error(msg) { const e = new Error(msg); e.isAutodown = true; return e; }

// ---------- Xử lý phản hồi ----------
async function sendReactions(api, threadId, type, event, reactions) {
  for (const r of reactions) {
    try {
      await api.addReaction(Reactions.NONE, {
        data: { msgId: event.data.msgId, cliMsgId: event.data.cliMsgId },
        threadId, type
      });
      await api.addReaction(r, {
        data: { msgId: event.data.msgId, cliMsgId: event.data.cliMsgId },
        threadId, type
      });
    } catch { /* bỏ qua */ }
  }
}

// ---------- handleEvent ----------
module.exports.handleEvent = async function ({ api, event, Threads, isSelf }) {
  if (!event.data) return;
  if (event.type !== ThreadType.Group) return;
  if (isSelf === true) return;
  const rawContent = String(event.data.content || "").trim();
  if (global.config.prefix && rawContent.startsWith(global.config.prefix)) return;

  const url = engine.extractUrl(event.data.content);
  if (!url) return;

  const platform = engine.detectPlatform(url);
  if (platform === "generic") return; // link lạ → im lặng

  const { threadId, type } = event;
  const threadData = (await Threads.getData(threadId)).data || {};
  if (!threadData.auto_down) return;

  if (!engine.checkRateLimit(threadId)) return; // đạt giới hạn → im lặng
  if (engine.isCircuitOpen(platform)) return;   // nền tảng bị chặn → im lặng

  await sendReactions(api, threadId, type, event, [Reactions.LIKE]);

  try {
    const { info } = await engine.enqueue(() => engine.processLink({ url, threadId, type, api, event }));
    engine.circuitReset(platform);

    const messageBody = "🎦 AUTODOWN\n" +
      `Title: ${info.title}\n` +
      (info.author ? `Author: ${info.author}\n` : "") +
      (info.duration ? `Thời lượng: ${Math.floor(info.duration / 60)}:${String(info.duration % 60).padStart(2, "0")}\n` : "") +
      `Nguồn: ${info.platform} • ${info.source}`;

    const fileName = `dl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${info.type === "audio" ? "mp3" : "mp4"}`;
    const filePath = path.join(TEMP_DIR, fileName);

    try {
      await downloadToFile(info.videoUrl, filePath);

      if (info.type === "audio") {
        const voiceUrl = await processAudio(filePath, threadId, type, api);
        await api.sendMessage({ msg: messageBody }, threadId, type);
        await api.sendVoice({ voiceUrl }, threadId, type);
        await sendReactions(api, threadId, type, event, [Reactions.HEART]);
      } else {
        const videoData = await processVideo(filePath, threadId, type, api);
        await api.sendVideo({
          msg: messageBody,
          videoUrl: videoData.videoUrl,
          thumbnailUrl: videoData.thumbnailUrl,
          duration: videoData.metadata.duration,
          width: videoData.metadata.width,
          height: videoData.metadata.height
        }, threadId, type);
        await sendReactions(api, threadId, type, event, [Reactions.HEART]);
      }
    } finally {
      cleanupFile(filePath);
    }
    return;

  } catch (error) {
    engine.circuitFail(platform);
    await sendReactions(api, threadId, type, event, [Reactions.CRY]);
    // Chỉ báo lỗi 1 lần, không spam
    return api.sendMessage({
      msg: `❌ Không tải được link này.\n${sanitizeError(error.message)}\n\n💡 Nếu liên tục lỗi, nền tảng này sẽ bị bỏ qua tạm thời.`,
      plain: true
    }, threadId, type);
  }
};

// ---------- Lệnh ----------
module.exports.run = async function ({ api, event, args, Threads }) {
  const { threadId, type } = event;
  if (type === ThreadType.User) {
    return api.sendMessage({ msg: "❌ Autodown chỉ hoạt động trong nhóm.", plain: true }, threadId, type);
  }

  const action = (args[0] || "help").toLowerCase();

  if (action === "on" || action === "off") {
    const thread = await Threads.getData(threadId);
    thread.data.auto_down = action === "on";
    await Threads.setData(threadId, thread.data);
    return api.sendMessage({
      plain: true,
      msg: "📥 AUTODOWN\n" +
        `Trạng thái: ${action === "on" ? "ĐÃ BẬT ✅" : "ĐÃ TẮT ❌"}\n` +
        (action === "on"
          ? "Gửi link hỗ trợ vào nhóm là bot tự tải."
          : "Bot sẽ không tự tải link trong nhóm này nữa.")
    }, threadId, type);
  }

  if (action === "status" || action === "stt") {
    const thread = (await Threads.getData(threadId)).data || {};
    const openCircuits = [...engine.isCircuitOpen ? [] : []];
    return api.sendMessage({
      plain: true,
      msg: `📥 Autodown nhóm này: ${thread.auto_down ? "ĐANG BẬT ✅" : "ĐANG TẮT ❌"}\n` +
        `Dùng: autodown on / autodown off`
    }, threadId, type);
  }

  return api.sendMessage({
    plain: true,
    msg: '🔍 AUTODOWN HELPER v5\n\n' +
      'Tự động tải media từ link chia sẻ trong nhóm.\n\n' +
      '📌 Hỗ trợ: Tiktok, Youtube, Facebook, Instagram, Twitter/X, Vimeo, Dailymotion, Bilibili, Reddit, Capcut, Threads, Pinterest, Imgur, Soundcloud.\n\n' +
      '💡 Cách dùng: Gửi link http/https vào nhóm, bot tự tải (nếu nhóm đã bật autodown on).\n\n' +
      '🔰 Emoji: 👍 xử lý • ❤️ thành công • 😢 lỗi\n' +
      '⚙️ Admin: autodown on / off / status\n' +
      '🛡️ Cơ chế: rate limiter • circuit breaker • dedup link • chỉ báo lỗi 1 lần'
    }, threadId, type);
};
