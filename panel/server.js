const http = require("http");
const fs = require("fs");
const path = require("path");
const { botPaths } = require("./botManager");

const DASHBOARD_HTML = `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>ᴶᴼᴴᴺ ᵀᴿᴬᴺ • Bot Panel</title>
<style>
  :root {
    --bg: #0b0e14; --bg2: #131a26; --card: #121826; --border: #1f2a3a;
    --accent: #00d9ff; --accent2: #7c5cff; --text: #eef2f8; --sub: #8b98ad;
    --green: #22c55e; --red: #f43f5e; --yellow: #f59e0b;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif; background: var(--bg); color: var(--text); min-height: 100vh; }
  header { background: linear-gradient(135deg, var(--bg2), var(--bg)); border-bottom: 1px solid var(--border); padding: 18px 28px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
  .brand { font-size: 22px; font-weight: 800; letter-spacing: 1px; background: linear-gradient(90deg, var(--accent), var(--accent2)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
  .meta { color: var(--sub); font-size: 13px; display: flex; gap: 18px; flex-wrap: wrap; }
  main { max-width: 1200px; margin: 0 auto; padding: 24px; }
  .toolbar { display: flex; gap: 12px; margin-bottom: 22px; flex-wrap: wrap; }
  button, input { font: inherit; border-radius: 10px; border: 1px solid var(--border); }
  button { background: var(--card); color: var(--text); padding: 10px 18px; cursor: pointer; transition: .15s; font-weight: 600; }
  button:hover { border-color: var(--accent); color: var(--accent); }
  button.primary { background: linear-gradient(90deg, var(--accent), var(--accent2)); color: #06121a; border: none; }
  button.danger:hover { border-color: var(--red); color: var(--red); }
  input { background: var(--bg); color: var(--text); padding: 10px 14px; outline: none; min-width: 220px; }
  input:focus { border-color: var(--accent); }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 18px; }
  .bot { background: var(--card); border: 1px solid var(--border); border-radius: 16px; padding: 20px; }
  .bot h3 { font-size: 18px; display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }
  .dot { width: 10px; height: 10px; border-radius: 50%; background: var(--sub); }
  .dot.online { background: var(--green); box-shadow: 0 0 8px var(--green); }
  .dot.offline { background: var(--sub); }
  .dot.stopped { background: var(--red); }
  .dot.restarting { background: var(--yellow); animation: pulse 1s infinite; }
  @keyframes pulse { 50% { opacity: .3; } }
  .bot .sub { color: var(--sub); font-size: 13px; margin-bottom: 14px; }
  .bot .actions { display: flex; gap: 8px; flex-wrap: wrap; }
  .bot .actions button { padding: 7px 12px; font-size: 13px; }
  .badge { font-size: 11px; padding: 3px 9px; border-radius: 20px; background: var(--bg); border: 1px solid var(--border); color: var(--sub); }
  .badge.on { color: var(--green); border-color: var(--green); }
  .badge.off { color: var(--red); border-color: var(--red); }
  .modal { position: fixed; inset: 0; background: rgba(0,0,0,.7); display: none; align-items: center; justify-content: center; z-index: 10; padding: 20px; }
  .modal.open { display: flex; }
  .modal-box { background: var(--card); border: 1px solid var(--border); border-radius: 16px; width: 100%; max-width: 760px; max-height: 84vh; display: flex; flex-direction: column; }
  .modal-box header { border: none; border-bottom: 1px solid var(--border); padding: 14px 20px; }
  .modal-body { padding: 20px; overflow: auto; }
  pre.logs { background: var(--bg); border: 1px solid var(--border); border-radius: 10px; padding: 14px; font-size: 12px; line-height: 1.55; white-space: pre-wrap; word-break: break-all; max-height: 50vh; overflow: auto; color: #c9d6e8; }
  .qr-box { text-align: center; }
  .qr-box img { max-width: 280px; border-radius: 12px; background: #fff; padding: 8px; }
  .empty { color: var(--sub); text-align: center; padding: 60px 0; grid-column: 1/-1; }
  .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin-bottom: 22px; }
  .metric { background: var(--card); border: 1px solid var(--border); border-radius: 14px; padding: 14px 18px; }
  .metric b { display: block; font-size: 24px; background: linear-gradient(90deg, var(--accent), var(--accent2)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
  .metric span { color: var(--sub); font-size: 12px; }
  .toast { position: fixed; bottom: 24px; right: 24px; background: var(--card); border: 1px solid var(--accent); color: var(--text); padding: 12px 20px; border-radius: 12px; transform: translateY(80px); opacity: 0; transition: .25s; z-index: 20; }
  .toast.show { transform: none; opacity: 1; }
  .row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
  small { color: var(--sub); }
</style>
</head>
<body>
<header>
  <div class="brand">ᴶᴼᴴᴺ ᵀᴿᴬᴺ • BOT PANEL</div>
  <div class="meta">
    <span id="master-status">master: –</span>
    <span id="clock"></span>
  </div>
</header>
<main>
  <div class="metrics" id="metricsBar"></div>
  <div class="toolbar">
    <input id="newBotName" placeholder="Tên bot con (vd: bot1)" maxlength="32">
    <button class="primary" onclick="createBot()">+ Tạo bot con</button>
    <button onclick="refresh()">Làm mới</button>
    <span><small id="bot-count"></small></span>
  </div>
  <div class="grid" id="botGrid"></div>
</main>

<div class="modal" id="modal" onclick="if(event.target===this) closeModal()">
  <div class="modal-box">
    <header class="row" style="justify-content:space-between">
      <strong id="modalTitle">Logs</strong>
      <button onclick="closeModal()">Đóng</button>
    </header>
    <div class="modal-body" id="modalBody"></div>
  </div>
</div>
<div class="toast" id="toast"></div>

<script>
const TOKEN = new URLSearchParams(location.search).get("token") || "";
let logTimer = null;
const state = { bots: [] };

async function api(pathname, options = {}) {
  const res = await fetch("/api" + pathname, {
    ...options,
    headers: { "Content-Type": "application/json", ...(TOKEN ? { Authorization: "Bearer " + TOKEN } : {}), ...(options.headers || {}) }
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Lỗi " + res.status);
  return data;
}

function toast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2500);
}

function uptime(ms) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h > 0 ? h + "h " + m + "m" : m + "m " + (s % 60) + "s";
}

async function refresh() {
  try {
    const data = await api("/bots");
    state.bots = data.bots;
    render(data.master);
    loadMetrics();
  } catch (e) { toast(e.message); }
}

async function loadMetrics() {
  try {
    const m = await api("/metrics");
    const bar = document.getElementById("metricsBar");
    bar.innerHTML = [
      ["Lệnh hôm nay", m.today?.commands ?? 0],
      ["Tải nhạc", m.today?.musicDownload ?? 0],
      ["AI", m.today?.aiRequests ?? 0],
      ["Lỗi", m.today?.errors ?? 0],
      ["Cache hit", (m.cache?.musicSearch?.hitRate ?? 0) + "%"],
      ["RAM", m.memoryMb + "MB"],
      ["Node", m.node]
    ].map(([label, value]) => \`<div class="metric"><b>\${value}</b><span>\${label}</span></div>\`).join("");
  } catch { /* bỏ qua */ }
}

function render(master) {
  document.getElementById("master-status").textContent =
    "master: " + (master ? (master.botCount + " bot • uptime " + uptime(master.uptimeMs)) : "–");
  document.getElementById("bot-count").textContent = state.bots.length + " bot con";
  const grid = document.getElementById("botGrid");
  if (!state.bots.length) {
    grid.innerHTML = '<div class="empty">Chưa có bot con nào. Tạo bot đầu tiên ở trên!</div>';
    return;
  }
  grid.innerHTML = state.bots.map(b => \`
    <div class="bot">
      <h3><span class="dot \${b.status}"></span>\${b.name}</h3>
      <div class="sub">trạng thái <b>\${b.status}</b> • pid \${b.pid || "–"} • uptime \${uptime(b.uptimeMs)} • restart \${b.restarts || 0}\${b.flapping ? " • <span style=\\"color:var(--red)\\">CRASH LIÊN TỤC</span>" : ""} • <span class="badge \${b.autoRestart ? "on" : "off"}">auto-restart \${b.autoRestart ? "ON" : "OFF"}</span></div>
      <div class="actions">
        <button class="primary" onclick="botAction('\${b.name}','start')">Chạy</button>
        <button onclick="botAction('\${b.name}','stop')">Dừng</button>
        <button onclick="botAction('\${b.name}','restart')">Khởi động lại</button>
        <button onclick="showQr('\${b.name}')">QR</button>
        <button onclick="showLogs('\${b.name}')">Logs</button>
        <button class="danger" onclick="removeBot('\${b.name}')">Xoá</button>
      </div>
    </div>\`).join("");
}

async function botAction(name, action) {
  try {
    await api("/bots/" + name + "/" + action, { method: "POST" });
    toast("Đã gửi lệnh " + action + " → " + name);
    setTimeout(refresh, 500);
  } catch (e) { toast(e.message); }
}

async function createBot() {
  const name = document.getElementById("newBotName").value.trim();
  if (!name) return toast("Nhập tên bot");
  try {
    await api("/bots", { method: "POST", body: JSON.stringify({ name }) });
    document.getElementById("newBotName").value = "";
    toast("Đã tạo bot " + name);
    refresh();
  } catch (e) { toast(e.message); }
}

async function removeBot(name) {
  if (!confirm("Xoá bot " + name + " và toàn bộ dữ liệu?")) return;
  try {
    await api("/bots/" + name, { method: "DELETE" });
    toast("Đã xoá " + name);
    refresh();
  } catch (e) { toast(e.message); }
}

async function showLogs(name) {
  document.getElementById("modalTitle").textContent = "Logs • " + name;
  document.getElementById("modalBody").innerHTML = '<pre class="logs" id="logBox">đang tải...</pre>';
  document.getElementById("modal").classList.add("open");
  const load = async () => {
    try {
      const data = await api("/bots/" + name + "/logs");
      const box = document.getElementById("logBox");
      if (box) box.textContent = data.logs.join("\\n") || "(chưa có log)";
    } catch (e) { /* bỏ qua */ }
  };
  load();
  clearInterval(logTimer);
  logTimer = setInterval(load, 3000);
}

async function showQr(name) {
  document.getElementById("modalTitle").textContent = "QR đăng nhập • " + name;
  document.getElementById("modalBody").innerHTML = '<div class="qr-box"><small>Đang chờ QR... (bot phải đang chạy và ở trạng thái chờ đăng nhập)</small><br><br><img id="qrImg" alt="qr"></div>';
  document.getElementById("modal").classList.add("open");
  const load = async () => {
    const img = document.getElementById("qrImg");
    if (!img) return;
    const res = await fetch("/api/bots/" + name + "/qr?ts=" + Date.now());
    if (res.ok) {
      const blob = await res.blob();
      img.src = URL.createObjectURL(blob);
    }
  };
  load();
  clearInterval(logTimer);
  logTimer = setInterval(load, 5000);
}

function closeModal() {
  document.getElementById("modal").classList.remove("open");
  clearInterval(logTimer);
}

setInterval(() => {
  document.getElementById("clock").textContent = new Date().toLocaleString("vi-VN");
}, 1000);

refresh();
setInterval(refresh, 5000);
</script>
</body>
</html>`;

function startPanel({ manager, config }) {
  const token = config?.panel?.token || "";
  // Koyeb/Railway inject PORT — panel phải bind đúng port đó để health check + routing
  const port = Number(process.env.PORT) || Number(config?.panel?.port) || 3000;
  const host = config?.panel?.host || "0.0.0.0";

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const pathname = url.pathname;

      // ===== CORS: cho phép dashboard tĩnh (Vercel) gọi API panel từ origin khác =====
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,PUT,DELETE,OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
      if (req.method === "OPTIONS") {
        res.writeHead(204);
        return res.end();
      }

      if (token && pathname.startsWith("/api")) {
        const header = req.headers.authorization || "";
        const provided = header.startsWith("Bearer ") ? header.slice(7) : url.searchParams.get("token");
        if (provided !== token) {
          return sendJson(res, 401, { error: "Sai token" });
        }
      }

      // Panel UI tĩnh (docs/) — xử lý trước mọi route API
      if (!pathname.startsWith("/api") && serveStatic(pathname, res)) return;

      if (pathname === "/api/bots" && req.method === "GET") {
        return sendJson(res, 200, { bots: manager.list(), master: { botCount: manager.list().length, uptimeMs: process.uptime() * 1000 } });
      }

      if (pathname === "/api/metrics" && req.method === "GET") {
        try {
          const metrics = require("../core/metrics");
          const { allStats } = require("../core/cache");
          return sendJson(res, 200, {
            today: metrics.getDayStats(),
            topCommands: metrics.topCommands(),
            cache: allStats(),
            audit: metrics.readAudit(20),
            node: process.version,
            uptimeMs: process.uptime() * 1000,
            memoryMb: Math.round(process.memoryUsage().rss / 1024 / 1024)
          });
        } catch (error) {
          return sendJson(res, 500, { error: error.message });
        }
      }

      if (pathname === "/api/master" && req.method === "GET") {
        return sendJson(res, 200, {
          botCount: manager.list().length,
          uptimeMs: process.uptime() * 1000,
          node: process.version
        });
      }

      // health endpoint cho UptimeRobot / cloud monitor ping (luôn 200 để chống sleep)
      if (pathname === "/health" && req.method === "GET") {
        return sendJson(res, 200, {
          status: global.api ? "ok" : "starting",
          bot: global.config?.name_bot || "bot",
          loggedIn: Boolean(global.api),
          commands: global.client?.commands?.size || 0,
          uptimeMs: process.uptime() * 1000,
          memoryMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
          node: process.version
        });
      }

      if (pathname === "/api/bots" && req.method === "POST") {
        const body = await readBody(req);
        const bot = manager.create(body.name, { autoRestart: body.autoRestart !== false });
        return sendJson(res, 201, { bot: bot.toJSON() });
      }

      const match = pathname.match(/^\/api\/bots\/([a-zA-Z0-9_-]+)(\/(start|stop|restart|logs|qr))?$/);
      if (match) {
        const name = match[1];
        const action = match[2];
        const bot = manager.get(name);
        if (!bot) return sendJson(res, 404, { error: `Bot '${name}' không tồn tại` });

        if (!action) {
          if (req.method === "DELETE") {
            await manager.remove(name);
            return sendJson(res, 200, { removed: name });
          }
          if (req.method === "PATCH" || req.method === "PUT") {
            const body = await readBody(req);
            if (typeof body.autoRestart === "boolean") {
              manager.setAutoRestart(name, body.autoRestart);
              return sendJson(res, 200, { bot: manager.get(name).toJSON() });
            }
            return sendJson(res, 400, { error: "Thiếu trường autoRestart (boolean)" });
          }
          return sendJson(res, 200, { bot: bot.toJSON() });
        }

        switch (action.slice(1)) {
          case "start": {
            const pid = bot.start();
            return sendJson(res, 200, { pid });
          }
          case "stop":
            await bot.stop();
            return sendJson(res, 200, { stopped: true });
          case "restart": {
            const pid = await bot.restart();
            return sendJson(res, 200, { pid });
          }
          case "logs": {
            const limit = Math.min(Number(url.searchParams.get("lines")) || MAX_LOG, 500);
            return sendJson(res, 200, { logs: bot.logs.slice(-limit) });
          }
          case "qr": {
            const qrFile = botPaths(name).qrFile;
            if (!fs.existsSync(qrFile)) return sendJson(res, 404, { error: "Chưa có QR (bot chưa chạy hoặc đã đăng nhập)" });
            const buffer = fs.readFileSync(qrFile);
            res.writeHead(200, { "Content-Type": "image/png", "Cache-Control": "no-store" });
            return res.end(buffer);
          }
        }
      }

      sendJson(res, 404, { error: "Không tìm thấy endpoint" });
    } catch (error) {
      sendJson(res, 500, { error: error.message });
    }
  });

  server.listen(port, host, () => {
    console.log(`[panel] Panel quản lý đang chạy: http://${host === "0.0.0.0" ? "localhost" : host}:${port}/`);
  });

  return server;
}

const MAX_LOG = 300;

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function sendJson(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}

function sendHtml(res, html) {
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(html);
}

// Serve panel UI (docs/) trực tiếp từ host bot — không cần GitHub Pages
const STATIC_FILES = { "/": "index.html", "/panel": "panel.html", "/panel.html": "panel.html" };
function serveStatic(pathname, res) {
  const docDir = path.resolve(__dirname, "..", "docs");
  let filePath = null;
  if (STATIC_FILES[pathname]) filePath = path.join(docDir, STATIC_FILES[pathname]);
  else if (/^\/(panel\.(css|js)|index\.html)$/.test(pathname)) filePath = path.join(docDir, pathname.slice(1));
  if (!filePath) return false;
  fs.readFile(filePath, (error, content) => {
    if (error) {
      res.writeHead(404);
      return res.end("Not found");
    }
    const ext = path.extname(filePath);
    const types = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8" };
    res.writeHead(200, { "Content-Type": types[ext] || "application/octet-stream", "Cache-Control": "no-store" });
    res.end(content);
  });
  return true;
}

module.exports = { startPanel };
