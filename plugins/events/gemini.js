const axios = require("axios");
const fs = require("fs");
const path = require("path");
const gemini = require("../../core/ai/gemini");

const EVENT_COMMAND = "gemini";

function reply(api, threadId, type, message) {
  return api.sendMessage({ msg: message, ttl: 300000 }, threadId, type).catch((error) => {
    if (error?.code === 161) {
      console.error("Nhóm không tồn tại hoặc bot không có quyền truy cập.");
    } else {
      console.error("Lỗi gửi tin nhắn:", error?.message || error);
    }
  });
}

module.exports.config = {
  event_type: ["message"],
  name: "gemini",
  version: "2.0.0",
  author: "ᴶᴼᴴᴺ ᵀᴿᴬᴺ",
  description: "Trò chuyện với AI (Gemini)",
  dependencies: {}
};

module.exports.run = async function ({ api, event, isSelf }) {
  const { threadId, data, type } = event;
  if (!data) return;

  // Không xử lý tin do chính bot gửi (tránh loop auto-reply)
  if (isSelf) return;

  // Xử lý tin nhắn dạng text
  if (typeof data.content === "string" && data.content.trim().toLowerCase().startsWith(EVENT_COMMAND)) {
    const prompt = data.content.slice(EVENT_COMMAND.length).trim();
    if (!prompt) return;
    try {
      const text = await gemini.generate(prompt);
      if (text) await reply(api, threadId, type, `🤖 ${text}`);
    } catch (error) {
      if (!error.notConfigured) console.error("Lỗi Gemini text:", error.message);
      await reply(api, threadId, type, `❌ ${error.message}`);
    }
    return;
  }

  // Xử lý tin nhắn kèm ảnh
  const title = typeof data.content?.title === "string" ? data.content.title : "";
  if (title.trim().toLowerCase().startsWith(EVENT_COMMAND)) {
    const imageUrl = data.content?.href || data.content?.thumb;
    if (!imageUrl) return;

    const prompt = title.slice(EVENT_COMMAND.length).trim() || "Mô tả ảnh này";
    const tempDir = path.join(__dirname, "temp");
    const imagePath = path.join(tempDir, `image_${threadId}_${Date.now()}.jpg`);

    try {
      await fs.promises.mkdir(tempDir, { recursive: true });
      const response = await axios.get(imageUrl, { responseType: "arraybuffer", timeout: 30000 });
      await fs.promises.writeFile(imagePath, response.data);

      const text = await gemini.generate(prompt, { imageBuffer: response.data, mimeType: "image/jpeg" });
      await reply(api, threadId, type, `🖼️ ${text}`);
    } catch (error) {
      if (!error.notConfigured) console.error("Lỗi Gemini ảnh:", error.message);
      await reply(api, threadId, type, `❌ ${error.message}`);
    } finally {
      await fs.promises.unlink(imagePath).catch(() => {});
    }
  }
};
