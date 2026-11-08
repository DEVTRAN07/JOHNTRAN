const { ThreadType } = require("zalo-client");
const { getMessageCache } = require("../../utils");
const logger = require("../../utils/logger");
const { extractMentions } = require("../../core/mentions");

const MAX_DELETE_COUNT = 100;
const MESSAGE_CACHE_WINDOW_MS = 24 * 60 * 60 * 1000;

module.exports.config = {
  name: "delmsg",
  version: "1.0.0",
  role: 0,
  author: "John Tran",
  description: "Xóa tin được reply hoặc các tin nhắn gần nhất trong nhóm",
  category: "Nhóm",
  usage: "delmsg [N] [@tag]",
  cooldowns: 3
};

function getTargetUid(event, callerUid) {
  const rawMentions = event?.data?.mentions;
  const rawMentionList = Array.isArray(rawMentions)
    ? rawMentions
    : rawMentions && typeof rawMentions === "object"
      ? Object.values(rawMentions)
      : [];
  const normalizedMentions = Array.isArray(event?.mentions) ? event.mentions : [];
  const mentioned = [...new Set(
    [...normalizedMentions, ...rawMentionList]
      .map((mention) => String(mention?.uid ?? mention ?? "").trim())
      .filter(Boolean)
  )];
  const extracted = mentioned.length ? mentioned : extractMentions({ mentions: rawMentions });
  if (extracted.length > 1) return null;
  if (extracted.length === 1) return String(extracted[0]);
  return callerUid ? String(callerUid) : null;
}

function getTimestampMs(message) {
  const timestamp = Number(message?.timestamp);
  if (Number.isFinite(timestamp) && timestamp > 0) {
    if (timestamp < 1e12) return timestamp * 1000;
    if (timestamp > 1e14) return timestamp / 1000;
    return timestamp;
  }
  const parsed = Date.parse(message?.timestamp || message?.timestampString || "");
  return Number.isFinite(parsed) ? parsed : 0;
}

function getRecentMessages(cache, threadId, targetUid, count, now = Date.now()) {
  const entries = Array.isArray(cache) ? cache : Object.values(cache || {});
  const byClientId = new Map();
  for (const entry of entries) {
    const data = entry?.data || entry;
    const message = {
      timestamp: data?.timestamp ?? data?.ts,
      timestampString: data?.timestampString,
      msgId: data?.msgId,
      cliMsgId: data?.cliMsgId,
      uidFrom: data?.uidFrom,
      threadId: entry?.threadId ?? data?.threadId ?? data?.idTo,
      type: entry?.type ?? data?.type
    };
    const timestamp = getTimestampMs(message);
    if (String(message.threadId) === String(threadId)
        && Number(message.type) === ThreadType.Group
        && String(message.uidFrom) === String(targetUid)
        && timestamp >= now - MESSAGE_CACHE_WINDOW_MS
        && timestamp <= now
        && message.msgId != null
        && message.cliMsgId != null) {
      byClientId.set(String(message.cliMsgId), message);
    }
  }
  return Array.from(byClientId.values())
    .sort((a, b) => getTimestampMs(b) - getTimestampMs(a))
    .slice(0, count);
}

function getCacheMissSummary(cache, threadId, targetUid, now = Date.now()) {
  const entries = Array.isArray(cache) ? cache : Object.values(cache || {});
  const groupEntries = entries.filter((entry) => {
    const data = entry?.data || entry;
    return String(entry?.threadId ?? data?.threadId ?? data?.idTo) === String(threadId)
      && Number(entry?.type ?? data?.type) === ThreadType.Group;
  });
  const senderEntries = groupEntries.filter((entry) => {
    const data = entry?.data || entry;
    return String(data?.uidFrom) === String(targetUid);
  });
  const recentEntries = senderEntries.filter((entry) => {
    const data = entry?.data || entry;
    const timestamp = getTimestampMs({
      timestamp: data?.timestamp ?? data?.ts,
      timestampString: data?.timestampString
    });
    return timestamp >= now - MESSAGE_CACHE_WINDOW_MS && timestamp <= now;
  });
  const completeEntries = recentEntries.filter((entry) => {
    const data = entry?.data || entry;
    return data?.msgId != null && data?.cliMsgId != null;
  });

  return `total=${entries.length}, group=${groupEntries.length}, sender=${senderEntries.length}, ` +
    `recent=${recentEntries.length}, withIds=${completeEntries.length}`;
}

function getQuotedMessage(event) {
  const quote = event?.data?.quote;
  if (!quote || typeof quote !== "object") return null;

  const { ownerId, cliMsgId, globalMsgId } = quote;
  if (ownerId == null || cliMsgId == null || globalMsgId == null
      || !String(ownerId).trim() || !String(cliMsgId).trim() || !String(globalMsgId).trim()) {
    return { invalid: true };
  }

  return {
    uidFrom: String(ownerId),
    cliMsgId: String(cliMsgId),
    msgId: String(globalMsgId)
  };
}

module.exports.run = async function ({ api, event, args, reply }) {
  const { threadId, type, data } = event || {};
  if (Number(type) !== ThreadType.Group) {
    return reply.error("Lệnh này chỉ dùng được trong nhóm.");
  }

  const quotedMessage = getQuotedMessage(event);
  if (quotedMessage?.invalid) {
    return reply.error("Không lấy đủ ID của tin được reply. Hãy reply trực tiếp vào tin nhắn rồi thử lại.");
  }

  const commandArgs = Array.isArray(args) ? args : [];
  const hasNonCountArgs = commandArgs.some((arg) => !/^\d+$/.test(String(arg)));
  const countArgs = (args || []).filter((arg) => /^\d+$/.test(String(arg)));
  if (quotedMessage && hasNonCountArgs) {
    return reply.error("Khi reply vào một tin nhắn, không tag thêm người; lệnh sẽ xóa đúng tin được reply.");
  }
  if (quotedMessage && countArgs.length > 1) {
    return reply.error("Khi reply vào một tin nhắn, chỉ xóa đúng tin đó; dùng /delmsg hoặc /delmsg 1.");
  }
  if (!quotedMessage && countArgs.length !== 1) {
    return reply.error(
      `Cách dùng: reply vào tin rồi dùng ${global.config.prefix}delmsg để xóa đúng tin đó; hoặc dùng ${global.config.prefix}delmsg <N> [@tag] để xóa tin gần nhất trong cache.`
    );
  }
  const count = quotedMessage && countArgs.length === 0 ? 1 : Number(countArgs[0]);
  if (!Number.isSafeInteger(count) || count < 1 || count > MAX_DELETE_COUNT
      || (quotedMessage && count !== 1)) {
    return reply.error(`N phải từ 1 đến ${MAX_DELETE_COUNT}.`);
  }

  const callerUid = String(data?.uidFrom || "");
  const targetUid = quotedMessage ? quotedMessage.uidFrom : getTargetUid(event, callerUid);
  if (!targetUid) {
    return reply.error("Chỉ tag tối đa một người; nếu không tag, lệnh sẽ xóa tin của chính bạn.");
  }

  const botAdmins = (global.users?.admin || []).map(String);
  const isBotAdmin = botAdmins.includes(callerUid);
  let isGroupAdmin = false;

  if (!isBotAdmin) {
    try {
      const info = await api.getGroupInfo(threadId);
      const group = info?.gridInfoMap?.[threadId];
      isGroupAdmin = String(group?.creatorId || "") === callerUid
        || (Array.isArray(group?.adminIds) && group.adminIds.some((uid) => String(uid) === callerUid));
    } catch (error) {
      logger.log(`Không thể xác minh quyền admin nhóm cho /delmsg: ${error?.message || error}`, "warn");
      return reply.error("Không xác minh được quyền admin nhóm. Vui lòng thử lại.");
    }
  }

  if (!isBotAdmin && !isGroupAdmin) {
    return reply.error("Chỉ admin bot hoặc admin nhóm mới được dùng lệnh này.");
  }

  let messages;
  if (quotedMessage) {
    messages = [quotedMessage];
  } else {
    const cache = getMessageCache();
    messages = getRecentMessages(cache, threadId, targetUid, count);
    if (messages.length === 0) {
      logger.log(`[delmsg] Không có tin phù hợp trong cache (${getCacheMissSummary(cache, threadId, targetUid)}).`, "warn");
      return reply.text(
        "Không tìm thấy tin phù hợp trong cache. Hãy reply trực tiếp vào tin nhắn cần xóa rồi dùng /delmsg; Zalo không còn cho bot tải lịch sử nhóm."
      );
    }
  }

  let deleted = 0;
  let failed = 0;
  for (const message of messages) {
    try {
      await api.deleteMessage({
        threadId,
        type: ThreadType.Group,
        data: {
          cliMsgId: String(message.cliMsgId),
          msgId: String(message.msgId),
          uidFrom: String(message.uidFrom)
        }
      }, false);
      deleted++;
    } catch (error) {
      failed++;
      logger.log(`Không xóa được tin ${message.msgId} trong /delmsg: ${error?.message || error}`, "warn");
    }
  }

  if (failed === 0) {
    return reply.success(quotedMessage
      ? "Đã xóa tin nhắn được reply."
      : `Đã xóa ${deleted}/${messages.length} tin nhắn gần nhất của thành viên được chọn.`);
  }
  return reply.warn(
    `Đã xóa ${deleted}/${messages.length} tin; ${failed} tin không xóa được. Có thể tài khoản bot chưa đủ quyền quản trị nhóm, tin đã bị thu hồi hoặc tin thuộc về bot.`
  );
};

module.exports.getTargetUid = getTargetUid;
module.exports.getRecentMessages = getRecentMessages;
module.exports.getCacheMissSummary = getCacheMissSummary;
module.exports.getQuotedMessage = getQuotedMessage;
