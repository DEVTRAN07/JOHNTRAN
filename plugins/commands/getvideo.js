// /getvideo — tải video từ URL hoặc tin reply rồi gửi vào nhóm
//   /getvideo <url>   (youtube, facebook, tiktok... bất cứ site yt-dlp hỗ trợ)
//   reply tin có link rồi gõ /getvideo
const fs = require("fs");
const path = require("path");
const ytdlp = require("../../core/mediaDownloader");
const { processVideo } = require("../../utils/index");

module.exports.config = {
  name: "getvideo",
  aliases: ["gvd", "gvideo"],
  version: "3.0.0",
  role: 0,
  author: "ᴶᴼᴴᴺ ᵀᴿᴬᴺ",
  description: "Tải video từ link rồi gửi vào nhóm",
  category: "Tiện ích",
  usage: "getvideo <url> hoặc reply tin link",
  cooldowns: 10,
  dependencies: {}
};

module.exports.run = async function ({ api, event, args }) {
  const { threadId, type } = event;

  const url = args[0] || null;
  if (!url) {
    return api.sendMessage({
      plain: true,
      msg: `Cách dùng: ${global.config.prefix}getvideo <url>\n` +
           `Ví dụ: ${global.config.prefix}getvideo https://www.youtube.com/watch?v=...\n` +
           `Hoặc reply tin chứa link rồi gõ ${global.config.prefix}getvideo`
    }, threadId, type);
  }
  if (!/^https?:\/\//i.test(url)) {
    return api.sendMessage({ plain: true, msg: "❌ URL không hợp lệ." }, threadId, type);
  }

  const canUse = await ytdlp.ytDlpAvailable();
  if (!canUse) {
    return api.sendMessage({ plain: true, msg: "❌ Bot chưa cài yt-dlp nên không tải được video." }, threadId, type);
  }

  const tempDir = path.join(__dirname, "temp");
  fs.mkdirSync(tempDir, { recursive: true });
  const filePath = path.join(tempDir, `gvd_${Date.now()}.mp4`);

  try {
    await api.sendMessage({ msg: "⏳ Đang tải video...", plain: true }, threadId, type);
    const info = await ytdlp.getMediaInfo(url);
    if (!info) return api.sendMessage({ plain: true, msg: "❌ Không đọc được thông tin video." }, threadId, type);

    // Chỉ có tiếng → không phải video
    if (ytdlp.isAudioOnly(info)) {
      return api.sendMessage({ plain: true, msg: "❌ Link này chỉ có audio, không có video. Dùng /getvoice." }, threadId, type);
    }

    await ytdlp.downloadVideo(url, filePath);
    if (!fs.existsSync(filePath)) return api.sendMessage({ plain: true, msg: "❌ Tải video thất bại." }, threadId, type);

    const videoData = await processVideo(filePath, threadId, type, api);
    await api.sendVideo({
      msg: "🎬 GETVIDEO",
      videoUrl: videoData.videoUrl,
      thumbnailUrl: videoData.thumbnailUrl,
      duration: videoData.metadata.duration,
      width: videoData.metadata.width,
      height: videoData.metadata.height
    }, threadId, type);
  } catch (error) {
    console.error("getvideo:", error.message);
    return api.sendMessage({ plain: true, msg: `❌ Tải video thất bại: ${error.message}` }, threadId, type);
  } finally {
    // Xoá file gốc (processVideo tự xoá khi thành công)
    if (fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch { /* bỏ qua */ }
    }
  }
};
