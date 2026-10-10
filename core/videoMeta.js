// Đọc metadata video bằng chính binary ffmpeg (ffmpeg-static) — thay cho ffprobe-static/get-video-info
// (ffprobe-static 1.1.0 chỉ hỗ trợ darwin/linux x64, trên Apple Silicon nó tự process.exit(1)).
const { execFile } = require("child_process");
const ffmpegPath = require("ffmpeg-static");

function probeVideo(filePath) {
  return new Promise((resolve, reject) => {
    execFile(
      ffmpegPath,
      ["-i", filePath],
      { maxBuffer: 16 * 1024 * 1024 },
      (error, stdout, stderr) => {
        // ffmpeg -i không chỉ định output → exit code khác 0 là bình thường, metadata nằm ở stderr
        const output = `${stderr || ""}\n${stdout || ""}`;
        const durationMatch = output.match(/Duration:\s*(\d+):(\d{2}):(\d{2}(?:\.\d+)?)/);
        // lấy stream video ĐẦU TIÊN (bỏ qua attached_pic/ảnh bìa chỉ có MJPEG)
        const streamMatch = output.match(/Stream #\d+:\d+(?:\[[^\]]*\])?(?:\[[^\]]*\])*:[^\n]*Video:\s*[^\n,]+[^\n]*?\b(\d{2,6})x(\d{2,6})\b/);
        const anyVideoMatch = output.match(/Video:\s*[^\n]*?\b(\d{2,6})x(\d{2,6})\b/);

        if (!durationMatch && !streamMatch && !anyVideoMatch) {
          return reject(new Error("Không đọc được metadata video (ffmpeg không trả thông tin)"));
        }

        const seconds = durationMatch
          ? parseInt(durationMatch[1], 10) * 3600 + parseInt(durationMatch[2], 10) * 60 + parseFloat(durationMatch[3])
          : 0;
        const sizeMatch = streamMatch || anyVideoMatch;

        resolve({
          duration: seconds,
          width: sizeMatch ? parseInt(sizeMatch[1], 10) : 0,
          height: sizeMatch ? parseInt(sizeMatch[2], 10) : 0,
          format: { duration: String(seconds) }
        });
      }
    );
  });
}

module.exports = { probeVideo };
