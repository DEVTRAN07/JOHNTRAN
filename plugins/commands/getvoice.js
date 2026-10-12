// /getvoice — tải audio từ URL rồi gửi dạng voice vào nhóm
//   /getvoice <url>   (youtube, soundcloud, mp3 link...)
const fs = require("fs");
const path = require("path");
const ytdlp = require("../../core/mediaDownloader");
const { processAudio } = require("../../utils/index");

module.exports.config = {
  name: "getvoice",
  aliases: ["gvo", "gvoice", "gvoice"],
  version: "3.0.0",
  role: 0,
  author: "ᴶᴼᴴᴺ ᵀᴿᴬᴺ",
  description: "Tải audio từ link rồi gửi voice",
  category: "Tiện ích",
  usage: "getvoice <url>",
  cooldowns: 10,
  dependencies: {}
};

module.exports.run = async function ({ api, event, args }) {
  const { threadId, type } = event;

  const url = args[0] || null;
  if (!url) {
    return api.sendMessage({
      plain: true,
      msg: `Cách dùng: ${global.config.prefix}getvoice <url>\n` +
           `Ví dụ: ${global.config.prefix}getvoice https://www.youtube.com/watch?v=...`
    }, threadId, type);
  }
  if (!/^https?:\/\//i.test(url)) {
    return api.sendMessage({ plain: true, msg: "❌ URL không hợp lệ." }, threadId, type);
  }

  if (!await ytdlp.ytDlpAvailable()) {
    return api.sendMessage({ plain: true, msg: "❌ Bot chưa cài yt-dlp nên không tải được audio." }, threadId, type);
  }

  const tempDir = path.join(__dirname, "temp");
  fs.mkdirSync(tempDir, { recursive: true });
  const mp3Path = path.join(tempDir, `gvo_${Date.now()}.mp3`);

  try {
    await api.sendMessage({ msg: "⏳ Đang tải audio...", plain: true }, threadId, type);

    const info = await ytdlp.getMediaInfo(url).catch(() => null);
    await ytdlp.downloadAudio(url, mp3Path);
    if (!fs.existsSync(mp3Path)) {
      return api.sendMessage({ plain: true, msg: "❌ Tải audio thất bại." }, threadId, type);
    }

    const voiceUrl = await processAudio(mp3Path, threadId, type, api);
    const title = info?.title ? String(info.title).slice(0, 60) : "audio";
    await api.sendMessage({ msg: `🎵 GETVOICE — ${title}`, plain: true }, threadId, type);
    await api.sendVoice({ voiceUrl }, threadId, type);
  } catch (error) {
    console.error("getvoice:", error.message);
    return api.sendMessage({ plain: true, msg: `❌ Tải audio thất bại: ${error.message}` }, threadId, type);
  } finally {
    if (fs.existsSync(mp3Path)) {
      try { fs.unlinkSync(mp3Path); } catch { /* bỏ qua */ }
    }
  }
};
