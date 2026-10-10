const handleCommand = require("./handle/handleCommand");
const handleEvent = require("./handle/handleEvent");
const logger = require("../utils/logger");
const { updateMessageCache } = require("../utils/index");

const Threads = require("./controller/controllerThreads");

function startListening(api) {
  if (!api?.listener?.on || !api.listener.start) {
    logger.log("API listener không hợp lệ.", "error");
    return;
  }

  api.listener.on("message", async (event) => {
    try {
      updateMessageCache(event);
      const threadData = await Threads.getData(event.threadId);

      const threadInfo = threadData?.data || {};
      const prefix = threadInfo.prefix ? threadInfo.prefix : global.config.prefix;

      handleEvent("message", event, api);

      const { data } = event;
      const content = typeof data?.content === "object" && data?.content !== null
        ? (data.content.title ?? data.content)
        : data?.content;

      if (typeof content === "string" && content.startsWith(prefix)) {
        Promise.resolve(handleCommand(content, event, api, threadInfo, prefix)).catch((err) => {
          logger.log(`Lỗi xử lý lệnh: ${err.message}`, "error");
        });
      }
    } catch (error) {
      logger.log(`Lỗi listener message: ${error.message}`, "error");
    }
  });


  api.listener.on("group_event", (event) => {
    handleEvent("group_event", event, api);
  });

  api.listener.on("reaction", (event) => {
    handleEvent("reaction", event, api);
  });

  api.listener.on("undo", (event) => {
    handleEvent("undo", event, api);
  });

  api.listener.start();
  logger.log("Đã bắt đầu lắng nghe sự kiện", "info");
}

module.exports = startListening;
