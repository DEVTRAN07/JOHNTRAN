// ===== THU HỒI TIN NHẮN CỦA BOT (xoá tin cũ trước khi gửi tin mới) =====
// Dùng cho: menu phân trang (next/prev/số/out xoá trang cũ), kết quả nhạc
// (chọn bài xong thì xoá lưới kết quả ngay).
//
// Nguyên tắc:
//   - mỗi "khung" (key) chỉ nhớ 1 tin gần nhất của bot trong nhóm
//   - gửi tin có replace: "<key>" → thu hồi tin cũ của key đó rồi gửi tin mới
//   - api.undo là API thu hồi tin của CHÍNH BOT (deleteMessage không cho phép)
const logger = require("../utils/logger");

const memory = new Map(); // `${threadId}|${key}` → { msgId, cliMsgId }

function slotOf(threadId, key) {
  return `${threadId}|${key}`;
}

// Bắt msgId/cliMsgId từ mọi shape response có thể (message/attachment/mảng...)
function extractIds(response) {
  if (!response) return null;
  const flat = [];
  const walk = (value, depth) => {
    if (!value || depth > 2) return;
    if (Array.isArray(value)) {
      value.forEach((item) => walk(item, depth + 1));
      return;
    }
    if (typeof value !== "object") return;
    flat.push(value);
    walk(value.message, depth + 1);
    walk(value.attachment, depth + 1);
  };
  walk(response, 0);

  for (const item of flat) {
    const msgId = item.msgId || item.messageId || item.globalMsgId;
    const cliMsgId = item.cliMsgId || item.clientMsgId;
    if (msgId && cliMsgId) {
      return { msgId: String(msgId), cliMsgId: String(cliMsgId), uidFrom: item.uidFrom ? String(item.uidFrom) : "" };
    }
  }
  return null;
}

// Ghi nhớ tin vừa gửi cho key (để lần sau thu hồi)
function remember(threadId, key, response) {
  if (!key || !threadId) return;
  const ids = extractIds(response);
  if (ids) memory.set(slotOf(threadId, key), ids);
}

// Thu hồi tin đã nhớ của key (không có thì thôi, không throw)
async function recall(api, threadId, key, type = 1) {
  if (!key || !threadId) return false;
  const ids = memory.get(slotOf(threadId, key));
  if (!ids) return false;
  memory.delete(slotOf(threadId, key));
  if (!api || typeof api.undo !== "function") return false;
  try {
    await api.undo({ msgId: ids.msgId, cliMsgId: ids.cliMsgId }, threadId, type);
    return true;
  } catch (error) {
    logger.log(`Thu hồi tin thất bại (${key}): ${error.message}`, "warn");
    return false;
  }
}

// Thu hồi NHƯNG vẫn nhớ (dùng khi muốn xoá tin cũ mà không đặt tin mới cùng key)
async function recallKeep(api, threadId, key, type = 1) {
  const result = await recall(api, threadId, key, type);
  remember(threadId, key, null);
  return result;
}

function forget(threadId, key) {
  if (key) memory.delete(slotOf(threadId, key));
}

module.exports = { remember, recall, recallKeep, forget, extractIds };
