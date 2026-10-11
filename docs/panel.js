/* ===== ᴶᴼᴴᴺ ᵀᴿᴬᴺ Panel — logic kết nối tới API host bot ===== */
const LS_URL = "jt_panel_url";
const LS_TOKEN = "jt_panel_token";

let API = "";
let TOKEN = "";
let logTimer = null;
let logPaused = false;
let currentBot = null;
let autoRefresh = null;

const $ = (id) => document.getElementById(id);

function toast(msg) {
  const el = $("toast");
  el.textContent = msg;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2600);
}

/* ---------- kết nối ---------- */
// Nếu panel được serve TRỰC TIẾP từ host bot (Render/Koyeb...), API mặc định = chính origin đó.
// Nếu panel chạy trên GitHub Pages, nhập URL host bot vào ô REMOTE PANEL URL.
function defaultApi() {
  if (localStorage.getItem(LS_URL)) return localStorage.getItem(LS_URL);
  return location.origin;
}

function saveConfig() {
  API = $("remoteUrl").value.trim().replace(/\/+$/, "");
  TOKEN = $("token").value.trim();
  localStorage.setItem(LS_URL, API);
  localStorage.setItem(LS_TOKEN, TOKEN);
  toast("Đã lưu — đang kết nối...");
  refresh();
}

function loadConfig() {
  API = defaultApi();
  TOKEN = localStorage.getItem(LS_TOKEN) || "";
  $("remoteUrl").value = API;
  $("token").value = TOKEN;
}

async function api(pathname, options = {}) {
  if (!API) throw new Error("Chưa cấu hình REMOTE PANEL URL");
  const sep = pathname.includes("?") ? "&" : "?";
  const res = await fetch(API + pathname + sep + "token=" + encodeURIComponent(TOKEN), {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) }
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Lỗi " + res.status);
  return data;
}

/* ---------- tiện ích ---------- */
function uptime(ms) {
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${s % 60}s`;
}

const STATUS_LABEL = {
  online: ["online", "Đang chạy"],
  offline: ["offline", "Chưa chạy"],
  stopped: ["stopped", "Đã dừng"],
  restarting: ["restarting", "Đang khởi động lại"]
};

function setConn(ok, text) {
  $("connDot").className = "dot " + (ok ? "online" : "offline");
  $("connText").textContent = text;
}

/* ---------- dữ liệu chính ---------- */
async function refresh() {
  if (!API) { setConn(false, "chưa cấu hình"); return; }
  try {
    const data = await api("/api/bots");
    render(data);
    loadMetrics();
    loadBotStats();
    setConn(true, `đã kết nối • ${data.bots.length} bot con`);
    if (autoRefresh) clearInterval(autoRefresh);
    autoRefresh = setInterval(() => { if (!$("modal").classList.contains("open")) refresh(); }, 10000);
  } catch (e) {
    setConn(false, e.message);
    $("botGrid").innerHTML = `<div class="empty">Không kết nối được: ${e.message}</div>`;
    $("metricsBar").innerHTML = "";
    $("bot-count").textContent = "0";
  }
}

function render(data) {
  const bots = data.bots;
  $("bot-count").textContent = bots.length;

  const grid = $("botGrid");
  if (!bots.length) {
    grid.innerHTML = '<div class="empty">Chưa có bot con nào. Tạo bot đầu tiên ở trên!</div>';
  } else {
    grid.innerHTML = bots.map((b) => {
      const st = STATUS_LABEL[b.status] || ["offline", b.status];
      return `
      <div class="bot">
        <h3><span class="dot ${st[0]}"></span>${escapeHtml(b.name)}</h3>
        <div class="sub">
          trạng thái <b>${st[1]}</b> • pid <b>${b.pid || "–"}</b> • uptime <b>${uptime(b.uptimeMs)}</b><br>
          restart <b>${b.restarts || 0}</b> lần
          ${b.flapping ? ' • <span style="color:var(--red);font-weight:700">CRASH LIÊN TỤC</span>' : ""}
          <span class="badge ${b.autoRestart ? "on" : "off"}">auto-restart ${b.autoRestart ? "ON" : "OFF"}</span>
          ${b.hasQr ? '<span class="badge qr">có QR</span>' : ""}
        </div>
        <div class="actions">
          <button class="primary small" onclick="botAction('${escapeAttr(b.name)}','start')">Chạy</button>
          <button class="small" onclick="botAction('${escapeAttr(b.name)}','stop')">Dừng</button>
          <button class="small" onclick="botAction('${escapeAttr(b.name)}','restart')">Khởi động lại</button>
          <button class="small" onclick="showQr('${escapeAttr(b.name)}')">QR</button>
          <button class="small" onclick="showLogs('${escapeAttr(b.name)}')">Logs</button>
          <button class="small danger" onclick="removeBot('${escapeAttr(b.name)}')">Xoá</button>
        </div>
      </div>`;
    }).join("");
  }

  // thông tin host (từ master + process)
  const master = data.master || {};
  const rows = [
    ["Số bot con", `${bots.length}`],
    ["Uptime panel", uptime(master.uptimeMs || 0)],
    ["Thời gian hiển thị", new Date().toLocaleString("vi-VN")]
  ];
  $("masterInfo").innerHTML = rows
    .map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`)
    .join("");
}

async function loadMetrics() {
  try {
    const m = await api("/api/metrics");
    const total = Math.max(m.today?.commands || 0, 1);
    const cards = [
      ["Lệnh hôm nay", m.today?.commands ?? 0, m.today?.commands ?? 0],
      ["Tải nhạc", m.today?.musicDownload ?? 0, m.today?.musicDownload ?? 0],
      ["AI requests", m.today?.aiRequests ?? 0, m.today?.aiRequests ?? 0],
      ["Lỗi", m.today?.errors ?? 0, m.today?.errors ?? 0],
      ["Cache hit", (m.cache?.musicSearch?.hitRate ?? 0) + "%", 0],
      ["RAM host", m.memoryMb + "MB", 0],
      ["Node", m.node, 0]
    ];
    $("metricsBar").innerHTML = cards.map(([label, value, pct]) => `
      <div class="metric">
        <b>${value}</b><span>${label}</span>
        <div class="bar"><i style="width:${Math.min(100, (pct / total) * 100)}%"></i></div>
      </div>`).join("");

    // top lệnh
    const top = $("topCommands");
    if (top && m.topCommands?.length) {
      top.innerHTML = m.topCommands.map(([name, count]) =>
        `<tr><td>${escapeHtml(name)}</td><td>${count} lần</td></tr>`).join("");
    }

    // audit log
    const audit = $("auditLog");
    if (audit) {
      audit.textContent = m.audit?.length ? m.audit.join("\n") : "(chưa có hành động admin nào)";
    }
  } catch { /* bỏ qua */ }
}

/* ---------- thống kê bot con (hồ sơ, bạn bè, nhóm) ---------- */
async function loadBotStats() {
  try {
    const { stats } = await api("/api/stats");
    const entries = Object.entries(stats || {});
    if (entries.length === 0) {
      $("profileInfo").innerHTML = '<tr><td colspan="2" style="color:var(--sub)">(chưa có — bot con sẽ gửi sau 30s)</td></tr>';
      return;
    }
    // lấy bot con mới cập nhật nhất
    entries.sort((a, b) => (b[1].updatedAt || 0) - (a[1].updatedAt || 0));
    const [botName, s] = entries[0];
    const p = s.profile || {};

    $("botAvatar").src = p.avatar || "";
    const online = s.status === "online" && (s.updatedAt || 0) > Date.now() - 90000;
    $("botStateBadge").textContent = online ? "online" : "offline";
    $("botStateBadge").className = "badge " + (online ? "on" : "off");

    $("profileInfo").innerHTML = [
      ["Bot con", `<code>${escapeHtml(botName)}</code>`],
      ["Tên Zalo", escapeHtml(p.displayName || "—")],
      ["UID", `<code>${escapeHtml(p.uid || "—")}</code>`],
      ["Số điện thoại", `<code>${escapeHtml(p.phoneNumber || "—")}</code>`],
      ["Bạn bè", `<b>${s.friends?.total ?? 0}</b>`],
      ["Nhóm", `<b>${s.groups?.total ?? 0}</b>`],
      ["Uptime bot", uptime(s.process?.uptimeMs || 0)],
      ["RAM bot", (s.process?.memoryMb ?? "—") + " MB"],
      ["Cập nhật", new Date(s.updatedAt || Date.now()).toLocaleTimeString("vi-VN")]
    ].map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join("");

    // danh sách bạn bè
    $("friendCount").textContent = s.friends?.total ?? 0;
    $("friendList").innerHTML = (s.friends?.list || []).map(f => `
      <div class="list-item">
        <img src="${escapeAttr(f.avatar || "")}" alt="" loading="lazy">
        <div class="meta"><div class="name">${escapeHtml(f.displayName || f.uid)}</div><div class="sub2">${escapeHtml(f.uid)}</div></div>
      </div>`).join("") || '<div class="empty">(không có bạn bè)</div>';

    // danh sách nhóm
    $("groupCount").textContent = s.groups?.total ?? 0;
    $("groupList").innerHTML = (s.groups?.list || []).map(g => `
      <div class="list-item">
        <img src="${escapeAttr(g.avatar || "")}" alt="" loading="lazy">
        <div class="meta"><div class="name">${escapeHtml(g.name || g.gid)}</div><div class="sub2">${g.totalMember} thành viên</div></div>
      </div>`).join("") || '<div class="empty">(bot chưa vào nhóm nào)</div>';
  } catch { /* bỏ qua */ }
}

/* ---------- hành động bot con ---------- */
async function botAction(name, action) {
  try {
    await api(`/api/bots/${encodeURIComponent(name)}/${action}`, { method: "POST" });
    toast(`Đã gửi lệnh ${action} → ${name}`);
    setTimeout(refresh, 700);
  } catch (e) { toast(e.message); }
}

async function createBot() {
  const name = $("newBotName").value.trim();
  if (!name) return toast("Nhập tên bot con");
  try {
    await api("/api/bots", { method: "POST", body: JSON.stringify({ name }) });
    $("newBotName").value = "";
    toast("Đã tạo bot " + name);
    refresh();
  } catch (e) { toast(e.message); }
}

async function removeBot(name) {
  if (!confirm(`Xoá bot "${name}" và toàn bộ dữ liệu của nó?`)) return;
  try {
    await api(`/api/bots/${encodeURIComponent(name)}`, { method: "DELETE" });
    toast("Đã xoá " + name);
    refresh();
  } catch (e) { toast(e.message); }
}

async function setAutoRestart(name, value) {
  try {
    await api(`/api/bots/${encodeURIComponent(name)}`, {
      method: "PATCH",
      body: JSON.stringify({ autoRestart: Boolean(value) })
    });
    refresh();
  } catch (e) { toast(e.message); }
}

/* ---------- modal: logs ---------- */
function togglePause() {
  logPaused = !logPaused;
  $("pauseBtn").textContent = logPaused ? "Tiếp tục" : "Tạm dừng";
}

async function showLogs(name) {
  currentBot = name;
  logPaused = false;
  $("pauseBtn").textContent = "Tạm dừng";
  $("modalTitle").textContent = "Logs • " + name;
  $("modalBody").innerHTML = '<pre class="logs" id="logBox">đang tải...</pre>';
  $("modal").classList.add("open");

  const load = async () => {
    if (logPaused) return;
    try {
      const data = await api(`/api/bots/${encodeURIComponent(name)}/logs?lines=200`);
      const box = $("logBox");
      if (box) box.textContent = (data.logs || []).join("\n") || "(chưa có log)";
    } catch { /* bỏ qua */ }
  };
  load();
  clearInterval(logTimer);
  logTimer = setInterval(load, 4000);
}

/* ---------- modal: QR ---------- */
async function showQr(name) {
  $("modalTitle").textContent = "QR đăng nhập • " + name;
  $("modalBody").innerHTML = `
    <div class="qr-box">
      <small>Bot con phải đang chạy và ở trạng thái chờ đăng nhập</small><br><br>
      <img id="qrImg" alt="QR code">
    </div>`;
  $("modal").classList.add("open");

  const load = async () => {
    const img = $("qrImg");
    if (!img) return;
    try {
      const res = await fetch(`${API}/api/bots/${encodeURIComponent(name)}/qr?ts=${Date.now()}&token=${encodeURIComponent(TOKEN)}`);
      if (res.ok) img.src = URL.createObjectURL(await res.blob());
    } catch { /* bỏ qua */ }
  };
  load();
  clearInterval(logTimer);
  logTimer = setInterval(load, 6000);
}

function closeModal() {
  $("modal").classList.remove("open");
  clearInterval(logTimer);
  logTimer = null;
}

/* ---------- helpers ---------- */
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}
function escapeAttr(str) { return escapeHtml(str).replace(/"/g, "&quot;"); }

/* ---------- khởi động ---------- */
loadConfig();
if (API) refresh();

/* ---------- quản lý lệnh theo nhóm ---------- */
let allCommands = [];

async function loadCommandList() {
  try {
    const { commands, total } = await api("/api/commands");
    allCommands = commands;
    $("cmd-total").textContent = total;
  } catch { /* bỏ qua */ }
}

async function loadGroupCommands() {
  const gid = $("cmdGroupId").value.trim();
  if (!gid) return toast("Nhập Group ID trước");
  try {
    const { disabled } = await api(`/api/groups/${encodeURIComponent(gid)}/commands`);
    if (allCommands.length === 0) await loadCommandList();
    const disabledSet = new Set(disabled || []);
    $("cmdGrid").innerHTML = allCommands.map(c => `
      <div class="cmd-item">
        <div style="min-width:0">
          <div class="cname">${escapeHtml(c.name)}</div>
          <div class="cdesc">${escapeHtml(c.description || "")}</div>
        </div>
        <div class="toggle ${disabledSet.has(c.name) ? "" : "on"}" onclick="toggleCommand(this, \x27${escapeAttr(c.name)}\x27)"></div>
      </div>`).join("");
    $("cmdHint").textContent = `Nhóm ${gid} — ${disabled.length} lệnh đang tắt.`;
  } catch (e) { toast(e.message); }
}

async function toggleCommand(el, name) {
  const gid = $("cmdGroupId").value.trim();
  if (!gid) return toast("Chưa có Group ID");
  const willEnable = !el.classList.contains("on");
  try {
    await api(`/api/groups/${encodeURIComponent(gid)}/commands`, {
      method: "PATCH",
      body: JSON.stringify({ command: name, enabled: willEnable })
    });
    el.classList.toggle("on", willEnable);
    toast(willEnable ? `Đã bật ${name}` : `Đã tắt ${name}`);
  } catch (e) { toast(e.message); }
}

loadCommandList();

/* ---------- trạng thái lệnh (thiếu API/endpoint) ---------- */
async function loadCommandStatus() {
  try {
    const s = await api("/api/commands/status");
    $("cmdStatusCount").textContent = `${s.ready}/${s.total} sẵn sàng`;
    $("cmdStatusHint").innerHTML = s.blocked > 0
      ? `<b style="color:var(--red)">${s.blocked} lệnh đang thiếu API/endpoint</b> — thêm vào config.yml rồi redeploy.`
      : `✅ Tất cả lệnh đã đầy đủ cấu hình.`;
    const all = s.commands || [];
    const blocked = all.filter(c => !c.ready);
    const rest = all.filter(c => c.ready).slice(0, 40);
    const rows = [...blocked.map(c => ({ ...c, blocked: true })), ...rest.map(c => ({ ...c, blocked: false }))];
    $("cmdStatusGrid").innerHTML = rows.map(c => `
      <div class="cmd-status ${c.blocked ? "blocked" : "ready"}">
        <div style="min-width:0">
          <div class="cname">${escapeHtml(c.name)}</div>
          ${c.blocked ? `<div class="miss">${escapeHtml(c.missing.join(", "))}</div>` : ""}
        </div>
        <div class="st">${c.blocked ? "THIẾU" : "OK"}</div>
      </div>`).join("");
  } catch { /* bỏ qua */ }
}
loadCommandStatus();
