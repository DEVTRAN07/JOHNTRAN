const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { processVideo } = require("../../utils/index");
const services = require("../../core/services");

module.exports.config = {
  name: 'girltt',
  aliases: ['gaitt'],
  version: '1.0.0',
  role: 0,
  author: 'ShinTHL09, tnt',
  description: 'Xem video gái ngẫu nhiên trên tiktok',
  category: 'Giải trí',
  usage: 'girltt',
  cooldowns: 2
};

module.exports.run = async ({ event, api }) => {
  const { threadId, type } = event;

  const tempDir = path.join(__dirname, 'temp');
  const filePath = path.join(tempDir, 'gaitiktok.mp4');

  try {
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

    const baseUrl = services.requireService("media_generator_url");
    const data = await axios.get(`${baseUrl}/random`, { timeout: 30000 });
    const { play, author, digg_count, comment_count, play_count, share_count, download_count, title, duration, region } = data.data.data;

    const res = await axios.get(play, {
      responseType: "arraybuffer",
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'video/*,*/*;q=0.8'
      }
    });

    const text =  `┣➤📺 Random gái tiktok\n┣➤🌐 Quốc gia: ${region}\n┣➤📝 Tiêu đề: ${title}\n┣➤🔍 Tên kênh: ${author.nickname}\n┣➤😽 ID người dùng: ${author.unique_id}\n┣➤❤ Lượt tim: ${digg_count}\n┣➤💬 Lượt bình luận: ${comment_count}\n┣➤👁‍🗨 Lượt xem: ${play_count}\n┣➤📎 Lượt share: ${share_count}\n┣➤👉 Lượt tải: ${download_count}\n┣➤⏰ Thời gian: ${duration} s`

    fs.writeFileSync(filePath, res.data);

    const videoData = await processVideo(filePath, threadId, type);

    await api.sendVideo({
      videoUrl: videoData.videoUrl,
      thumbnailUrl: videoData.thumbnailUrl,
      duration: videoData.metadata.duration,
      width: videoData.metadata.width,
      height: videoData.metadata.height,
      msg: text,
      ttl: 60000
    }, threadId, type);
  } catch (err) {
    if (err.notConfigured) {
      return api.sendMessage(`❌ ${err.message}`, threadId, type);
    }
    console.error("Lỗi xử lý video:", err.message);
    await api.sendMessage("❌ Không thể tải video.", threadId, type);
  }
};