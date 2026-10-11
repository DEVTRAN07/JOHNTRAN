const logger = require("../../utils/logger");
const { wrapApi } = require("../message");
const { ThreadType } = require("zalo-client");

const Users = require("../controller/controllerUsers");
const Threads = require("../controller/controllerThreads");

// Gửi context (api đã wrap + reply) cho mỗi event module — giống handleCommand
function buildContext(api, eventData, name, eventType) {
  let wrapped = api;
  let threadType = eventData?.type;
  // Group event: event.type là LOẠI SỰ KIỆN ("join", "leave"...) chứ không phải
  // ThreadType — gửi nhầm loại này vào sendMessage làm Zalo từ chối tin.
  if (eventType === "group_event" || !Number.isFinite(Number(threadType))) {
    threadType = ThreadType.Group;
  }
  try {
    wrapped = wrapApi(api, eventData?.threadId, threadType, name, eventData);
  } catch {
    wrapped = api;
  }
  return { api: wrapped, reply: wrapped?.__reply, threadType };
}

function handleEvent(eventType, eventData, api, isSelf = false) {
  for (const [name, eventModule] of global.client.events) {
    // Plugin thiếu config/event_type không được làm throw đồng bộ
    // (ném lỗi đồng bộ sẽ chặn toàn bộ luồng xử lý tin nhắn → bot im lặng)
    const targetEvents = eventModule?.config?.event_type;
    if (Array.isArray(targetEvents) && targetEvents.includes(eventType)) {
      if (typeof eventModule.run === "function") {
        const { api: wrapped, reply, threadType } = buildContext(api, eventData, name, eventType);
        const replyData = {
          content: eventData.data?.content,
          msgType: eventData.data?.msgType,
          propertyExt: eventData.data?.propertyExt,
          uidFrom: eventData.data?.uidFrom,
          msgId: eventData.data?.msgId,
          cliMsgId: eventData.data?.cliMsgId,
          ts: eventData.data?.ts,
          ttl: eventData.data?.ttl
        };
        // async reject phải được bắt, không được làm crash process
        Promise.resolve()
          .then(() => eventModule.run({ api: wrapped, event: eventData, eventType, isSelf, reply, Users, Threads, replyData, threadType }))
          .catch((err) => logger.log(`Lỗi khi xử lý event ${eventType} tại module ${name}: ${err.message}`, "error"));
      }
    }
  }

  for (const [name, commandModule] of global.client.commands) {
    if (typeof commandModule.handleEvent === "function") {
      const { api: wrapped, reply } = buildContext(api, eventData, name);
      const replyData = {
        content: eventData.data?.content,
        msgType: eventData.data?.msgType,
        propertyExt: eventData.data?.propertyExt,
        uidFrom: eventData.data?.uidFrom,
        msgId: eventData.data?.msgId,
        cliMsgId: eventData.data?.cliMsgId,
        ts: eventData.data?.ts,
        ttl: eventData.data?.ttl
      };
      Promise.resolve()
        .then(() => commandModule.handleEvent({ api: wrapped, event: eventData, eventType, isSelf, reply, Users, Threads, replyData }))
        .catch((err) => logger.log(`Lỗi khi xử lý handleEvent trong command ${name}: ${err.message}`, "error"));
    }
  }
}

module.exports = handleEvent;
