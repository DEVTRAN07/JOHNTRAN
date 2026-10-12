// ===== THU HỒI TIN NHẮN CỦA BOT =====
// Zalo cho thu hồi tin của CHÍNH BOT qua api.undo (deleteMessage thì bắt buộc
// onlyMe — chỉ xoá phía mình). Cả hai API đều cần ĐỦ 2 id:
//   • msgId      — Zalo server trả về trong response sendMessage
//   • cliMsgId   — id client; response chính thức chỉ khai báo { msgId }
//
// Vì vendor không bật được selfListen (hardcode false trong core/context.js)
// nên không thể bắt id từ websocket. Cách DUY NHẤT còn lại là đọc response.
// Nếu response không trả cliMsgId thì KHÔNG THỂ thu hồi — module sẽ log rõ để
// biết, chứ không đoán mò.
const logger = require("../utils/logger");

const memory = new Map(); // `${threadId}|${key}` → { msgId, cliMsgId, sentAt }

const slot = (threadId, key) => `${threadId}|${key}`;

// Quét MỌI nhánh của response để lấy msgId + cliMsgId (response có 2 nhánh:
// message — tin text; attachment — ảnh/video/voice).
function extractIds(response) {
  if (!response || typeof response !== "object") return null;
  const branches = [];
  if (Array.isArray(response.message)) branches.push(...response.message);
  else if (response.message) branches.push(response.message);
  if (Array.isArray(response.attachment)) branches.push(...response.attachment);
  else if (response.attachment) branches.push(response.attachment);
  branches.push(response); // có thể server trả phẳng

  for (const item of branches) {
    if (!item || typeof item !== "object") continue;
    const msgId = item.msgId ?? item.messageId ?? item.globalMsgId ?? item.msgId2;
    const cliMsgId = item.cliMsgId ?? item.clientMsgId ?? item.clientId ?? item.cliMsgId2;
    if (msgId && cliMsgId) return { msgId: String(msgId), cliMsgId: String(cliMsgId) };
    if (msgId && !cliMsgId) {
      // Có nửa id → log để biết chính xác field thiếu
      logger.log(`[recall] Response có msgId=${msgId} nhưng KHÔNG có cliMsgId → không thu hồi được. Field: ${Object.keys(item).join(", ")}`, "warn");
      return null;
    }
  }
  return null;
}

function remember(threadId, key, response) {
  if (!key || !threadId) return;
  const ids = extractIds(response);
  if (ids) {
    memory.set(slot(threadId, key), { ...ids, sentAt: Date.now() });
    logger.log(`[recall] Đã nhớ tin ${ids.msgId} (khung "${key}")`, "verbose");
  }
}

// Thu hồi tin đã nhớ. Trả về: true | "no-id" | "no-message" | "failed"
async function recall(api, threadId, key, type = 1) {
  if (!key || !threadId) return "no-message";
  const ids = memory.get(slot(threadId, key));
  if (!ids) return "no-message";
  memory.delete(slot(threadId, key));
  if (!api) return "failed";

  // Cách 1: undo (thu hồi cho MỌI người trong nhóm)
  if (typeof api.undo === "function") {
    try {
      await api.undo({ msgId: ids.msgId, cliMsgId: ids.cliMsgId }, threadId, type);
      logger.log(`[recall] Đã thu hồi tin ${ids.msgId} (khung "${key}")`, "info");
      return true;
    } catch (error) {
      logger.log(`[recall] undo thất bại (${error.message}) → thử deleteMessage onlyMe`, "warn");
    }
  }

  // Cách 2: deleteMessage onlyMe (chỉ xoá phía bot — ít nhất bot sạch mắt)
  if (typeof api.deleteMessage === "function") {
    try {
      await api.deleteMessage({
        data: { cliMsgId: Number(ids.cliMsgId) || ids.cliMsgId, msgId: Number(ids.msgId) || ids.msgId, uidFrom: "" },
        threadId,
        type
      }, true);
      return true;
    } catch (error) {
      logger.log(`[recall] deleteMessage onlyMe cũng thất bại: ${error.message}`, "error");
    }
  }
  return "failed";
}

function forget(threadId, key) {
  memory.delete(slot(threadId, key));
}

module.exports = { remember, recall, forget, extractIds, memorySize: () => memory.size };
