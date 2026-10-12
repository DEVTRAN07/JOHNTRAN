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
const fs = require("fs");
const path = require("path");

// Ghi debug thu hồi ra file để dễ kiểm tra trên Render/panel (khỏi lục terminal)
const DEBUG_LOG = path.join(__dirname, "..", "data", "recall_debug.log");
function debugFile(text) {
  try {
    fs.mkdirSync(path.dirname(DEBUG_LOG), { recursive: true });
    fs.appendFileSync(DEBUG_LOG, `[${new Date().toISOString()}] ${text}\n`);
  } catch { /* bỏ qua */ }
}

const memory = new Map(); // `${threadId}|${key}` → { msgId, cliMsgId, sentAt }

const slot = (threadId, key) => `${threadId}|${key}`;

function safeJson(value) {
  try {
    const text = JSON.stringify(value);
    return text && text.length > 600 ? text.slice(0, 600) + "..." : (text || String(value));
  } catch {
    return String(value);
  }
}

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
      // Có nửa id → log NGUYÊN VĂN response để biết chính xác Zalo trả gì
      const line = `THIẾU cliMsgId | msgId=${msgId} | response=${safeJson(item)}`;
      logger.log(`[recall] ${line}`, "warn");
      debugFile(line);
      return null;
    }
  }
  return null;
}

function remember(threadId, key, response) {
  if (!key || !threadId) return;
  // Zalo CHỈ trả { msgId } — cliMsgId phải tra lại qua getGroupChatHistory
  const ids = extractMsgIdOnly(response);
  if (ids) {
    memory.set(slot(threadId, key), { ...ids, cliMsgId: ids.cliMsgId || "", sentAt: Date.now() });
    debugFile(`NHỚ TIN | khung=${key} msgId=${ids.msgId} cliMsgId=${ids.cliMsgId || "(sẽ tra lại)"} response=${safeJson(response)}`);
  } else {
    const line = `KHÔNG ĐỌC ĐƯỢC msgId | response=${safeJson(response)}`;
    logger.log(`[recall] ${line}`, "warn");
    debugFile(line);
  }
}

// Chỉ cần msgId là đủ để nhớ (cliMsgId có thể tra lại sau)
function extractMsgIdOnly(response) {
  if (!response || typeof response !== "object") return null;
  const branches = [];
  if (Array.isArray(response.message)) branches.push(...response.message);
  else if (response.message) branches.push(response.message);
  if (Array.isArray(response.attachment)) branches.push(...response.attachment);
  else if (response.attachment) branches.push(response.attachment);
  branches.push(response);

  for (const item of branches) {
    if (!item || typeof item !== "object") continue;
    const msgId = item.msgId ?? item.messageId ?? item.globalMsgId;
    if (msgId) return { msgId: String(msgId), cliMsgId: item.cliMsgId ? String(item.cliMsgId) : "" };
  }
  return null;
}

// Thu hồi tin đã nhớ. Trả về: true | "no-id" | "no-message" | "failed"
async function recall(api, threadId, key, type = 1) {
  if (!key || !threadId) return "no-message";
  const ids = memory.get(slot(threadId, key));
  if (!ids) return "no-message";
  memory.delete(slot(threadId, key));
  if (!api) return "failed";

  // cliMsgId = clientId mình đã gửi (vendor gắn vào response, vì Zalo không trả).
  // LƯU Ý: getGroupChatHistory (cách tra cũ) trả 404 trên Zalo thật nên KHÔNG dùng nữa.
  const cliMsgId = ids.cliMsgId;
  if (!cliMsgId) {
    debugFile(`THIẾU cliMsgId | msgId=${ids.msgId} — vendor chưa gắn được vào response`);
    return "no-id";
  }

  // Cách 1: undo (thu hồi cho MỌI người trong nhóm)
  if (typeof api.undo === "function") {
    try {
      const result = await api.undo({ msgId: ids.msgId, cliMsgId }, threadId, type);
      const line = `undo OK | msgId=${ids.msgId} cliMsgId=${cliMsgId} | kết quả=${safeJson(result)}`;
      logger.log(`[recall] ${line}`, "info");
      debugFile(line);
      return true;
    } catch (error) {
      const line = `undo THẤT BẠI | code=${error.code ?? "?"} msg=${error.message} | gửi: msgId=${ids.msgId} cliMsgId=${cliMsgId} thread=${threadId} type=${type} | phản hồi=${safeJson(error.data ?? error.response ?? null)}`;
      logger.log(`[recall] ${line}`, "error");
      debugFile(line);
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

// Tra cliMsgId của tin bot vừa gửi bằng cách đọc lịch sử nhóm (Zalo không trả
// cliMsgId trong response gửi tin). Thử 2 lần cho chắc (server cần index tin).
async function findCliMsgId(api, threadId, msgId, tries = 2) {
  if (typeof api.getGroupChatHistory !== "function") return null;
  for (let i = 0; i < tries; i++) {
    try {
      const history = await api.getGroupChatHistory(threadId, 100);
      const msgs = history?.groupMsgs || [];
      const target = String(msgId);
      for (const m of msgs) {
        const d = m?.data || {};
        if (String(d.msgId) === target) {
          return { cliMsgId: String(d.cliMsgId ?? ""), uidFrom: String(d.uidFrom ?? "") };
        }
      }
    } catch (error) {
      logger.log(`[recall] getGroupChatHistory lỗi: ${error.message}`, "warn");
      debugFile(`LỊCH SỬ NHÓM LỖI: ${error.message}`);
    }
    await new Promise((r) => setTimeout(r, 700));
  }
  return null;
}

function forget(threadId, key) {
  memory.delete(slot(threadId, key));
}

module.exports = { remember, recall, forget, extractIds, memorySize: () => memory.size };
