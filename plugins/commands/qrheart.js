const fs = require("fs");
const path = require("path");
const axios = require("axios");
const services = require("../../core/services");

module.exports.config = {
  name: "qrheart",
  aliases: ["qr","qrtrum"],

  version: "2.0.0",
  role: 0,
  author: "ᴶᴼᴴᴺ ᵀᴿᴬᴺ",
  description: "Tạo mã QR trái tim từ văn bản (dùng API do admin cấu hình)",
  category: "Tiện ích",
  usage: "qrheart <nội dung> - <chữ mô tả>",
  cooldowns: 2,
  dependencies: {},
    requires: [
        { key: "services.image_generator_url", label: "Endpoint tạo ảnh (services.image_generator_url)", optional: false }
    ]
};

module.exports.run = async ({ api, event, args }) => {
  const { threadId, type } = event;

  const input = args.join(" ").split("-");
  const text = input[0]?.trim();
  const caption = input[1]?.trim();

  if (!text) {
    return api.sendMessage("❌ Vui lòng nhập nội dung mã QR.\n\nCú pháp: qrheart <nội dung> - <caption>", threadId, type);
  }

  try {
    const baseUrl = services.requireService("image_generator_url");
    const url = `${baseUrl}/image-generator/qrcode-heart?text=${encodeURIComponent(text)}&caption=${encodeURIComponent(caption || "")}`;
    const res = await axios.get(url, { responseType: "arraybuffer", timeout: 30000 });

    const filePath = path.join(__dirname, "temp", `qrcode-heart_${Date.now()}.png`);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, res.data);

    await api.sendMessage({
      msg: "Mã QR trái tim của bạn nè:",
      attachments: filePath
    }, threadId, type);
    fs.unlinkSync(filePath);
  } catch (error) {
    if (error.notConfigured) {
      return api.sendMessage(`❌ ${error.message}`, threadId, type);
    }
    console.error(error);
    api.sendMessage("Đã xảy ra lỗi khi tạo QR code!", threadId, type);
  }
};
