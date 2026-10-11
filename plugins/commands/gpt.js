const gemini = require("../../core/ai/gemini");
const metrics = require("../../core/metrics");

module.exports.config = {
  name: "gpt",
  aliases: ["ai", "gem"],
  version: "3.0.0",
  role: 0,
  author: "ᴶᴼᴴᴺ ᵀᴿᴬᴺ",
  description: "Hỏi đáp AI (nhớ ngữ cảnh hội thoại)",
  category: "AI",
  usage: "gpt <text>",
  cooldowns: 3,
  dependencies: {},
    requires: [
        { key: "ai.gemini_keys", label: "Key Gemini (ai.gemini_keys)", optional: false }
    ]
};

module.exports.run = async ({ args, event, api, reply }) => {
  const { threadId, type, data } = event;

  if (!args[0]) {
    return reply.card({
      theme: "ai",
      title: "Trò chuyện AI",
      subtitle: "Bot nhớ ngữ cảnh hội thoại gần nhất với bạn",
      rows: [{
        icon: "robot",
        label: "Cách dùng",
        lines: [
          `${global.config.prefix}gpt <câu hỏi> — hỏi AI`,
          `${global.config.prefix}gpt reset — xoá lịch sử hội thoại`,
          `${global.config.prefix}noi <văn bản> — bot đọc thành giọng nói`
        ]
      }],
      footer: "Chỉ câu hỏi của bạn được gửi tới Gemini của admin — không có dữ liệu cá nhân nào khác."
    });
  }

  if (args[0].toLowerCase() === "reset" || args[0].toLowerCase() === "xoa") {
    gemini.clearHistory(data.uidFrom);
    return reply.success("Đã xoá lịch sử hội thoại AI của bạn.");
  }

  await reply.working();
  try {
    const text = await gemini.generate(args.join(" "), { userId: data.uidFrom });
    metrics.track("aiRequest", { command: "gpt" });
    await reply.card({
      theme: "ai",
      title: args.join(" ").slice(0, 60),
      subtitle: text,
      rows: [{ icon: "robot", label: "AI", lines: [text] }],
      footer: "ᴶᴼᴴᴺ ᵀᴿᴬᴺ • AI"
    });
    await reply.done();
  } catch (error) {
    await reply.failed();
    if (error.privacyBlocked) {
      return reply.error("Bot bị chặn gọi API AI bởi chính sách bảo mật nội bộ.");
    }
    return reply.error(error.message);
  }
};
