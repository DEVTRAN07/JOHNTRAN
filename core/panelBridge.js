// ===== CẦU NỐI PANEL ↔ BOT (localhost only) =====
// Panel cần xem bạn bè/nhóm và CHAT TRỰC TIẾP với bot (kiểu Zalo thu nhỏ).
// Bot con và panel chạy cùng máy nên bot mở 1 HTTP server nội bộ (127.0.0.1)
// để panel gọi — real-time, không đi mạng ngoài, không cần auth (chỉ localhost).
const http = require("http");
const { ThreadType } = require("zalo-client");
const stats = require("./stats");
const logger = require("../utils/logger");

// ===== Bộ nhớ tin nhắn: mỗi thread giữ tối đa 100 tin gần nhất =====
const MAX_PER_THREAD = 100;
const ring = new Map(); // threadId → [{ from, name, text, ts, isSelf }]

function record(threadId, message) {
  if (!threadId) return;
  let list = ring.get(threadId);
  if (!list) {
    list = [];
    ring.set(threadId, list);
  }
  list.push({ ts: Date.now(), ...message });
  if (list.length > MAX_PER_THREAD) list.splice(0, list.length - MAX_PER_THREAD);
}

function getMessages(threadId, limit = 60) {
  const list = ring.get(threadId) || [];
  return list.slice(-limit);
}

// Nội dung tin nhắn → text hiển thị được
function contentToText(content) {
  if (content == null) return "";
  if (typeof content === "string") return content;
  if (typeof content === "object") {
    return content.title || content.caption || content.description ||
           (content.href ? `[tệp] ${content.href.slice(0, 80)}` : "") || "[tin nhắn đặc biệt]";
  }
  return String(content);
}

// Ghi nhận tin ĐẾN (gọi từ core/listen.js)
function recordIncoming(event) {
  try {
    const data = event?.data || {};
    record(event.threadId, {
      from: String(data.uidFrom || ""),
      name: data.dName || "",
      text: contentToText(data.content),
      isSelf: false
    });
  } catch { /* bỏ qua */ }
}

let server = null;
let apiRef = null;
const historyAt = new Map(); // threadId → ts lần cuối kéo lịch sử nhóm

// Zalo trả ts GIÂY cho lịch sử nhóm, ms cho tin realtime — quy về ms
function normTs(ts) {
  const n = Number(ts) || 0;
  return n < 1e12 ? n * 1000 : n;
}

// Kéo lịch sử tin nhắn NHÓM từ Zalo; giữ tin LIVE mới hơn lịch sử
async function loadGroupHistory(threadId, limit) {
  if (typeof apiRef?.getGroupChatHistory !== "function") return null;
  const cachedAt = historyAt.get(threadId) || 0;
  const current = getMessages(threadId, limit);
  // Mới kéo lịch sử < 30s và đã có tin → khỏi kéo lại
  if (Date.now() - cachedAt < 30000 && current.length) return current;

  try {
    const history = await apiRef.getGroupChatHistory(threadId, 80);
    const list = (history?.groupMsgs || []).map((m) => ({
      ts: normTs(m?.data?.ts),
      from: String(m?.data?.uidFrom || ""),
      name: m?.data?.dName || "",
      text: contentToText(m?.data?.content),
      isSelf: Boolean(m?.isSelf)
    })).filter((m) => m.ts > 0);
    if (!list.length) return current;
    const live = current.filter((m) => m.ts > list[list.length - 1].ts);
    ring.set(threadId, [...list, ...live]);
    historyAt.set(threadId, Date.now());
    return getMessages(threadId, limit);
  } catch (error) {
    logger.log(`[bridge] lịch sử nhóm ${threadId} lỗi: ${error.message}`, "warn");
    return current;
  }
}

// ===== HTTP server nội bộ =====
async function handleRequest(req, res, url) {
  const route = url.pathname;
  const json = (code, obj) => {
    res.writeHead(code, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(obj));
  };

  if (route === "/health") return json(200, { ok: true, pid: process.pid });

  // Danh sách bạn bè + nhóm (+ hồ sơ) — dùng cache 5 phút của core/stats
  if (route === "/threads") {
    const [friends, groups, profile] = await Promise.all([
      stats.getFriends(apiRef),
      stats.getGroups(apiRef),
      stats.getProfile(apiRef)
    ]);
    return json(200, { friends, groups, profile });
  }

  // Tin nhắn gần đây của 1 thread (nhóm: kéo thêm lịch sử từ Zalo)
  if (route === "/messages") {
    const threadId = url.searchParams.get("threadId") || "";
    const type = Number(url.searchParams.get("type")) || 0;
    if (!threadId) return json(400, { error: "Thiếu threadId" });
    const limit = Math.min(Number(url.searchParams.get("limit")) || 60, 100);
    let messages = getMessages(threadId, limit);
    if (type === 1) {
      const merged = await loadGroupHistory(threadId, limit);
      if (merged) messages = merged;
    }
    return json(200, { messages, hasHistory: type === 1 });
  }

  // Gửi tin tới 1 thread (bạn bè hoặc nhóm)
  if (route === "/send" && req.method === "POST") {
    let body = "";
    req.on("data", (c) => { body += c; if (body.length > 1e6) req.destroy(); });
    req.on("end", async () => {
      try {
        const { threadId, type, msg } = JSON.parse(body || "{}");
        if (!threadId || !msg) return json(400, { error: "Thiếu threadId hoặc msg" });
        await apiRef.sendMessage(
          { msg: String(msg) },
          threadId,
          Number(type) === 1 ? ThreadType.Group : ThreadType.User
        );
        record(threadId, { from: "me", name: "Bot", text: String(msg), isSelf: true });
        return json(200, { ok: true });
      } catch (error) {
        return json(500, { error: error.message });
      }
    });
    return;
  }

  json(404, { error: "Không có route" });
}

// Cổng: env JT_BRIDGE_PORT, bận thì tự tăng
function findPort(preferred) {
  return new Promise((resolve) => {
    const tryPort = (port) => {
      const srv = http.createServer();
      srv.once("error", () => tryPort(port + 1));
      srv.once("listening", () => srv.close(() => resolve(port)));
      srv.listen(port, "127.0.0.1");
    };
    tryPort(preferred);
  });
}

async function start({ api, port = 3901 } = {}) {
  if (!api?.sendMessage) return;
  if (server) return server.address().port;
  apiRef = api;

  const finalPort = await findPort(port);
  server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://127.0.0.1");
    Promise.resolve(handleRequest(req, res, url)).catch((error) => {
      logger.log(`[bridge] lỗi: ${error.message}`, "warn");
      try { res.writeHead(500); res.end(JSON.stringify({ error: error.message })); } catch { /* bỏ qua */ }
    });
  });

  await new Promise((resolve) => server.listen(finalPort, "127.0.0.1", resolve));
  logger.log(`Cầu nối panel (chat) đang chạy: 127.0.0.1:${finalPort}`, "info");
  return finalPort;
}

module.exports = { start, record, recordIncoming, getMessages, contentToText };
