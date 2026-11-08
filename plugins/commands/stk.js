// /stk — TẠO STICKER THẬT từ nội dung reply (ảnh/GIF/video/sticker) hoặc URL
const { createAndSend, pickMediaUrl } = require("../../core/stickerCreate");
const { parseQuote } = require("../../core/mediaReply");
const { frameList } = require("../../core/stickerFrames");

const FRAMES = frameList();
const frameOptions = () => FRAMES.map(({ id, name }) => `${id}. ${name}`).join("\n");

module.exports.config = {
  name: "stk",
  aliases: ["sticker", "stkvd", "stkvideo"],
  version: "7.0.2",
  role: 0,
  author: "ᴶᴼᴴᴺ ᵀᴿᴬᴺ",
  description: "Tạo sticker với nhiều mẫu khung",
  category: "Tiện ích",
  usage: "stk [số khung] (reply ảnh/gif/video/sticker) | stk [số khung] <link media>",
  cooldowns: 5,
  dependencies: {}
};

const GUIDE =
  "❌ Reply ảnh/GIF/video/sticker rồi gõ /stk [số khung]\n" +
  "hoặc: /stk [số khung] <link ảnh/GIF/video>\n" +
  "Danh sách khung:\n" + frameOptions();

function parseFrameSelection(args) {
  const commandArgs = Array.isArray(args) ? [...args] : [];
  if (!/^\d+$/.test(String(commandArgs[0] ?? ""))) {
    return { frameId: 1, args: commandArgs };
  }

  const frameId = Number(commandArgs.shift());
  if (!FRAMES.some((frame) => frame.id === frameId)) {
    return { frameId, args: commandArgs, invalid: true };
  }
  return { frameId, args: commandArgs };
}

function isValidMediaUrl(url) {
  return /^https?:\/\/\S+$/i.test(String(url || ""));
}

function errDetail(error) {
  return [error?.code != null ? "code=" + error.code : "", error?.message || String(error)]
    .filter(Boolean).join(" ");
}

async function safeSend(api, payload, threadId, type) {
  try {
    return await api.sendMessage(payload, threadId, type);
  } catch (e) {
    console.error("[stk] sendMessage failed:", e?.message || e);
    return null;
  }
}

module.exports.run = async function ({ api, event, args }) {
  const threadId = event?.threadId;
  const type = event?.type;
  const data = event?.data || {};

  try {
    const selection = parseFrameSelection(args);
    if (selection.invalid) {
      return safeSend(
        api,
        { plain: true, msg: `❌ Số khung không hợp lệ. Chọn từ 1 đến ${FRAMES.length}:\n${frameOptions()}`, ttl: 60000 },
        threadId,
        type
      );
    }

    const urlArg = selection.args.find((a) => isValidMediaUrl(a));
    if (!urlArg && !data?.quote) {
      return safeSend(api, { plain: true, msg: GUIDE }, threadId, type);
    }

    const media = parseQuote(event);
    if (!urlArg && !pickMediaUrl(media)) {
      return safeSend(api, { plain: true, msg: "❌ Tin reply không có ảnh/video/GIF để tạo sticker.", ttl: 60000 }, threadId, type);
    }

    await safeSend(api, { msg: "⏳ Đang tạo sticker...", plain: true, ttl: 60000 }, threadId, type);

    const variant = (urlArg || (media && (media.video || media.webpUrl))) ? "std" : "ai";
    try {
      await createAndSend({
        api,
        event,
        variant,
        sourceUrl: urlArg,
        frameId: selection.frameId
      });
    } catch (error) {
      const detail = errDetail(error);
      console.error("[stk] createAndSend failed:", detail || error);
      if (error?.stack) console.error(error.stack);
      const msg = error?.userMessage || ("❌ Tạo sticker thất bại: " + (detail || "lỗi không xác định"));
      return safeSend(api, { plain: true, msg, ttl: 60000 }, threadId, type);
    }
  } catch (error) {
    const detail = errDetail(error);
    console.error("[stk] unexpected:", detail || error);
    if (error?.stack) console.error(error.stack);
    const stackHint = (error?.stack || "").split("\n").slice(0, 3).join(" | ").slice(0, 200);
    const hint = stackHint ? " (trace: " + stackHint + ")" : "";
    return safeSend(api, { plain: true, msg: "❌ Lệnh /stk gặp lỗi: " + (detail || "lỗi không xác định") + hint, ttl: 60000 }, threadId, type);
  }
};

module.exports.parseFrameSelection = parseFrameSelection;
