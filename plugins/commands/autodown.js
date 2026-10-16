// =====================================================================
// AUTODOWN v4.0 — tự động tải media từ link trong nhóm
// Cơ chế mới:
//   • Phát hiện URL trong text + object chia sẻ (Zalo)
//   • Pipeline trích xuất: yt-dlp → API → HTML meta
//   • Cache TTL (tránh tải lại cùng link)
//   • Rate limiter mỗi nhóm (tránh spam)
//   • Circuit breaker mỗi nền tảng (bỏ qua nếu l� liên tiếp)
//   • Chỉ báo lỗi 1 lần, không spam lặp lại
// =====================================================================
const fs = require("fs");
const path = require("path");
const { Reactions, ThreadType } = require("zalo-client");
const mediaExtractor = require("../../core/mediaExtractor");
const downloadManager = require("../../core/downloadManager");
const { processVideo, processAudio } = require("../../utils/index");

module.exports.config = {
  name: "autodown",
  version: "4.0.0",
  role: 2,
  author: "ᴶᴼᴴᴺ ᵀᴿᴬᴺ",
  description: "Tự động tải media từ link chia sẻ trong nhóm (Tiktok, Youtube, Facebook, Instagram...)",
  category: "Tiện ích",
  usage: "autodown on | autodown off | autodown status",
  cooldowns: 5
};

const LINK_RE = /(https?:\/\/[^\s<>"']+)/i;

// Rate limiter mỗi nhóm: { threadId: { count, windowStart, lastUrls: Set } }
const RATE_LIMIT_MAX = 5; // tối đa 5 tải / cửa sổ
const RATE_LIMIT_WINDOW = 5 * 60 * 1000; // 5 phút
const rateLimitState = new Map();

// Circuit breaker mỗi nền tảng: { platform: { fails, lastFail, blockedUntil } }
const CIRCUIT_FAIL_THRESHOLD = 3;
const CIRCUIT_COOLDOWN = 10 * 60 * 1000; // 10 phút
const circuitState = new Map();

// URL dedup trong 2 phút (tránh xử lý trùng link vừa tải)
const URL_DEDUP_TTL = 2 * 60 * 1000;
const recentUrls = new Map(); // url => expiry

// ===== Tiện ích =====
function now() { return Date.now(); }

function findUrlInString(text) {
  const m = String(text).match(LINK_RE);
  return m ? m[1].replace(/[.,)\]]+$/, "") : null;
}

function extractUrl(content, depth = 0) {
  if (!content || depth > 4) return null;
  if (typeof content === "string") return findUrlInString(content);
  if (typeof content !== "object") return null;

  for (const key of ["href", "url", "link", "src", "value", "thumb"]) {
    const value = content[key];
    if (typeof value === "string") {
      const found = findUrlInString(value);
      if (found) return found;
    } else if (value && typeof value === "object") {
      const found = extractUrl(value, depth + 1);
      if (found) return found;
    }
  }
  for (const value of Object.values(content)) {
    if (typeof value === "string") {
      const found = findUrlInString(value);
      if (found) return found;
    } else if (value && typeof value === "object") {
      const found = extractUrl(value, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

function sanitizeError(msg) {
  return String(msg || "lỗi không xác định")
    .replace(/https?:\/\/\S+/g, "[link]")
    .slice(0, 200);
}

function tempDir() {
  const dir = path.join(__dirname, "temp");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function cleanupFile(filePath) {
  try { if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch { /* bỏ qua */ }
}

// ===== Rate limiter =====
function checkRateLimit(threadId) {
  const t = now();
  let st = rateLimitState.get(threadId);
  if (!st || t - st.windowStart > RATE_LIMIT_WINDOW) {
    st = { count: 0, windowStart: t, lastUrls: new Set() };
    rateLimitState.set(threadId, st);
  }
  if (st.count >= RATE_LIMIT_MAX) return false;
  st.count++;
  return true;
}

// ===== Circuit breaker =====
function isCircuitOpen(platform) {
  const st = circuitState.get(platform);
  if (!st) return false;
  if (now() > st.blockedUntil) {
    circuitState.delete(platform);
    return false;
  }
  return true;
}

function circuitFail(platform) {
  const st = circuitState.get(platform) || { fails: 0, blockedUntil: 0 };
  st.fails++;
  if (st.fails >= CIRCUIT_FAIL_THRESHOLD) {
    st.blockedUntil = now() + CIRCUIT_COOLDOWN;
  }
  circuitState.set(platform, st);
}

function circuitReset(platform) {
  circuitState.delete(platform);
}

// ===== URL dedup =====
function isRecentUrl(url) {
  const expiry = recentUrls.get(url);
  if (!expiry) return false;
  if (now() > expiry) {
    recentUrls.delete(url);
    return false;
  }
  return true;
}

function markRecentUrl(url) {
  recentUrls.set(url, now() + URL_DEDUP_TTL);
}

// ===== Xử lý sự kiện tin nhắn =====
module.exports.handleEvent = async function ({ api, event, Threads, isSelf }) {
  if (!event.data) return;

  // Chỉ nhóm
  if (event.type !== ThreadType.Group) return;
  // Bỏ qua tin bot tự gửi (tránh vòng lặp)
  if (isSelf === true) return;
  // Bỏ qua lệnh (bắt đầu bằng prefix)
  const rawContent = String(event.data.content || "").trim();
  if (global.config.prefix && rawContent.startsWith(global.config.prefix)) return;

  const url = extractUrl(event.data.content);
  if (!url) return;

  const platform = mediaExtractor.detectPlatform(url);
  if (platform === "generic") return; // link lạ → im lặng

  // Dedup URL
  if (isRecentUrl(url)) return;
  markRecentUrl(url);

  const { threadId, type } = event;

  // Chỉ nhóm đã bật autodown
  const threadData = (await Threads.getData(threadId)).data || {};
  if (!threadData.auto_down) return;

  // Rate limiter
  if (!checkRateLimit(threadId)) return; // đạt giới hạn → im lắng

  // Circuit breaker
  if (isCircuitOpen(platform)) return; // nền tảng đang bị chặn tạm thời

  const setReactions = async (reactions) => {
    for (const reaction of reactions) {
      try {
        await api.addReaction(Reactions.NONE, {
          data: { msgId: event.data.msgId, cliMsgId: event.data.cliMsgId },
          threadId, type
        });
        await api.addReaction(reaction, {
          data: { msgId: event.data.msgId, cliMsgId: event.data.cliMsgId },
          threadId, type
        });
      } catch { /* bỏ qua */ }
    }
  };

  try {
    await setReactions([Reactions.LIKE]);

    // 1) Trích xuất thông tin media qua pipeline
    const info = await mediaExtractor.extractMedia(url);
    circuitReset(platform); // thành công → reset circuit breaker

    const messageBody = "🎦 AUTODOWN\n" +
      `Title: ${info.title}\n` +
      (info.author ? `Author: ${info.author}\n` : "") +
      (info.duration ? `Thời lượng: ${Math.floor(info.duration / 60)}:${String(info.duration % 60).padStart(2, "0")}\n` : "") +
      `Nguồn: ${info.platform} • ${info.source}`;

    // 2) Tải file (có cache TTL)
    const { filePath, fromCache } = await downloadManager.downloadMedia(url, tempDir());

    // 3) Gửi theo loại
    if (info.type === "audio") {
      try {
        const voiceUrl = await processAudio(filePath, threadId, type, api);
        await api.sendMessage({ msg: messageBody }, threadId, type);
        await api.sendVoice({ voiceUrl }, threadId, type);
        await setReactions([Reactions.HEART]);
      } finally {
        cleanupFile(filePath);
      }
      return;
    }

    // Video
    const videoData = await processVideo(filePath, threadId, type, api);
    await api.sendVideo({
      msg: messageBody,
      videoUrl: videoData.videoUrl,
      thumbnailUrl: videoData.thumbnailUrl,
      duration: videoData.metadata.duration,
      width: videoData.metadata.width,
      height: videoData.metadata.height
    }, threadId, type);
    await setReactions([Reactions.HEART]);
    cleanupFile(filePath);

  } catch (error) {
    circuitFail(platform);
    const hint = sanitizeError(error.message);
    await setReactions([Reactions.CRY]);
    // Chỉ gửi 1 tin lỗi, không spam lặp lại
    return api.sendMessage({
      msg: `❌ Không tải được link này.\n${hint}\n\n💡 Nếu liên tục lỗi, nền tảng này sẽ được bỏ qua tạm thời (circuit breaker).`,
      plain: true
    }, threadId, type);
  }
};

// ===== Lệnh điều khiển =====
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
          ? "Gửi link hỗ trợ (Tiktok, Youtube, Facebook, Instagram...) vào nhóm là bot tự tải."
          : "Bot sẽ không tự tải link trong nhóm này nữa.")
    }, threadId, type);
  }

  if (action === "status" || action === "stt") {
    const thread = (await Threads.getData(threadId)).data || {};
    const stats = downloadManager.getCacheStats();
    const openCircuits = [...circuitState.entries()]
      .filter(([, st]) => now() < st.blockedUntil)
      .map(([p]) => p)
      .join(", ") || "không";
    return api.sendMessage({
      plain: true,
      msg: `📥 Autodown nhóm này: ${thread.auto_down ? "ĐANG BẬT ✅" : "ĐANG TẮT ❌"}\n` +
        `🗄️ Cache: ${stats.size} media • ${stats.running} đang tải • ${stats.queued} chờ\n` +
        `🚫 Circuit breaker: ${openCircuits}\n` +
        `Dùng: autodown on / autodown off`
    }, threadId, type);
  }

  if (action === "clear") {
    downloadManager.clearCache();
    recentUrls.clear();
    return api.sendMessage({ msg: "🧹 Đã xóa cache autodown.", plain: true }, threadId, type);
  }

  return api.sendMessage({
    plain: true,
    msg: '🔍 AUTODOWN HELPER v4\n\n' +
      'Tự động tải xuống media từ link chia sẻ trong nhóm.\n\n' +
      '📌 Hỗ trợ: Tiktok, Youtube, Facebook, Instagram, Twitter/X, Vimeo, Dailymotion, Bilibili, Reddit, Capcut, Threads, Pinterest, Imgur, Soundcloud, Mixcloud, Spotify, Zingmp3, Bandcamp.\n\n' +
      '💡 Cách dùng: Chỉ cần gửi link http/https vào nhóm, bot sẽ tự tải (nếu nhóm đã bật autodown on).\n\n' +
      '🔰 Emoji: 👍 đang xử lý • ❤️ thành công • 😢 lỗi\n' +
      '⚙️ Admin: autodown on / off / status / clear\n' +
      '🛡️ Cơ chế: rate limiter mỗi nhóm • circuit breaker mỗi nền tảng • cache TTL 10 phút'
    }, threadId, type);
};
