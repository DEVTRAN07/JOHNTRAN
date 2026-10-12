// /recall — thử thu hồi tin nhắn của bot (dùng để kiểm chứng Zalo có cho thu hồi)
//   /recall test           → gửi 1 tin thử, thu hồi ngay
//   /recall test <giây>    → gửi tin thử, chờ N giây rồi thu hồi
//   /recall status         → xem bao nhiêu tin đang được nhớ để thu hồi
const { ThreadType } = require("zalo-client");

module.exports.config = {
  name: "recall",
  aliases: ["thuhoi", "undo"],
  version: "1.0.0",
  role: 2,
  author: "ᴶᴼᴴᴺ ᵀᴿᴬᴺ",
  description: "Thử thu hồi tin nhắn của bot (kiểm chứng Zalo)",
  category: "Hệ thống",
  usage: "recall test [giây] | status | log",
  cooldowns: 3,
  dependencies: {}
};

module.exports.run = async function ({ api, event, args, Threads, reply }) {
  const { threadId, type } = event;
  const sub = (args[0] || "").toLowerCase();

  // In log debug thu hồi ra chat (để bạn copy gửi khi cần chẩn đoán)
  if (sub === "log" || sub === "debug") {
    const fs = require("fs");
    const logPath = require("path").join(__dirname, "..", "..", "data", "recall_debug.log");
    if (!fs.existsSync(logPath)) {
      return reply.info("Chưa có log nào. Hãy gõ /recall test trước đã.", { title: "📄 LOG THU HỒI" });
    }
    const lines = fs.readFileSync(logPath, "utf8").trim().split("\n").slice(-8);
    return reply.info(lines.join("\n") || "(rỗng)", { title: `📄 LOG THU HỒI (${lines.length} dòng cuối)` });
  }

  if (sub === "status" || sub === "stt" || sub === "info") {
    const recall = require("../../core/recall");
    const hasUndo = typeof api.undo === "function";
    const hasDelete = typeof api.deleteMessage === "function";
    return reply.info(
      `api.undo: ${hasUndo ? "có ✅" : "KHÔNG ❌"}\napi.deleteMessage: ${hasDelete ? "có ✅" : "KHÔNG ❌"}`,
      {
        title: "🔍 THU HỒI TIN",
        rows: [{ label: "Khả năng", lines: [`Tin đang nhớ: ${recall.memorySize()}`, `api.undo: ${hasUndo ? "sẵn sàng" : "không có"}`, `api.deleteMessage: ${hasDelete ? "sẵn sàng" : "không có"}`] }]
      }
    );
  }

  if (sub === "test" || sub < "a" || !sub) {
    const recall = require("../../core/recall");
    const waitSec = Math.min(Math.max(Number(args[1]) || 2, 0), 60);

    if (!sub && args.length > 0) {
      return reply.error(`Dùng: ${global.config.prefix}recall test [giây] hoặc status`);
    }

    // Gửi tin thử và nhớ id để thu hồi
    const response = await api.sendMessage({
      msg: "🧪 Tin thử thu hồi — sẽ bị thu hồi lại ngay!",
      replace: "recall_test" // nhớ id của tin này
    }, threadId, type);

    const remembered = recall.memorySize() > 0;
    if (!remembered) {
      // Không lấy đủ id → báo rõ (xem log để biết field thiếu)
      return reply.error(
        "❌ Không thu hồi được: Zalo không trả về đủ id (msgId + cliMsgId).\n" +
        "Xem log bot dòng [recall] để biết chính xác field còn thiếu."
      );
    }

    await new Promise((r) => setTimeout(r, waitSec * 1000));
    const result = await recall.recall(api, threadId, "recall_test", type);

    if (result === true) return reply.success("✅ Đã thu hồi tin thử thành công!");
    if (result === "no-message") return reply.error("Không còn tin nào để thu hồi (đã thu hồi trước đó).");
    return reply.error(`Thu hồi thất bại (${result}). Xem log [recall] để biết lý do.`);
  }

  return reply.error(`Dùng: ${global.config.prefix}recall test | status`);
};
