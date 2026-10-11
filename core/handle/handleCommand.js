const logger = require("../../utils/logger");
const { wrapApi } = require("../message");
const metrics = require("../metrics");

const Users = require("../controller/controllerUsers");
const Threads = require("../controller/controllerThreads");

const { ThreadType } = require("zalo-client");

const SPAM_WINDOW_MS = 10000;
const SPAM_MAX_COMMANDS = 12;
const spamTracker = new Map();

function resolveCommand(commandName) {
  const direct = global.client.commands.get(commandName);
  if (direct) return direct;

  for (const [, command] of global.client.commands) {
    const aliases = command.config.aliases;
    if (Array.isArray(aliases) && aliases.includes(commandName)) return command;
  }
  return null;
}

function checkSpam(userId) {
  const now = Date.now();
  let history = spamTracker.get(userId);
  if (!history) {
    history = [];
    spamTracker.set(userId, history);
  }
  while (history.length > 0 && now - history[0] > SPAM_WINDOW_MS) history.shift();
  history.push(now);
  return history.length <= SPAM_MAX_COMMANDS;
}

setInterval(() => {
  const now = Date.now();
  for (const [userId, history] of spamTracker.entries()) {
    const filtered = history.filter((time) => now - time <= SPAM_WINDOW_MS);
    if (filtered.length === 0) spamTracker.delete(userId);
    else spamTracker.set(userId, filtered);
  }
}, SPAM_WINDOW_MS).unref();

async function checkGroupPermissions({ api, threadId, type, UIDUsage, threadInfo }) {
  const isBotAdmin = global.users?.admin?.includes(UIDUsage);
  const isSupport = global.users?.support?.includes(UIDUsage);
  let isGroupAdmin = false;

  if (type == ThreadType.Group) {
    if (threadInfo?.box_only) {
      try {
        const info = await api.getGroupInfo(threadId);
        const groupInfo = info?.gridInfoMap?.[threadId];
        if (groupInfo) {
          isGroupAdmin = groupInfo.creatorId == UIDUsage
            || (Array.isArray(groupInfo.adminIds) && groupInfo.adminIds.includes(UIDUsage));
        }
      } catch (err) {
        logger.log("Không thể lấy thông tin nhóm từ API: " + err.message, "warn");
      }
    }

    if (threadInfo.admin_only && !isBotAdmin) {
      return { denied: "❌ Nhóm đã bật chế độ chỉ admin bot được dùng lệnh." };
    }
    if (threadInfo.support_only && !isSupport && !isBotAdmin) {
      return { denied: "❌ Nhóm đã bật chế độ chỉ support bot hoặc admin bot được dùng lệnh." };
    }
    if (threadInfo.box_only && !isGroupAdmin && !isBotAdmin) {
      return { denied: "❌ Nhóm đã bật chế độ chỉ trưởng nhóm hoặc phó nhóm được dùng lệnh." };
    }
  }

  return { isBotAdmin, isSupport, isGroupAdmin };
}

async function handleCommand(messageText, event = null, api = null, threadInfo = null, prefix = null) {
  const config = global.config;

  if (!messageText || typeof messageText !== "string") return;
  if (!messageText.startsWith(prefix)) return;

  const threadId = event?.threadId;
  const type = event?.type;
  const UIDUsage = event?.data?.uidFrom;

  if (type == ThreadType.User && config.allow_private_command === false) {
    return;
  }

  const args = messageText.slice(prefix.length).trim().split(/\s+/);
  const commandName = args.shift()?.toLowerCase();
  if (!commandName) return;

  const command = resolveCommand(commandName);
  if (!command) {
    if (api && threadId && type) {
      await api.sendMessage({ msg: "⚠️ Lệnh không tồn tại!", ttl: 60000 }, threadId, type);
    }
    return;
  }

  // Lệnh bị tắt trong nhóm này (quản lý từ panel)
  const disabledCommands = threadInfo?.disabled_commands;
  if (Array.isArray(disabledCommands) && disabledCommands.includes(commandName)) {
    if (api && threadId && type) {
      await api.sendMessage({ msg: `🚫 Lệnh '${commandName}' đã bị tắt trong nhóm này.`, ttl: 60000 }, threadId, type);
    }
    return;
  }

  if (!checkSpam(UIDUsage)) {
    return api.sendMessage({
      msg: "🚫 Bạn đang gửi lệnh quá nhanh. Vui lòng chậm lại!",
      ttl: 60000
    }, threadId, type);
  }

  const role = command.config.role || 0;
  const isBotAdmin = global.users?.admin?.includes(UIDUsage);
  const isSupport = global.users?.support?.includes(UIDUsage);

  if ((role === 2 && !isBotAdmin) || (role === 1 && !isBotAdmin && !isSupport)) {
    return api.sendMessage({ msg: "🚫 Bạn không có quyền sử dụng lệnh này.", ttl: 60000 }, threadId, type);
  }

  const groupCheck = await checkGroupPermissions({ api, threadId, type, UIDUsage, threadInfo });
  if (groupCheck.denied) {
    return api.sendMessage({ msg: groupCheck.denied, ttl: 60000 }, threadId, type);
  }

  const cdTime = (command.config.cooldowns || 0) * 1000;
  // Điều hướng menu (/menu next, /menu out, /menu 2) không bị cooldown chặn
  const { isMenuNav } = require("./handleCommand-nav");
  const isNavigation = isMenuNav(commandName, messageText, prefix);

  if (cdTime > 0 && !isNavigation) {
    if (!global.client.cooldowns.has(commandName)) {
      global.client.cooldowns.set(commandName, new Map());
    }
    const cdMap = global.client.cooldowns.get(commandName);
    const lastUsed = cdMap.get(UIDUsage);

    if (lastUsed && Date.now() - lastUsed < cdTime) {
      const timeLeft = ((cdTime - (Date.now() - lastUsed)) / 1000).toFixed(1);
      return api.sendMessage({
        msg: `⏳ Vui lòng chờ ${timeLeft}s để dùng lại lệnh '${commandName}'`,
        ttl: 60000
      }, threadId, type);
    }
    cdMap.set(UIDUsage, Date.now());
  }

  try {
    const replyData = {
      content: event.data.content,
      msgType: event.data.msgType,
      propertyExt: event.data.propertyExt,
      uidFrom: event.data.uidFrom,
      msgId: event.data.msgId,
      cliMsgId: event.data.cliMsgId,
      ts: event.data.ts,
      ttl: event.data.ttl
    };
    const wrappedApi = wrapApi(api, threadId, type, commandName, event);
    metrics.track("command", { command: commandName });
    await command.run({ args, event, api: wrappedApi, Users, Threads, replyData, reply: wrappedApi.__reply });
  } catch (err) {
    logger.log(`Lỗi khi xử lý lệnh '${commandName}': ${err.message}`, "error");
    metrics.track("error", { command: commandName });
    try {
      await wrapApi(api, threadId, type, commandName, event).__reply.error("❌ Đã xảy ra lỗi khi xử lý lệnh!");
    } catch {
      // bỏ qua nếu không gửi được thông báo lỗi
    }
  }
}

module.exports = handleCommand;
