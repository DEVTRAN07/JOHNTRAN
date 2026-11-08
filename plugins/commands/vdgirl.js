const fs = require('fs');
const os = require('os');
const path = require('path');
const { processVideo } = require("../../utils/index");
const http = require("../../core/http");

let vdgirl = [];
try { vdgirl = require('../../assets/vdgirl.json'); } catch { vdgirl = []; }

module.exports.config = {
  name: 'vdgirl',
  aliases: ['vdgai'],
  version: '1.0.3',
  role: 0,
  author: 'ShinTHL09',
  description: 'Xem video gái ngẫu nhiên',
  category: 'Giải trí',
  usage: 'vdgirl',
  cooldowns: 2
};

module.exports.run = async ({ args, event, api, Users }) => {
  const { threadId, type } = event;
  if (vdgirl.length === 0) {
    return api.sendMessage("❌ Chưa có nguồn video.", threadId, type);
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jt_vdgirl_'));
  const filePath = path.join(tempDir, 'gai.mp4');
  try {
    const start = Math.floor(Math.random() * vdgirl.length);
    let lastError;
    for (let attempt = 0; attempt < Math.min(3, vdgirl.length); attempt++) {
      const link = vdgirl[(start + attempt) % vdgirl.length];
      try {
        const { buffer } = await http.getBuffer(link, {
          timeout: 60000,
          retries: 1,
          headers: {
            'User-Agent': 'Mozilla/5.0',
            'Referer': 'https://files.catbox.moe/',
            'Accept': 'video/*,*/*;q=0.8'
          }
        });
        if (!buffer?.length) throw new Error("Nguồn trả về video rỗng");
        fs.writeFileSync(filePath, buffer);
        lastError = null;
        break;
      } catch (error) {
        lastError = error;
      }
    }
    if (lastError) throw lastError;

    const videoData = await processVideo(filePath, threadId, type, api);
    await api.sendVideo({
      videoUrl: videoData.videoUrl,
      thumbnailUrl: videoData.thumbnailUrl,
      duration: videoData.metadata.duration,
      width: videoData.metadata.width,
      height: videoData.metadata.height,
      msg: "🎥 Video gái ngẫu nhiên"
    }, threadId, type);
  } catch (err) {
    console.error("Lỗi xử lý video:", err?.message || err);
    await api.sendMessage(`❌ Không thể tải video: ${String(err?.message || err).slice(0, 180)}`, threadId, type);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
};
