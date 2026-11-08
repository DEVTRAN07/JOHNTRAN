const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require("../../core/http");

const girlImages = require('../../assets/girl.json');

module.exports.config = {
  name: 'girl',
  aliases: ['gai'],
  version: '1.0.3',
  role: 0,
  author: 'ShinTHL09',
  description: 'Xem ảnh gái ngẫu nhiên',
  category: 'Giải trí',
  usage: 'girl',
  cooldowns: 2,
  dependencies: {}
};

module.exports.run = async ({ args, event, api, Users }) => {
  const { threadId, type } = event;
  if (!Array.isArray(girlImages) || girlImages.length === 0) {
    return api.sendMessage("❌ Hiện chưa có ảnh để gửi.", threadId, type);
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jt_girl_'));
  const filePath = path.join(tempDir, 'gai.jpg');
  try {
    const link = girlImages[Math.floor(Math.random() * girlImages.length)];
    const { buffer } = await http.getBuffer(link, {
      timeout: 30000,
      retries: 1,
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Referer': 'https://imgur.com/',
        'Accept': 'image/*,*/*;q=0.8'
      }
    });

    if (!buffer?.length) throw new Error("Ảnh tải về rỗng");
    fs.writeFileSync(filePath, buffer);

    await api.sendMessage({ msg: "📷 Ảnh gái ngẫu nhiên", attachments: filePath }, threadId, type);
  } catch (error) {
    console.error("Đã xảy ra lỗi khi tải ảnh gái:", error.message);
    return api.sendMessage("❌ Không thể tải ảnh gái lúc này. Vui lòng thử lại sau.", threadId, type);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
};
