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
      return api.sendMessage({ plain: true, msg: "📄 Chưa có log thu hồi nào. Hãy gõ /recall test trước đã." }, threadId, type);
    }
    const lines = fs.readFileSync(logPath, "utf8").trim().split("\n").slice(-8);
    // Gửi TEXT THUẦN để copy được (ảnh thẻ không coppy nội dung)
    return api.sendMessage({
      plain: true,
      msg: `📄 LOG THU HỒI (${lines.length} dòng cuối)\n${"═".repeat(20)}\n${lines.join("\n") || "(rỗng)"}`
    }, threadId, type);
  }

  if (sub === "status" || sub === "stt" || sub === "info") {
    const recall = require("../../core/recall");
    const hasUndo = typeof api.undo === "function";
    const hasDelete = typeof api.deleteMessage === "function";
    // Kiểm tra file vendor TRÊN MÁY ĐANG CHẠY có được patch chưa
    let vendorState = "không đọc được";
    try {
      const fs = require("fs");
      const path = require("path");
      // package.json của zalo-client có "exports" nên require.resolve subpath bị chặn
      // → đọc trực tiếp file vendor ĐANG CHẠY (node_modules trước, rồi vendor/)
      // require("zalo-client") nạp dist/cjs (package.json exports.require)
      // → kiểm tra file .cjs TRƯỚC, rồi tới .js
      const candidates = [
        path.join(process.cwd(), "node_modules", "zalo-client", "dist", "cjs", "api", "sendMessage.cjs"),
        path.join(process.cwd(), "vendor", "zalo-client", "dist", "cjs", "api", "sendMessage.cjs"),
        path.join(__dirname, "..", "..", "vendor", "zalo-client", "dist", "cjs", "api", "sendMessage.cjs"),
        path.join(process.cwd(), "node_modules", "zalo-client", "dist", "api", "sendMessage.js"),
        path.join(process.cwd(), "vendor", "zalo-client", "dist", "api", "sendMessage.js")
      ];
      const vendorFile = candidates.find((f) => fs.existsSync(f));
      if (vendorFile) {
        const vendorSrc = fs.readFileSync(vendorFile, "utf8");
        const logOk = vendorSrc.includes("vendor-send");
        const ganOk = /result\.cliMsgId\s*=/.test(vendorSrc);
        const truyenOk = vendorSrc.split("send(handledData, clientId)").length - 1 >= 2;
        const isCjs = vendorFile.endsWith(".cjs");
        vendorState = `${logOk && ganOk && truyenOk ? "đã patch ✅" : "CHƯA patch ❌"} (file:${isCjs ? "cjs" : "js"} log:${logOk ? "có" : "thiếu"} gắn-id:${ganOk ? "có" : "thiếu"} truyền-clientId:${truyenOk ? "đủ" : "thiếu"})`;
      }
    } catch { /* bỏ qua */ }
    // Cho biết bot đang chạy bản code nào (tránh kiểm tra nhầm bản cũ)
    let build = "không đọc được";
    try {
      const bf = require("path").join(__dirname, "..", "..", "BUILD.txt");
      if (fs.existsSync(bf)) build = fs.readFileSync(bf, "utf8").trim();
    } catch { /* bỏ qua */ }
    return api.sendMessage({
      plain: true,
      msg: `🔍 THU HỒI TIN\n• Build: ${build}\n• api.undo: ${hasUndo ? "sẵn sàng ✅" : "KHÔNG CÓ ❌"}\n• api.deleteMessage: ${hasDelete ? "sẵn sàng ✅" : "KHÔNG CÓ ❌"}\n• Tin đang nhớ: ${recall.memorySize()}\n• vendor: ${vendorState}`
    }, threadId, type);
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

    if (!recall.memorySize()) {
      // Không lấy được cả msgId → không làm gì được
      return reply.error(
        "❌ Không thu hồi được: Zalo không trả về id tin nhắn.\n" +
        "Gõ /recall log rồi gửi nội dung cho admin để kiểm tra."
      );
    }

    await new Promise((r) => setTimeout(r, waitSec * 1000));
    const result = await recall.recall(api, threadId, "recall_test", type);

    if (result === true) return reply.success("✅ Đã thu hồi tin thử thành công!");
    if (result === "no-message") return reply.error("Không còn tin nào để thu hồi (đã thu hồi trước đó).");
    if (result === "no-id") return reply.error(
      "❌ Không tra được cliMsgId trong lịch sử nhóm.\n" +
      "Có thể bot chưa vào nhóm đủ lâu hoặc API bị chặn — gõ /recall log để xem."
    );
    return reply.error(`Thu hồi thất bại (${result}). Gõ /recall log để xem lý do.`);
  }

  return reply.error(`Dùng: ${global.config.prefix}recall test | status`);
};
