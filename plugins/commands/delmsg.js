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
  description: "Xóa các tin nhắn gần nhất của một thành viên trong nhóm",
  category: "Nhóm",
  usage: "delmsg <N> @tag | reply tin nhắn bằng delmsg <N>",
  cooldowns: 3
};

function getTargetUid(event) {
  const mentioned = (event?.mentions || [])
    .map((mention) => String(mention?.uid || "").trim())
    .filter(Boolean);
  const extracted = mentioned.length ? mentioned : extractMentions(event?.data);
  if (extracted.length > 1) return null;
  if (extracted.length === 1) return String(extracted[0]);

  const quote = event?.data?.quote;
  const quotedUid = quote?.uidFrom ?? quote?.ownerId;
  return quotedUid ? String(quotedUid) : null;
}

function getTimestampMs(message) {
  const timestamp = Number(message?.timestamp);
  if (Number.isFinite(timestamp) && timestamp > 0) {
    return timestamp < 1e12 ? timestamp * 1000 : timestamp;
  }
  const parsed = Date.parse(message?.timestampString || "");
  return Number.isFinite(parsed) ? parsed : 0;
}

function getRecentMessages(cache, threadId, targetUid, count, now = Date.now()) {
  return Object.values(cache || {})
    .filter((message) => {
      const timestamp = getTimestampMs(message);
      return String(message?.threadId) === String(threadId)
        && Number(message?.type) === ThreadType.Group
        && String(message?.uidFrom) === String(targetUid)
        && timestamp >= now - MESSAGE_CACHE_WINDOW_MS
        && timestamp <= now
        && message?.msgId != null
        && message?.cliMsgId != null;
    })
    .sort((a, b) => getTimestampMs(b) - getTimestampMs(a))
    .slice(0, count);
}

module.exports.run = async function ({ api, event, args, reply }) {
  const { threadId, type, data } = event || {};
  if (Number(type) !== ThreadType.Group) {
    return reply.error("Lệnh này chỉ dùng được trong nhóm.");
  }

  const countArgs = (args || []).filter((arg) => /^\d+$/.test(String(arg)));
  if (countArgs.length !== 1) {
    return reply.error(
      `Cách dùng: ${global.config.prefix}delmsg <N> @tag hoặc reply tin nhắn bằng ${global.config.prefix}delmsg <N>.`
    );
  }
  const count = Number(countArgs[0]);
  if (!Number.isSafeInteger(count) || count < 1 || count > MAX_DELETE_COUNT) {
    return reply.error(`N phải từ 1 đến ${MAX_DELETE_COUNT}.`);
  }

  const targetUid = getTargetUid(event);
  if (!targetUid) {
    return reply.error("Hãy tag đúng một người hoặc reply tin nhắn của người đó.");
  }

  const callerUid = String(data?.uidFrom || "");
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

  const messages = getRecentMessages(getMessageCache(), threadId, targetUid, count);
  if (messages.length === 0) {
    return reply.text("Không tìm thấy tin nhắn gần đây nào của người này trong cache 24 giờ.");
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
    return reply.success(`Đã xóa ${deleted}/${messages.length} tin nhắn gần nhất của thành viên được chọn.`);
  }
  return reply.warn(
    `Đã xóa ${deleted}/${messages.length} tin; ${failed} tin không xóa được. Có thể tài khoản bot chưa đủ quyền quản trị nhóm hoặc tin không còn khả dụng.`
  );
};

module.exports.getTargetUid = getTargetUid;
module.exports.getRecentMessages = getRecentMessages;
