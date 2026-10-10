const handleCommand = require("./handle/handleCommand");
const handleEvent = require("./handle/handleEvent");
const logger = require("../utils/logger");
const { updateMessageCache, getMessageCache } = require("../utils/index");
const { ThreadType } = require("zalo-client");

const Threads = require("./controller/controllerThreads");

const RECONNECT_BASE_DELAY = 5000;
const RECONNECT_MAX_DELAY = 60000;
// Sau N lần đóng WS liên tiếp mà không kết nối lại được → thoát process,
// supervisor (index.js / botManager) tự khởi động lại + đăng nhập lại từ đầu
const CONNECT_FAIL_LIMIT = 3;
const WATCHDOG_INTERVAL = 30000;
// 2 phút không nhận được frame nào → coi socket là chết (half-open)
const WATCHDOG_STALE_MS = 120000;

function startListening(api) {
  if (!api?.listener?.on || !api.listener.start) {
    logger.log("API listener không hợp lệ.", "error");
    return;
  }

  const listener = api.listener;

  // cliMsgId đã xử lý (chống backfill xử lý lại, đặc biệt tin self không vào file cache)
  const processedIds = new Set();
  const markProcessed = (cliMsgId) => {
    if (!cliMsgId) return;
    processedIds.add(cliMsgId);
    if (processedIds.size > 1000) {
      processedIds.delete(processedIds.values().next().value);
    }
  };

  // ===== Xử lý 1 tin nhắn (dùng chung cho realtime và backfill sau reconnect) =====
  const onMessage = async (event) => {
    // Tin do chính bot gửi: bỏ qua cache (không cần undo) nhưng vẫn xử lý lệnh
    if (!event.isSelf) updateMessageCache(event);

    const threadData = await Threads.getData(event.threadId);

    const threadInfo = threadData?.data || {};
    const prefix = threadInfo.prefix ? threadInfo.prefix : global.config.prefix;

    // Auto-reply event: module tự quyết (goibot/gemini bỏ qua tin self, log.js log hết)
    handleEvent("message", event, api, event.isSelf === true);

    const { data } = event;
    const content = typeof data?.content === "object" && data?.content !== null
      ? (data.content.title ?? data.content)
      : data?.content;

    // Lệnh từ tin self: chỉ chạy khi bật config allow_self_command
    // (selfListen: true → uidFrom bị rewrite thành uid bot = admin, cần flag rõ ràng)
    const allowSelfCommand = global.config.allow_self_command !== false;
    const canRunCommand = !event.isSelf || allowSelfCommand;

    if (canRunCommand && typeof content === "string" && content.startsWith(prefix)) {
      Promise.resolve(handleCommand(content, event, api, threadInfo, prefix)).catch((err) => {
        logger.log(`Lỗi xử lý lệnh: ${err.message}`, "error");
      });
    }
  };

  const handleIncoming = (event) => {
    const cliMsgId = event?.data?.cliMsgId;
    if (cliMsgId && processedIds.has(cliMsgId)) return; // trùng lặp (server gửi lại / backfill)
    markProcessed(cliMsgId);
    Promise.resolve(onMessage(event)).catch((err) => {
      logger.log(`Lỗi listener message: ${err.message}`, "error");
    });
  };

  listener.on("message", handleIncoming);

  // ===== Backfill: tin nhắn gửi lúc socket rớt =====
  // Khởi tạo = thời điểm bot start: backfill lần ĐẦU chỉ lấy tin từ lúc đó trở đi,
  // không replay lịch sử cũ (tránh bot thực thi lại toàn bộ lệnh trong quá khứ)
  let reconnectSince = Date.now();

  listener.on("old_messages", (messages) => {
    if (!Array.isArray(messages)) return;
    for (const message of messages) {
      const cliMsgId = message?.data?.cliMsgId;
      if (cliMsgId && (processedIds.has(cliMsgId) || getMessageCache()[cliMsgId])) continue; // đã xử lý rồi
      const ts = Number(message?.data?.ts);
      // bỏ tin cũ hơn thời điểm rớt kết nối (ts là ms 13 chữ số)
      if (Number.isFinite(ts) && ts > 1e12 && ts < reconnectSince - 5000) continue;
      handleIncoming(message);
    }
  });

  listener.on("group_event", (event) => {
    handleEvent("group_event", event, api, event.isSelf === true);
  });

  listener.on("reaction", (event) => {
    if (!event.isSelf) handleEvent("reaction", event, api, event.isSelf === true);
  });

  listener.on("undo", (event) => {
    // Không xử lý undo của chính bot (tránh anti_undo tự đăng thông báo cho tin bot xoá)
    if (!event.isSelf) handleEvent("undo", event, api, event.isSelf === true);
  });

  // ===== Tự kết nối lại: Zalo đóng WS (rớt mạng, đăng nhập lại, trùng kết nối)
  // là bot im lặng vĩnh viễn nếu không reconnect =====
  let reconnectTimer = null;
  let reconnectAttempt = 0;
  let connectFailStreak = 0;
  let lastFrameAt = 0;

  const connectListener = (reason) => {
    // connectListener chỉ chạy khi không có timer pending hoặc từ chính timer đã fired
    reconnectTimer = null;
    try {
      // retryOnClose: false → mọi lần đóng WS đều phát event "closed",
      // reconnect chỉ đi qua MỘT luồng duy nhất (tránh 2 WS đấu nhau)
      listener.start({ retryOnClose: false });
      logger.log(`Đã bắt đầu lắng nghe sự kiện${reason ? ` (${reason})` : ""}`, "info");
    } catch (error) {
      reconnectAttempt += 1;
      const delay = Math.min(RECONNECT_BASE_DELAY * reconnectAttempt, RECONNECT_MAX_DELAY);
      logger.log(`Chưa kết nối được listener (${error.message}) — thử lại sau ${delay / 1000}s`, "warn");
      reconnectTimer = setTimeout(() => connectListener("tự kết nối lại"), delay);
    }
  };

  const scheduleReconnect = (reason) => {
    if (reconnectTimer) return;
    reconnectAttempt += 1;
    const delay = Math.min(RECONNECT_BASE_DELAY * reconnectAttempt, RECONNECT_MAX_DELAY);
    logger.log(`Listener đóng (${reason}) — kết nối lại sau ${delay / 1000}s`, "warn");
    reconnectTimer = setTimeout(() => connectListener("tự kết nối lại"), delay);
  };

  // Backoff chỉ reset khi kết nối THẬT (start() thành công chỉ là tạo ws object)
  listener.on("connected", () => {
    reconnectAttempt = 0;
    connectFailStreak = 0;
    lastFrameAt = Date.now();

    // Lấy lại tin nhắn miss trong lúc socket rớt
    try {
      listener.requestOldMessages(ThreadType.User);
      listener.requestOldMessages(ThreadType.Group);
    } catch (error) {
      logger.log(`Không lấy được tin cũ: ${error.message}`, "warn");
    }
  });

  listener.on("disconnected", (code, reason) => {
    logger.log(`Listener mất kết nối (code ${code}) ${reason || ""}`, "warn");
  });

  listener.on("closed", (code) => {
    reconnectSince = Date.now();
    connectFailStreak += 1;
    if (connectFailStreak >= CONNECT_FAIL_LIMIT) {
      logger.log(`Listener rớt ${connectFailStreak} lần liên tiếp không kết nối lại được — khởi động lại tiến trình để đăng nhập lại`, "error");
      process.exit(2); // supervisor tự dựng lại (index.js restart code 2 / botManager autoRestart)
    }
    scheduleReconnect(`code ${code}`);
  });

  // Chỉ log lỗi WS — "error" không tự reconnect (tránh 2 luồng kết nối đấu nhau);
  // việc kết nối lại do event "closed" + watchdog đảm nhiệm
  listener.on("error", (error) => {
    logger.log(`Listener lỗi: ${error?.message || error}`, "error");
  });

  // Đánh dấu freshness cho watchdog (dùng cho cả message và cipher_key)
  const markAlive = () => { lastFrameAt = Date.now(); };
  listener.on("message", markAlive);
  listener.on("cipher_key", markAlive);

  // Watchdog: bắt socket kẹt CONNECTING hoặc half-open (mất mạng, không có close event)
  const watchdog = setInterval(() => {
    const isOpen = listener.ws?.readyState === 1; // WebSocket.OPEN
    const isFresh = Date.now() - lastFrameAt < WATCHDOG_STALE_MS;
    if (isOpen && isFresh) return;
    if (reconnectTimer) return;

    logger.log("Watchdog: listener không còn sống — buộc kết nối lại", "warn");
    try {
      listener.stop();
    } catch {
      // stop() thất bại thì vẫn thử start lại ở dưới
    }
    scheduleReconnect("watchdog");
  }, WATCHDOG_INTERVAL);
  watchdog.unref();

  connectListener();
}

module.exports = startListening;
