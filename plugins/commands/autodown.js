// =====================================================================
// AUTODOWN v7.0 — đơn giản, tự chứa, chỉ báo lỗi 1 lần
// Không dùng yt-dlp/Python. Trích xuất link video trực tiếp từ HTML
// (og:video / twitter:player), hỗ trợ cookie TikTok, fallback API tikwm.
// Cơ chế: dedup link (30s), chỉ xử lý 1 link mỗi lần, lỗi → 1 tin, không spam.
// =====================================================================
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const cheerio = require("cheerio");
const { Reactions, ThreadType } = require("zalo-client");
const { processVideo, processAudio } = require("../../utils/index");

module.exports.config = {
  name: "autodown",
  version: "7.0.0",
  role: 2,
  author: "ᴶᴼᴴᴺ ᵀᴿᴬᴺ",
  description: "Tự động tải media từ link chia sẻ trong nhóm (hỗ trợ cookie TikTok + API fallback)",
  category: "Tiện ích",
  usage: "autodown on | autodown off | autodown status",
  cooldowns: 5
};

const TEMP_DIR = path.join(__dirname, "temp");
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const LINK_RE = /(https?:\/\/[^\s<>"']+)/i;

const TIKTOK_APIS = [
  "https://www.tikwm.com/api",
  "https://api.tikwm.com/api",
  "https://tikwm.com/api"
];

// Đơn giản: 1 link đang xử lý, dedup 30s
const processing = new Map(); // url => true
const dedup = new Map(); // url => expiry

function cleanupFile(filePath) {
  try { if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch { /* bỏ qua */ }
}

function sanitizeError(msg) {
  return String(msg || "lỗi không xác định").replace(/https?:\/\/\S+/g, "[link]").slice(0, 200);
}

// ----- Cookie TikTok -----
function loadCookies() {
  const raw = (global.config?.media?.tiktok_cookies || process.env.TIKTOK_COOKIES || "").trim();
  if (!raw) return "";
  const out = {};
  for (const part of String(raw).split(";")) {
    const idx = part.indexOf("=");
    if (idx > 0) out[part.slice(0, idx).trim()] = part.slice(idx + 1).trim();
  }
  return Object.entries(out).map(([k, v]) => `${k}=${v}`).join("; ");
}

function apiHeaders(extra = {}) {
  const h = { "User-Agent": UA, "Accept-Language": "vi-VN,vi;q=0.9", ...extra };
  const cookie = loadCookies();
  if (cookie) h.Cookie = cookie;
  return h;
}

function findUrlInString(text) {
  const m = String(text).match(LINK_RE);
  return m ? m[1].replace(/[.,)\]]+$/, "") : null;
}

function extractUrl(content, depth = 0) {
  if (!content || depth > 4) return null;
  if (typeof content === "string") return findUrlInString(content);
  if (typeof content !== "object") return null;
  for (const key of ["href", "url", "link", "src", "value", "thumb"]) {
    const v = content[key];
    if (typeof v === "string") { const f = findUrlInString(v); if (f) return f; }
    else if (v && typeof v === "object") { const f = extractUrl(v, depth + 1); if (f) return f; }
  }
  for (const v of Object.values(content)) {
    if (typeof v === "string") { const f = findUrlInString(v); if (f) return f; }
    else if (v && typeof v === "object") { const f = extractUrl(v, depth + 1); if (f) return f; }
  }
  return null;
}

function detectPlatform(url) {
  if (/tiktok|douyin|vm\.tiktok|vt\.tiktok/.test(url)) return "tiktok";
  if (/youtube|youtu\.be|m\.youtube|music\.youtube/.test(url)) return "youtube";
  if (/facebook|fb\.watch|fb\.com/.test(url)) return "facebook";
  if (/instagram|instagr\.am/.test(url)) return "instagram";
  if (/twitter|x\.com|t\.co/.test(url)) return "twitter";
  if (/vimeo/.test(url)) return "vimeo";
  if (/dailymotion/.test(url)) return "dailymotion";
  if (/bilibili/.test(url)) return "bilibili";
  if (/reddit/.test(url)) return "reddit";
  return "generic";
}

function extractMetaMedia(html) {
  const $ = cheerio.load(html);
  const meta = (name) => {
    const el = $(`meta[name="${name}"], meta[property="${name}"]`).first();
    return el.attr("content") || "";
  };
  const video = meta("og:video") || meta("og:video:secure_url") || meta("twitter:player") || meta("twitter:image:src") || "";
  const image = meta("og:image") || meta("twitter:image") || "";
  const title = meta("og:title") || $("title").first().text() || "";
  return { video, image, title };
}

async function fetchHtml(url, withCookie = true) {
  const res = await axios.get(url, {
    timeout: 30000,
    headers: apiHeaders(withCookie ? { Cookie: loadCookies() } : {}),
    validateStatus: () => true,
    maxRedirects: 10,
    maxBodyLength: 8 * 1024 * 1024
  });
  return res.data || "";
}

// ----- Fallback API TikTok (tikwm) -----
async function extractViaTikTokApi(url) {
  const errors = [];
  for (const base of TIKTOK_APIS) {
    try {
      const endpoint = `${base}/?url=${encodeURIComponent(url)}&hd=1`;
      const res = await axios.get(endpoint, {
        timeout: 45000,
        headers: apiHeaders(),
        validateStatus: () => true
      });
      const data = res.data?.data;
      if (res.data && (res.data.code === 0 || res.data.code === 200) && data) {
        const videoUrl = data.hdplay || data.play || data.wmplay || data.music;
        if (!videoUrl) throw new Error("Video không có link tải");
        return {
          title: data.title || "TikTok video",
          author: data.author?.nickname || "Không rõ",
          duration: Number(data.duration) || 0,
          videoUrl,
          thumbnail: data.cover || data.origin_cover || "",
          platform: "tiktok",
          type: "video",
          source: "tiktok_api"
        };
      }
      errors.push(`${base}: ${res.data?.msg || "không có dữ liệu"}`);
    } catch (error) {
      errors.push(`${base}: ${error.message}`);
    }
  }
  throw new Error(`TikTok API thất bại (${errors.join(" | ").slice(0, 200)})`);
}

async function extractDirect(url) {
  const platform = detectPlatform(url);
  const html = await fetchHtml(url, true);
  const meta = extractMetaMedia(html);
  if (meta.video || meta.image) {
    return {
      title: meta.title || "Media",
      author: "",
      duration: 0,
      videoUrl: meta.video || "",
      thumbnail: meta.image || "",
      platform,
      type: meta.video ? "video" : "image",
      source: "direct_html"
    };
  }
  // HTML không có video → nếu là TikTok thì thử API fallback
  if (platform === "tiktok") {
    return await extractViaTikTokApi(url);
  }
  throw new Error("Trang không chứa video/ảnh trực tiếp");
}

async function downloadToFile(url, outputPath) {
  const res = await axios.get(url, {
    responseType: "stream",
    timeout: 60000,
    headers: { "User-Agent": UA },
    maxRedirects: 10
  });
  if (!res.data) throw new Error("Tải về rỗng");
  const writer = fs.createWriteStream(outputPath);
  res.data.pipe(writer);
  await new Promise((resolve, reject) => {
    writer.on("finish", resolve);
    writer.on("error", reject);
  });
  if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size === 0) throw new Error("File tải về rỗng");
  return outputPath;
}

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

module.exports.handleEvent = async function ({ api, event, Threads, isSelf }) {
  if (!event.data) return;
  if (event.type !== ThreadType.Group) return;
  if (isSelf === true) return;
  const rawContent = String(event.data.content || "").trim();
  if (global.config.prefix && rawContent.startsWith(global.config.prefix)) return;

  const url = extractUrl(event.data.content);
  if (!url) return;
  if (detectPlatform(url) === "generic") return;

  const { threadId, type } = event;
  const threadData = (await Threads.getData(threadId)).data || {};
  if (!threadData.auto_down) return;

  // Dedup: link vừa xử lý trong 30s → bỏ qua
  const now = Date.now();
  const ex = dedup.get(url);
  if (ex && now < ex) return;
  dedup.set(url, now + 30000);

  // Nếu đang xử lý link này → bỏ qua
  if (processing.get(url)) return;
  processing.set(url, true);

  try {
    await sendReactions(api, threadId, type, event, [Reactions.LIKE]);

    const info = await extractDirect(url);
    const messageBody = "🎦 AUTODOWN\n" +
      `Title: ${info.title}\n` +
      (info.author ? `Author: ${info.author}\n` : "") +
      (info.duration ? `Thời lượng: ${Math.floor(info.duration / 60)}:${String(info.duration % 60).padStart(2, "0")}\n` : "") +
      `Nguồn: ${info.platform} • ${info.source}`;

    const ext = info.type === "audio" ? "mp3" : "mp4";
    const filePath = path.join(TEMP_DIR, `dl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`);

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
    // Chỉ báo lỗi 1 lần, không spam
    await sendReactions(api, threadId, type, event, [Reactions.CRY]);
    return api.sendMessage({
      msg: `❌ Không tải được link này.\n${sanitizeError(error.message)}`,
      plain: true
    }, threadId, type);
  } finally {
    processing.delete(url);
  }
};

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
    return api.sendMessage({
      plain: true,
      msg: `📥 Autodown nhóm này: ${thread.auto_down ? "ĐANG BẬT ✅" : "ĐANG TẮT ❌"}\n` +
        `Dùng: autodown on / autodown off`
    }, threadId, type);
  }

  return api.sendMessage({
    plain: true,
    msg: '🔍 AUTODOWN HELPER v7\n\n' +
      'Tự động tải media từ link chia sẻ trong nhóm.\n\n' +
      '📌 Hỗ trợ: Tiktok, Youtube, Facebook, Instagram, Twitter/X, Vimeo, Dailymotion, Bilibili, Reddit.\n\n' +
      '💡 Cách dùng: Gửi link http/https vào nhóm, bot tự tải (nếu nhóm đã bật autodown on).\n\n' +
      '🔰 Emoji: 👍 xử lý • ❤️ thành công • 😢 lỗi\n' +
      '⚙️ Admin: autodown on / off / status\n' +
      '🛡️ Cơ chế: dedup link 30s • cookie TikTok • API tikwm fallback • chỉ báo lỗi 1 lần'
    }, threadId, type);
};
