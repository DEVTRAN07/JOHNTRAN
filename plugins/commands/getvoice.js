// /getvoice — Trích xuất audio từ video (reply) rồi gửi voice lên Zalo
//   reply video → tải → ffmpeg trích AAC → gửi voice
const fs = require("fs");
const path = require("path");
const os = require("os");
const { parseQuote, hint } = require("../../core/mediaReply");

module.exports.config = {
  name: "getvoice",
  aliases: ["gvo", "voice"],
  version: "4.1.0",
  role: 0,
  author: "ᴶᴼᴴᴺ ᵀᴿᴬᴺ",
  description: "Trích xuất audio từ video reply và gửi voice",
  category: "Tiện ích",
  usage: "getvoice (reply video)",
  cooldowns: 10,
  dependencies: {}
};

module.exports.run = async function ({ api, event }) {
  const { threadId, type } = event;

  // Chấp nhận cả sticker động/GIF (cũng là "video")
  const media = parseQuote(event);
  if (!media) return api.sendMessage({ plain: true, msg: "❌ Hãy reply tin video cần trích audio." }, threadId, type);

  const videoUrl = media.video || media.file;
  if (!videoUrl) return api.sendMessage({ plain: true, msg: hint("video") }, threadId, type);

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "jt_gvo_"));
  const videoPath = path.join(tmpDir, "in.mp4");
  const mp3Path = path.join(tmpDir, "out.mp3");

  try {
    await api.sendMessage({ msg: "⏳ Đang trích audio...", plain: true }, threadId, type);

    // 1) Tải video về
    const http = require("../../core/http");
    const { buffer } = await http.getBuffer(videoUrl, { timeout: 120000 });
    fs.writeFileSync(videoPath, buffer);

    // 2) Kiểm tra có tiếng không (ffmpeg -i in stream ra stderr)
    const { execFile } = require("child_process");
    const ffmpegBin = require("ffmpeg-static");
    const info = await new Promise((resolve) => {
      execFile(ffmpegBin, ["-i", videoPath], { maxBuffer: 16 * 1024 * 1024 }, (error, stdout, stderr) => {
        resolve(`${stderr || ""}\n${stdout || ""}`);
      });
    });
    if (!/Stream #\d+:\d+[^\n]*Audio:|#\d+:\d+.*Audio:/.test(info)) {
      return api.sendMessage({ plain: true, msg: "❌ Video này không có tiếng nên không trích được audio." }, threadId, type);
    }

    // 3) Trích MP3, rồi processAudio chuyển sang AAC (chuẩn voice Zalo)
    //    Gọi thẳng binary thay vì fluent-ffmpeg: ít phép thuật, lỗi rõ ràng.
    const mp3Size = await new Promise((resolve, reject) => {
      execFile(
        ffmpegBin,
        ["-y", "-i", videoPath, "-vn", "-acodec", "libmp3lame", "-b:a", "128k", mp3Path],
        { maxBuffer: 64 * 1024 * 1024 },
        (error) => {
          if (error) {
            reject(new Error((error.message || "").split("\n").slice(-2).join(" ") || "ffmpeg lỗi"));
            return;
          }
          resolve(fs.existsSync(mp3Path) ? fs.statSync(mp3Path).size : 0);
        }
      );
    });
    if (!mp3Size) throw new Error("Không trích được audio (file ra rỗng)");

    // 4) Upload rồi gửi voice
    const { processAudio } = require("../../utils/index");
    const voiceUrl = await processAudio(mp3Path, threadId, type, api);
    await api.sendVoice({ voiceUrl }, threadId, type);
  } catch (error) {
    console.error("getvoice:", error.message);
    return api.sendMessage({ plain: true, msg: `❌ Trích audio thất bại: ${error.message}` }, threadId, type);
  } finally {
    for (const f of [videoPath, mp3Path]) {
      try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch { /* bỏ qua */ }
    }
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* bỏ qua */ }
  }
};
