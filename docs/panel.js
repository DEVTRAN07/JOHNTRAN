/* ===== ᴶᴼᴴᴺ ᵀᴿᴬᴺ PANEL — logic ===== */
const LS_URL = "jt_panel_url", LS_TOKEN = "jt_panel_token";
let API = "", TOKEN = "";
let autoRefresh = null, logTimer = null, logPaused = false, currentBot = null;
let allCommands = [], allStatus = [];
const VIEW_TITLES = { bots: "Bot", chat: "Chat với bot", commands: "Lệnh", groups: "Lệnh theo nhóm", profile: "Hồ sơ bot", system: "Hệ thống" };

const $ = (id) => document.getElementById(id);

/* ---------- view router ---------- */
function showView(name) {
  document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
  const view = $("view-" + name);
  if (view) view.classList.add("active");
  document.querySelectorAll(".navbtn").forEach((b) => b.classList.toggle("active", b.dataset.view === name));
  $("viewTitle").textContent = VIEW_TITLES[name] || name;
  window.scrollTo({ top: 0 });
  if (name === "profile") loadBotStats();
  if (name === "system") loadSystem();
  if (name === "commands") { if (!allCommands.length) loadCommandList(); loadCommandStatus(); }
  if (name === "chat") { loadThreads(); } else { clearInterval(chatTimer); chatTimer = null; }
}

/* ---------- cấu hình kết nối ---------- */
function defaultApi() {
  return location.origin;
}
function toggleDrawer() { $("drawer").classList.toggle("open"); }
function saveConfig() {
  API = $("remoteUrl").value.trim().replace(/\/+$/, "");
  TOKEN = $("token").value.trim();
  localStorage.setItem(LS_URL, API);
  localStorage.setItem(LS_TOKEN, TOKEN);
  toast("Đã lưu — đang kết nối...");
  refresh();
}
function loadConfig() {
  API = (localStorage.getItem(LS_URL) || defaultApi()).replace(/\/+$/, "");
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
const escapeHtml = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const escapeAttr = (s) => escapeHtml(s);
function uptime(ms) {
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${s % 60}s`;
}
function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove("show"), 2400);
}
function setConn(ok, text) {
  $("connDot").className = "dot " + (ok ? "online" : "offline");
  $("connText").textContent = text;
}
const STATUS_LABEL = { online: ["online", "Đang chạy"], offline: ["offline", "Chưa chạy"], stopped: ["stopped", "Đã dừng"], restarting: ["restarting", "Đang khởi động lại"] };

/* ---------- dữ liệu chính ---------- */
async function refresh() {
  if (!API) { setConn(false, "chưa cấu hình"); return; }
  try {
    const data = await api("/api/bots");
    renderBots(data.bots);
    loadMetrics();
    setConn(true, `đã kết nối • ${data.bots.length} bot con`);
    if (autoRefresh) clearInterval(autoRefresh);
    autoRefresh = setInterval(() => { if (!$("modal").classList.contains("open")) refresh(); }, 10000);
  } catch (e) {
    setConn(false, e.message);
    $("mainBotCard").innerHTML = `<div class="empty">Không kết nối được: ${escapeHtml(e.message)}</div>`;
    $("childGrid").innerHTML = "";
  }
}

function renderBots(bots) {
  const main = bots.find((b) => b.name === "main") || bots[0];
  const children = bots.filter((b) => b !== main);
  $("child-count").textContent = children.length;
  const nav = $("navCmdCount");

  // ===== Bot chính: thẻ trạng thái lớn =====
  if (!main) {
    $("mainBotCard").innerHTML = '<div class="empty">Không có bot nào đang chạy. Bấm "Khởi động lại" hoặc kiểm tra host.</div>';
    $("mainBotBadge").textContent = "offline";
    $("mainBotBadge").className = "badge off";
  } else {
    const st = STATUS_LABEL[main.status] || ["offline", main.status];
    const online = st[0] === "online";
    $("mainBotBadge").textContent = st[1];
    $("mainBotBadge").className = "badge " + (online ? "on" : "off");
    $("mainBotCard").innerHTML = `
      <div class="bot-main">
        <div class="bt">
          <span class="dot ${st[0]}"></span>
          <div>
            <b>${escapeHtml(main.name)}</b>
            <div class="sub">${st[1]} • pid <b>${main.pid || "–"}</b> • uptime <b>${uptime(main.uptimeMs || 0)}</b> • restart <b>${main.restarts || 0}</b> lần</div>
          </div>
        </div>
        <div class="badges">
          <span class="badge ${main.autoRestart ? "on" : "off"}">auto-restart ${main.autoRestart ? "ON" : "OFF"}</span>
          ${main.hasQr ? '<span class="badge qr">có QR</span>' : ""}
          ${main.flapping ? '<span class="badge crit">crash liên tục</span>' : ""}
        </div>
        <div class="actions">
          <button class="primary" onclick="botAction('${escapeAttr(main.name)}','restart')">🔄 Khởi động lại</button>
          <button onclick="botAction('${escapeAttr(main.name)}','start')">▶ Chạy</button>
          <button onclick="botAction('${escapeAttr(main.name)}','stop')">⏹ Dừng</button>
          <button onclick="showLogs('${escapeAttr(main.name)}')">📜 Logs</button>
          <button onclick="showQr('${escapeAttr(main.name)}')">📱 QR đăng nhập</button>
        </div>
        <label class="row" style="gap:9px;font-size:12.5px;color:var(--sub);margin-top:2px">
          <span class="switch"><input type="checkbox" ${main.autoRestart ? "checked" : ""} onchange="setAutoRestart('${escapeAttr(main.name)}', this.checked)"><span class="tr"></span></span>
          Tự khởi động lại khi crash
        </label>
      </div>`;
  }

  // ===== Bot con: danh sách thu gọn =====
  $("childGrid").innerHTML = children.length ? children.map((b) => {
    const st = STATUS_LABEL[b.status] || ["offline", b.status];
    return `
    <div class="bot">
      <header>
        <span class="dot ${st[0]}"></span><b>${escapeHtml(b.name)}</b>
        <span style="flex:1"></span>
        <span class="badge ${st[0] === "online" ? "on" : "off"}">${st[1]}</span>
      </header>
      <div class="stats">
        <div><div class="k">Uptime</div><div class="v">${uptime(b.uptimeMs || 0)}</div></div>
        <div><div class="k">Restart</div><div class="v">${b.restarts || 0}</div></div>
        <div><div class="k">PID</div><div class="v">${b.pid || "–"}</div></div>
      </div>
      <div class="actions">
        <button class="primary small" onclick="botAction('${escapeAttr(b.name)}','start')">▶ Chạy</button>
        <button class="small" onclick="botAction('${escapeAttr(b.name)}','stop')">⏹ Dừng</button>
        <button class="small" onclick="botAction('${escapeAttr(b.name)}','restart')">🔄 Khởi động lại</button>
        <button class="small" onclick="showLogs('${escapeAttr(b.name)}')">📜 Logs</button>
        <button class="small" onclick="showQr('${escapeAttr(b.name)}')">📱 QR</button>
        <button class="small danger" onclick="removeBot('${escapeAttr(b.name)}')">🗑 Xoá</button>
      </div>
      <label class="row" style="gap:9px;font-size:12.5px;color:var(--sub)">
        <span class="switch"><input type="checkbox" ${b.autoRestart ? "checked" : ""} onchange="setAutoRestart('${escapeAttr(b.name)}', this.checked)"><span class="tr"></span></span>
        Tự khởi động lại khi crash
      </label>
    </div>`;
  }).join("") : '<div class="empty" style="grid-column:1/-1">Chưa có bot con nào — bot chính ở trên là tài khoản Zalo của bạn.</div>';
}

function toggleChildren() {
  const panel = $("childPanel");
  const open = panel.style.display !== "none";
  panel.style.display = open ? "none" : "grid";
  $("childToggle").textContent = open ? "Mở rộng" : "Thu gọn";
}

async function botAction(name, action) {
  try {
    await api(`/api/bots/${encodeURIComponent(name)}/${action}`, { method: "POST" });
    toast(`Đã gửi lệnh ${action} → ${name}`);
    refresh();
  } catch (e) { toast(e.message); }
}

async function createBot() {
  const name = $("newBotName").value.trim();
  if (!name) return toast("Nhập tên bot con");
  try {
    await api("/api/bots", { method: "POST", body: JSON.stringify({ name }) });
    toast("Đã tạo bot " + name);
    $("newBotName").value = "";
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
    await api(`/api/bots/${encodeURIComponent(name)}`, { method: "PATCH", body: JSON.stringify({ autoRestart: Boolean(value) }) });
    toast(`${name}: auto-restart ${value ? "BẬT" : "TẮT"}`);
    refresh();
  } catch (e) { toast(e.message); }
}

/* ---------- metrics ---------- */
async function loadMetrics() {
  try {
    const m = await api("/api/metrics");
    const t = m.today || {};
    const cache = m.cache || {};
    const totalHits = cache.total ?? Object.values(cache.tables || {}).reduce((a, x) => a + (x.hits || 0), 0);
    const cards = [
      ["Lệnh hôm nay", t.commands || 0, ""],
      ["Lỗi", t.errors || 0, (t.errors || 0) > 0 ? "bad" : "good"],
      ["Tìm nhạc", t.musicSearch || 0, ""],
      ["Tải nhạc", t.musicDownload || 0, ""],
      ["AI requests", t.aiRequests || 0, ""],
      ["Uptime host", uptime(m.uptimeMs || 0), ""],
      ["RAM host", (m.memoryMb || 0) + "MB", (m.memoryMb || 0) > 400 ? "warn" : "good"],
      ["Cache", totalHits, ""]
    ];
    $("metricsBar").innerHTML = cards.map(([k, v, cls]) => `<div class="metric ${cls}"><div class="k">${k}</div><div class="v">${v}</div></div>`).join("");
    const top = m.topCommands || [];
    $("topCommands").innerHTML = top.length
      ? top.map(([name, n], i) => `<tr><td>${i + 1}. <code>/${escapeHtml(name)}</code></td><td style="text-align:right"><b>${n}</b> lần</td></tr>`).join("")
      : '<tr><td colspan="2" class="sub">(chưa có lệnh nào hôm nay)</td></tr>';
  } catch { /* bỏ qua */ }
}

/* ---------- danh sách lệnh ---------- */
async function loadCommandList() {
  try {
    const { commands, total } = await api("/api/commands");
    allCommands = commands;
    $("cmd-total").textContent = total;
    const nav = $("navCmdCount");
    nav.style.display = total ? "" : "none";
    nav.textContent = total;
    const cats = [...new Set(commands.map((c) => c.category))].sort();
    $("cmdCategory").innerHTML = '<option value="">Tất cả nhóm</option>' + cats.map((c) => `<option>${escapeHtml(c)}</option>`).join("");
    renderCommands();
  } catch (e) { toast(e.message); }
}

function renderCommands() {
  const q = ($("cmdSearch").value || "").trim().toLowerCase();
  const cat = $("cmdCategory").value;
  const role = $("cmdRole").value;
  const list = allCommands.filter((c) => {
    if (cat && c.category !== cat) return false;
    if (role !== "" && String(c.role) !== role) return false;
    if (!q) return true;
    return (c.name + " " + (c.aliases || []).join(" ") + " " + (c.description || "")).toLowerCase().includes(q);
  });
  $("cmdGrid").innerHTML = list.length ? list.map((c) => `
    <div class="cmd">
      <div style="min-width:0">
        <div class="nm">${escapeHtml(c.name)}</div>
        <div class="ds">${escapeHtml(c.description || "")}</div>
      </div>
      <span class="rl r${c.role}">${c.role === 2 ? "ADMIN" : c.role === 1 ? "SUPPORT" : "MEMBER"}</span>
    </div>`).join("") : '<div class="empty" style="grid-column:1/-1">Không có lệnh khớp bộ lọc.</div>';
}

/* ---------- trạng thái lệnh (thiếu API/config) ---------- */
async function loadCommandStatus() {
  try {
    const s = await api("/api/commands/status");
    allStatus = s.commands || [];
    $("cmdStatusCount").textContent = `${s.ready}/${s.total} sẵn sàng`;
    $("cmdStatusHint").innerHTML = s.blocked > 0
      ? `<b style="color:var(--red)">${s.blocked} lệnh đang thiếu API/endpoint</b> — thêm vào config.yml rồi redeploy.`
      : `✅ Tất cả lệnh đã đầy đủ cấu hình.`;
    renderCommandStatus();
  } catch { /* bỏ qua */ }
}

function renderCommandStatus() {
  const rows = [...allStatus.filter((c) => !c.ready), ...allStatus.filter((c) => c.ready)];
  $("cmdStatusGrid").innerHTML = rows.length ? rows.map((c) => `
    <div class="cmd-status ${c.ready ? "ready" : "blocked"}">
      <div style="min-width:0">
        <div class="cname">${escapeHtml(c.name)}</div>
        ${c.ready ? "" : `<div class="miss">thiếu: ${escapeHtml((c.missing || []).join(", "))}</div>`}
      </div>
      <div class="st">${c.ready ? "OK" : "THIẾU"}</div>
    </div>`).join("") : '<div class="empty">(không có dữ liệu)</div>';
}

/* ---------- lệnh theo nhóm ---------- */
async function loadGroupCommands() {
  const gid = $("cmdGroupId").value.trim();
  if (!gid) return toast("Nhập Group ID trước");
  try {
    if (!allCommands.length) await loadCommandList();
    const { disabled } = await api(`/api/groups/${encodeURIComponent(gid)}/commands`);
    const disabledSet = new Set(disabled || []);
    $("cmdGroupGrid").innerHTML = allCommands.map((c) => `
      <div class="cmd-item">
        <div class="txt">
          <div class="cname">${escapeHtml(c.name)}</div>
          <div class="cdesc">${escapeHtml(c.description || "")}</div>
        </div>
        <span class="switch"><input type="checkbox" ${disabledSet.has(c.name) ? "" : "checked"} onchange="toggleCommand(this, '${escapeAttr(c.name)}')"><span class="tr"></span></span>
      </div>`).join("");
    $("cmdHint").textContent = `Nhóm ${gid} — ${disabled.length} lệnh đang tắt.`;
  } catch (e) { toast(e.message); }
}

async function toggleCommand(el, name) {
  const gid = $("cmdGroupId").value.trim();
  if (!gid) return toast("Chưa có Group ID");
  const willEnable = el.checked;
  try {
    await api(`/api/groups/${encodeURIComponent(gid)}/commands`, {
      method: "PATCH",
      body: JSON.stringify({ command: name, enabled: willEnable })
    });
    toast(willEnable ? `Đã bật /${name}` : `Đã tắt /${name}`);
  } catch (e) { toast(e.message); }
}

/* ---------- hồ sơ bot ---------- */
async function loadBotStats() {
  try {
    const { stats } = await api("/api/stats");
    const entries = Object.entries(stats || {});
    if (!entries.length) {
      $("profileInfo").innerHTML = '<tr><td colspan="2" class="sub">(chưa có — bot con sẽ gửi sau 30s)</td></tr>';
      return;
    }
    entries.sort((a, b) => (b[1].updatedAt || 0) - (a[1].updatedAt || 0));
    const [botName, s] = entries[0];
    const p = s.profile || {};
    if (p.avatar) $("botAvatar").src = p.avatar;
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
      ["Cập nhật", new Date(s.updatedAt || Date.now()).toLocaleString("vi-VN")]
    ].map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join("");

    $("friendCount").textContent = s.friends?.total ?? 0;
    $("friendList").innerHTML = (s.friends?.list || []).length
      ? s.friends.list.map((f) => `<div class="it">${f.avatar ? `<img src="${escapeAttr(f.avatar)}" alt="">` : ""}<span class="nm">${escapeHtml(f.displayName || f.zaloName || f.uid)}</span><span class="id">${escapeHtml(f.uid)}</span></div>`).join("")
      : '<div class="empty">(không có)</div>';
    $("groupCount").textContent = s.groups?.total ?? 0;
    $("groupList").innerHTML = (s.groups?.list || []).length
      ? s.groups.list.map((g) => `<div class="it">${g.avatar ? `<img src="${escapeAttr(g.avatar)}" alt="">` : ""}<span class="nm">${escapeHtml(g.name || g.groupName || g.id)}</span><span class="id">${escapeHtml(g.id)}</span></div>`).join("")
      : '<div class="empty">(không có)</div>';
  } catch { /* bỏ qua */ }
}

/* ---------- hệ thống ---------- */
async function loadSystem() {
  try {
    const m = await api("/api/metrics");
    const master = m.master || {};
    $("masterInfo").innerHTML = [
      ["Số bot con", `<b>${master.botCount ?? "—"}</b>`],
      ["Node", m.node || "—"],
      ["Uptime host", uptime(m.uptimeMs || 0)],
      ["RAM host", (m.memoryMb || 0) + "MB"],
      ["Lệnh hôm nay", m.today?.commands || 0],
      ["Lỗi hôm nay", m.today?.errors || 0]
    ].map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join("");
    const audit = m.audit || [];
    $("auditLog").textContent = audit.length ? audit.join("\n") : "(chưa có hành động admin nào)";
  } catch { /* bỏ qua */ }
}

/* ---------- modal: logs ---------- */
function togglePause() {
  logPaused = !logPaused;
  $("pauseBtn").textContent = logPaused ? "Tiếp tục" : "Tạm dừng";
}
function closeModal() {
  $("modal").classList.remove("open");
  clearInterval(logTimer);
  logTimer = null;
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
      <small class="sub">Bot con phải đang chạy và ở trạng thái chờ đăng nhập</small><br><br>
      <img id="qrImg" alt="QR code">
    </div>`;
  $("modal").classList.add("open");

  // /qr trả ảnh PNG thô (không phải JSON)
  const load = async () => {
    try {
      const res = await fetch(`${API}/api/bots/${encodeURIComponent(name)}/qr?token=${encodeURIComponent(TOKEN)}&ts=${Date.now()}`);
      const img = $("qrImg");
      if (res.ok && img) {
        img.src = URL.createObjectURL(await res.blob());
      } else if (!res.ok && img) {
        img.remove();
        $("modalBody").innerHTML = '<div class="empty">Chưa có QR — bot có thể đã đăng nhập hoặc chưa khởi động.</div>';
        clearInterval(logTimer);
      }
    } catch { /* bỏ qua */ }
  };
  load();
  clearInterval(logTimer);
  logTimer = setInterval(load, 5000);
}


/* ---------- CHAT (kiểu Zalo PC) ---------- */
const CHAT_BOT = "main";
const LS_STYLE = "jt_chat_style";
let chatThreads = { friends: { list: [] }, groups: { list: [] } };
let chatCurrent = null;   // { id, type, name, avatar, isGroup }
let chatTimer = null;
let chatUnread = {};      // threadId → số tin chưa đọc
let chatLastSeen = {};    // threadId → ts tin cuối đã xem
let chatStyle = { color: "", font: "", bold: false, italic: false, underline: false, strike: false };

// ---- kiểu chữ (chỉ hiển thị trên panel, lưu localStorage) ----
function loadChatStyle() {
  try { chatStyle = { ...chatStyle, ...(JSON.parse(localStorage.getItem(LS_STYLE)) || {}) }; } catch { /* bo qua */ }
  applyStyleBar();
}
function saveChatStyle() {
  localStorage.setItem(LS_STYLE, JSON.stringify(chatStyle));
  applyStyleBar();
}
function styleCss(extra = {}) {
  const css = [];
  if (chatStyle.color) css.push("color:" + chatStyle.color);
  if (chatStyle.font) css.push("font-size:" + chatStyle.font);
  if (chatStyle.bold) css.push("font-weight:700");
  if (chatStyle.italic) css.push("font-style:italic");
  if (chatStyle.underline) css.push("text-decoration:underline");
  if (chatStyle.strike) css.push("text-decoration:line-through");
  return css.concat(Object.entries(extra).map(([k, v]) => k + ":" + v)).join(";");
}
function applyStyleBar() {
  document.querySelectorAll(".stbtn").forEach((b) => b.classList.toggle("on", !!chatStyle[b.dataset.k]));
  document.querySelectorAll(".cdot").forEach((d) => d.classList.toggle("on", chatStyle.color === d.dataset.c));
  const f = $("chatFont");
  if (f) f.value = chatStyle.font || "";
}
function toggleStyle(key) {
  chatStyle[key] = !chatStyle[key];
  saveChatStyle();
}
function setChatStyle(patch, el) {
  Object.assign(chatStyle, patch);
  saveChatStyle();
}
function openStylePanel() {
  const dot = (c) => '<button class="cdot ' + (chatStyle.color === c ? "on" : "") + '" style="--c:' + c + '" onclick="setChatStyle({color:\'' + c + '\'});openStylePanel()"></button>';
  $("styleBody").innerHTML = `
    <div class="sub" style="margin-bottom:14px">Chỉ đổi cách <b>HIỂN THỊ</b> trên panel (không gửi lên Zalo). Màu theo bảng của bot.</div>
    <div class="color-dots" style="margin:0 0 14px">${["#7c5cff","#f43f5e","#22c55e","#f59e0b","#f97316","#e5e7eb"].map(dot).join("")}</div>
    <label style="display:grid;gap:6px;font-size:11px;font-weight:800;letter-spacing:1.2px;color:var(--sub);text-transform:uppercase;margin-bottom:10px">Phong cách
      <select onchange="setChatStyle({font:this.value});openStylePanel()" style="width:100%">
        <option value="">Mặc định</option>
        <option value="13px" ${chatStyle.font==="13px"?"selected":""}>Nhỏ</option>
        <option value="15px" ${chatStyle.font==="15px"?"selected":""}>Trung bình</option>
        <option value="17px" ${chatStyle.font==="17px"?"selected":""}>Lớn</option>
        <option value="19px" ${chatStyle.font==="19px"?"selected":""}>Rất lớn</option>
      </select>
    </label>
    <label style="display:flex;gap:9px;align-items:center;font-size:13.5px;margin-bottom:16px">
      <span class="switch"><input type="checkbox" ${chatStyle.bold?"checked":""} onchange="toggleStyle('bold');openStylePanel()"><span class="tr"></span></span>
      In đậm
    </label>
    <div class="row" style="justify-content:flex-end">
      <button onclick="resetStyle()">Huỷ kiểu</button>
      <button class="primary" onclick="closeStylePanel()">Lưu</button>
    </div>`;
  $("styleModal").classList.add("open");
}
function closeStylePanel() { $("styleModal").classList.remove("open"); }
function resetStyle() {
  chatStyle = { color: "", font: "", bold: false, italic: false, underline: false, strike: false };
  saveChatStyle();
  openStylePanel();
}

// ---- danh sách hội thoại ----
let chatAdminGroups = [];

async function loadThreads() {
  try {
    const data = await api("/api/chat/" + CHAT_BOT + "/threads");
    chatThreads = data;
    chatAdminGroups = data.adminGroups || [];
    renderThreadList();
  } catch (e) {
    $("chatThreads").innerHTML = '<div class="empty">' + escapeHtml(e.message) + '<br><br>Bot chưa bật cầu nối chat hoặc chưa chạy.</div>';
  }
}

function threadAvatar(t) {
  return t.avatar
    ? '<img src="' + escapeAttr(t.avatar) + '" alt="">'
    : '<span class="ph">' + (t.isGroup ? "👥" : "👤") + "</span>";
}

function renderThreadList() {
  const q = ($("chatSearch").value || "").trim().toLowerCase();
  const muted = JSON.parse(localStorage.getItem("jt_chat_muted") || "[]");
  const adminSet = new Set(chatAdminGroups || []);
  const friends = (chatThreads.friends?.list || []).filter((f) => !q || (f.displayName || "").toLowerCase().includes(q) || f.uid.includes(q));
  const groups = (chatThreads.groups?.list || []).filter((g) => !q || (g.name || "").toLowerCase().includes(q) || g.gid.includes(q));
  const rows = [
    ...groups.map((g) => ({ id: g.gid || g.id, type: 1, name: g.name || g.gid || g.id, avatar: g.avatar || "", last: g.lastMessage, isGroup: true })),
    ...friends.map((f) => ({ id: f.uid, type: 0, name: f.displayName || f.uid, avatar: f.avatar || "", last: f.lastMessage, isGroup: false }))
  ].filter((t) => !muted.includes(t.id));
  $("chatThreads").innerHTML = rows.length ? rows.map((t) => {
    const unread = chatUnread[t.id] || 0;
    const tm = t.last?.ts ? new Date(t.last.ts).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : "";
    const tJson = escapeAttr(JSON.stringify({ id: t.id, type: t.type, name: t.name, avatar: t.avatar, isGroup: t.isGroup }));
    const crown = t.isGroup && adminSet.has(t.id) ? '<span class="crown-badge" title="Bot cầm key">👑</span>' : "";
    return '<button class="thread ' + (chatCurrent?.id === t.id ? "active" : "") + '" data-t="' + tJson + '" onclick="openThreadJson(this)">' +
      '<span class="ava" onclick="event.stopPropagation();openThreadJson(this.parentElement)" title="Xem thông tin">' + threadAvatar(t) + (unread ? '<span class="unread">' + (unread > 9 ? "9+" : unread) + "</span>" : "") + "</span>" +
      "<span style=\"min-width:0\">" +
      '<span class="nm">' + escapeHtml(t.name) + " " + crown + ' <span class="tag ' + (t.isGroup ? "group" : "user") + '">' + (t.isGroup ? "Nhóm" : "Người dùng") + "</span></span>" +
      '<span class="pv">' + (t.last ? escapeHtml((t.last.name ? t.last.name + ": " : "") + String(t.last.text || "[tin nhắn]").slice(0, 42)) : (tm ? tm : "Chưa có tin nhắn")) + "</span>" +
      "</span></button>";
  }).join("") : '<div class="empty">Không có hội thoại khớp tìm kiếm.</div>';
}

// ---- mở hội thoại ---- (data-t JSON: tên nhóm có dấu ' hoặc " không vỡ chuỗi)
function openThreadJson(el) {
  let t = {};
  try { t = JSON.parse(el.dataset.t || "{}"); } catch { return; }
  return openThread(t.id, t.type, t.name, t.avatar, t.isGroup);
}
async function openThread(id, type, name, avatar, isGroup) {
  chatCurrent = { id, type, name, avatar, isGroup };
  chatUnread[id] = 0;
  $("chatLayout").classList.add("opened");
  $("chatBack").style.display = "";
  $("chatTitle").textContent = name;
  $("chatSub").textContent = isGroup ? "Nhóm — bấm để xem thông tin" : "Người dùng — bấm để xem hồ sơ";
  if (avatar) $("chatAvatar").src = avatar;
  $("chatInput").disabled = false;
  $("chatSendBtn").disabled = false;
  renderThreadList();
  await loadChatMessages();
  clearInterval(chatTimer);
  chatTimer = setInterval(loadChatMessages, 2500);
}

function closeThread() {
  chatCurrent = null;
  clearInterval(chatTimer);
  chatTimer = null;
  $("chatLayout").classList.remove("opened");
  $("chatBack").style.display = "none";
  $("chatTitle").textContent = "Chọn hội thoại";
  $("chatSub").textContent = "bạn bè hoặc nhóm";
  $("chatInput").disabled = true;
  $("chatSendBtn").disabled = true;
  $("chatMsgs").innerHTML = '<div class="empty">Chưa mở hội thoại — chọn bạn bè/nhóm để xem tin nhắn và chat trực tiếp.</div>';
  renderThreadList();
}

// ---- tin nhắn ----
async function loadChatMessages() {
  if (!chatCurrent) return;
  try {
    const data = await api("/api/chat/" + CHAT_BOT + "/messages?threadId=" + encodeURIComponent(chatCurrent.id) + "&type=" + chatCurrent.type + "&limit=80");
    const msgs = data.messages || [];
    const lastTs = msgs.length ? msgs[msgs.length - 1].ts : 0;
    chatLastSeen[chatCurrent.id] = lastTs;
    renderChatMessages(msgs);
  } catch { /* bo qua */ }
}

function renderChatMessages(messages) {
  if (!messages.length) {
    $("chatMsgs").innerHTML = '<div class="empty">Chưa có tin nhắn nào.<br><br>Zalo không cho lấy lịch sử cũ — panel chỉ hiện tin từ khi bot hoạt động.</div>';
    return;
  }
  const box = $("chatMsgs");
  box.innerHTML = messages.map((m) => {
    const tm = new Date(m.ts).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
    const personal = (styleExtra) => styleCss(styleExtra);
    if (m.isSelf) {
      return '<div class="msg out"><div class="col"><div class="bubble" style="' + personal() + '">' + escapeHtml(m.text || "") +
        '<div class="tm">' + tm + '</div><div class="acts"><button onclick="copyMsg(this)" title="Copy">📋</button></div></div></div></div>';
    }
    const ava = m.avatar || "";
    const showName = chatCurrent?.isGroup;
    // chỉ cỡ chữ (không màu) cho tin đến — vẫn đọc rõ, đúng tinh thần "hiển thị panel"
    const inStyle = chatStyle.font ? "font-size:" + chatStyle.font : "";
    const avaHtml = '<span class="ava-click" onclick="openUserInfo(\'' + escapeAttr(m.from || "") + '\')" title="Xem hồ sơ">' +
      (ava ? '<img class="avatar" src="' + escapeAttr(ava) + '" alt="">' : '<span class="ph">👤</span>') + "</span>";
    return '<div class="msg">' + avaHtml +
      '<div class="col">' +
      (showName ? '<div class="who">' + escapeHtml(m.name || m.from || "") + "</div>" : "") +
      '<div class="bubble" style="' + inStyle + '">' + escapeHtml(m.text || "") + '<div class="tm">' + tm + '</div>' +
      '<div class="acts"><button onclick="copyMsg(this)" title="Copy">📋</button></div></div></div></div>';
  }).join("");
  box.scrollTop = box.scrollHeight;
}

function copyMsg(el) {
  const bubble = el.closest(".bubble");
  const text = bubble ? bubble.childNodes[0].textContent : "";
  navigator.clipboard?.writeText(text.trim());
  toast("Đã copy tin nhắn");
}

async function sendChat(e) {
  e.preventDefault();
  if (!chatCurrent) return;
  const msg = $("chatInput").value.trim();
  if (!msg) return;
  $("chatInput").value = "";
  try {
    await api("/api/chat/" + CHAT_BOT + "/send", {
      method: "POST",
      body: JSON.stringify({ threadId: chatCurrent.id, type: chatCurrent.type, msg })
    });
    await loadChatMessages();
  } catch (error) { toast(error.message); }
}

// ---- popup thông tin nhóm / hồ sơ người dùng ----
async function openUserInfo(uid) {
  if (!uid || uid === "me") return;
  $("infoTitle").textContent = "Hồ sơ";
  $("infoBody").innerHTML = '<div class="empty">Đang tải...</div>';
  $("infoModal").classList.add("open");
  try {
    const info = await api("/api/chat/" + CHAT_BOT + "/user-info?uid=" + encodeURIComponent(uid));
    renderUserInfo(info);
  } catch (e) {
    $("infoBody").innerHTML = '<div class="empty">' + escapeHtml(e.message) + "</div>";
  }
}

async function openThreadInfo() {
  if (!chatCurrent) return;
  const t = chatCurrent;
  if (t.isGroup) {
    $("infoTitle").textContent = "Thông tin nhóm";
  } else {
    $("infoTitle").textContent = "Hồ sơ";
  }
  $("infoBody").innerHTML = '<div class="empty">Đang tải...</div>';
  $("infoModal").classList.add("open");
  try {
    const info = await api("/api/chat/" + CHAT_BOT + "/thread-info?threadId=" + encodeURIComponent(t.id) + "&type=" + t.type);
    if (t.isGroup) renderGroupInfo(info);
    else renderUserInfo(info);
  } catch (e) {
    $("infoBody").innerHTML = '<div class="empty">' + escapeHtml(e.message) + "</div>";
  }
}

function renderGroupInfo(g) {
  const uid = g.id || "";
  const hasKey = isAdminGroup(uid);
  $("infoBody").innerHTML = `
    <div class="info-ava">
      ${g.avatar ? '<img src="' + escapeAttr(g.avatar) + '" alt="">' : '<div class="ph">👥</div>'}
      <b>${escapeHtml(g.name || uid)}${hasKey ? ' <span style="color:var(--yellow)">👑</span>' : ""}</b>
      <div class="sub">${hasKey ? "Bot CẦM KEY nhóm này • quản trị viên" : "Bot chỉ là thành viên"} • ${g.totalMember || 0} thành viên • ID ${escapeHtml(uid)}</div>
    </div>
    <div class="info-grid">
      ${hasKey ? `
        <button class="info-act" onclick="groupAction('rename')"><span class="ic">✏️</span>Đổi tên nhóm</button>
        <button class="info-act" onclick="groupAction('adduser')"><span class="ic">➕</span>Thêm thành viên</button>
        <button class="info-act" onclick="groupAction('pinned')"><span class="ic">📍</span>Tin đã ghim</button>
        <button class="info-act" onclick="groupAction('priority')"><span class="ic">↩️</span>Chuyển sang Ưu tiên</button>` : `
        <button class="info-act" onclick="groupAction('info')"><span class="ic">🧾</span>Thông tin nhóm</button>
        <button class="info-act" onclick="groupAction('viewmsgs')"><span class="ic">💬</span>Xem tin nhắn</button>`}
      <button class="info-act" onclick="toggleMute('${escapeAttr(uid)}')"><span class="ic">🔕</span>${isMuted(uid) ? "Bỏ ẩn nhóm" : "Ẩn nhóm khỏi panel"}</button>
      <button class="info-act" onclick="toggleAdminGroup('${escapeAttr(uid)}')"><span class="ic">👑</span>${hasKey ? "Bỏ đánh dấu cầm key" : "Đánh dấu bot cầm key"}</button>
      <button class="info-act danger" onclick="groupAction('leave')"><span class="ic">🚪</span>Rời nhóm</button>
      ${hasKey ? `<button class="info-act full danger" onclick="groupAction('disperse')"><span class="ic">💥</span>Giải tán nhóm (không hoàn tác được)</button>` : ""}
    </div>
    ${hasKey ? `
    <div class="info-sec">Quản lý thành viên (nhập UID)</div>
    <div class="row">
      <input id="memberUidInput" placeholder="UID thành viên" style="flex:1;min-width:130px">
      <button class="small danger" onclick="userAction('remove', $('memberUidInput').value.trim())">Xoá</button>
      <button class="small danger" onclick="userAction('blockgroup', $('memberUidInput').value.trim())">Chặn</button>
      <button class="small" onclick="userAction('deputy', $('memberUidInput').value.trim())">👑 Phó nhóm</button>
      <button class="small" onclick="groupAction('adduser', $('memberUidInput').value.trim())">Thêm</button>
    </div>` : `
    <div class="sub" style="margin-top:12px">Bot chưa cầm key nhóm này — chỉ có thể rời nhóm và ẩn khỏi panel. Đánh dấu 👑 khi bạn tự cấp quyền quản trị cho bot trong Zalo.</div>`}
  `;
}

function renderUserInfo(u) {
  const uid = u.uid || u.id || "";
  const inGroup = chatCurrent?.isGroup;
  const hasKey = chatCurrent?.isGroup ? isAdminGroup(chatCurrent.id) : false;
  $("infoBody").innerHTML = `
    <div class="info-ava">
      ${u.avatar ? '<img src="' + escapeAttr(u.avatar) + '" alt="">' : '<div class="ph">👤</div>'}
      <b>${escapeHtml(u.name || uid)}</b>
      <div class="sub">UID: ${escapeHtml(uid)}${u.status ? " • " + escapeHtml(u.status) : ""}</div>
    </div>
    <div class="info-grid">
      <button class="info-act" onclick="userAction('check')"><span class="ic">🧾</span>Check profile</button>
      <button class="info-act" onclick="copyUid('${escapeAttr(uid)}')"><span class="ic">🆔</span>Get UID</button>
      ${inGroup && hasKey ? `
        <button class="info-act danger" onclick="userAction('remove', '${escapeAttr(uid)}')"><span class="ic">🗑️</span>Xoá khỏi nhóm</button>
        <button class="info-act danger" onclick="userAction('blockgroup', '${escapeAttr(uid)}')"><span class="ic">⛔</span>Chặn khỏi nhóm</button>
        <button class="info-act" onclick="userAction('deputy', '${escapeAttr(uid)}')"><span class="ic">👑</span>Đặt phó nhóm</button>` : `
        <button class="info-act danger" onclick="userAction('block')"><span class="ic">🚫</span>Chặn người dùng</button>`}
    </div>
    ${inGroup && !hasKey ? '<div class="sub" style="margin-top:12px">Bot chưa cầm key nhóm này — chỉ có thể chặn người dùng, không xoá khỏi nhóm được.</div>' : ""}
  `;
}

function closeInfoModal() { $("infoModal").classList.remove("open"); }

function toastSoon() { toast("Tính năng này chưa hỗ trợ"); }

function isAdminGroup(id) {
  return (chatAdminGroups || []).includes(id);
}
async function toggleAdminGroup(id) {
  try {
    const res = await api("/api/chat/" + CHAT_BOT + "/toggle-admin-group", {
      method: "POST",
      body: JSON.stringify({ gid: id })
    });
    chatAdminGroups = res.groups || [];
    toast(chatAdminGroups.includes(id) ? "Đã đánh dấu bot cầm key 👑" : "Đã bỏ đánh dấu");
    openThreadInfo();
    renderThreadList();
  } catch (e) { toast(e.message); }
}

function copyUid(uid) {
  navigator.clipboard?.writeText(uid);
  toast("Đã copy UID: " + uid);
}
function isMuted(id) {
  try { return (JSON.parse(localStorage.getItem("jt_chat_muted") || "[]")).includes(id); } catch { return false; }
}
function toggleMute(id) {
  let muted = [];
  try { muted = JSON.parse(localStorage.getItem("jt_chat_muted") || "[]"); } catch { /* bo qua */ }
  muted = muted.includes(id) ? muted.filter((m) => m !== id) : [...muted, id];
  localStorage.setItem("jt_chat_muted", JSON.stringify(muted));
  toast(muted.includes(id) ? "Đã ẩn hội thoại khỏi panel" : "Đã bỏ ẩn");
  openThreadInfo();
  renderThreadList();
}

async function groupAction(action, uid) {
  const soon = () => toast("Tính năng này chưa hỗ trợ");
  if (action === "pin" || action === "priority" || action === "avatar") return soon();
  if (action === "info" || action === "viewmsgs") return soon();
  if (action === "pinned") return soon();
  // rời nhóm: ai cũng làm được; công cụ quản trị: chỉ khi bot cầm key
  if (action !== "leave" && !isAdminGroup(chatCurrent?.id)) return toast("Bot chưa cầm key nhóm này — không có công cụ quản trị");
  if (action === "rename") {
    const name = prompt("Tên mới cho nhóm:", chatCurrent?.name || "");
    if (!name || !name.trim()) return;
    try {
      await api("/api/chat/" + CHAT_BOT + "/action", { method: "POST", body: JSON.stringify({ action: "rename-group", threadId: chatCurrent.id, value: name.trim() }) });
      toast("Đã đổi tên nhóm");
      chatCurrent.name = name.trim();
      openThreadInfo();
    } catch (e) { toast(e.message); }
    return;
  }
  if (action === "adduser") {
    const target = (uid || (typeof $("memberUidInput") !== "undefined" && $("memberUidInput") ? $("memberUidInput").value : "") || "").trim();
    if (!target) return toast("Nhập UID cần thêm");
    try {
      await api("/api/chat/" + CHAT_BOT + "/action", { method: "POST", body: JSON.stringify({ action: "add-user", threadId: chatCurrent.id, uid: target }) });
      toast("Đã gửi lời mời thêm thành viên");
      openThreadInfo();
    } catch (e) { toast(e.message); }
    return;
  }
  if (action === "disperse") {
    if (!confirm("GIẢI TÁN nhóm này? KHÔNG hoàn tác được!")) return;
    if (!confirm("Chắc chắn chứ? Nhóm sẽ mất hoàn toàn.")) return;
    try {
      await api("/api/chat/" + CHAT_BOT + "/action", { method: "POST", body: JSON.stringify({ action: "disperse-group", threadId: chatCurrent.id }) });
      toast("Đã giải tán nhóm");
      closeInfoModal();
      loadThreads();
    } catch (e) { toast(e.message); }
    return;
  }
  if (action === "leave") {
    if (!confirm('Rời nhóm "' + chatCurrent?.name + '"? Hành động này thật trên Zalo.')) return;
    try {
      await api("/api/chat/" + CHAT_BOT + "/action", { method: "POST", body: JSON.stringify({ action: "leave-group", threadId: chatCurrent.id }) });
      toast("Đã rời nhóm");
      closeInfoModal();
      loadThreads();
    } catch (e) { toast(e.message); }
  }
}

async function userAction(action, uid) {
  const targetUid = uid || chatCurrent?.id;
  const soon = () => toast("Tính năng này chưa hỗ trợ");
  if (action === "check" || action === "addfriend" || action === "call") return soon();
  if (action === "deputy") {
    if (!confirm("Đặt " + targetUid + " làm phó nhóm?")) return;
    try {
      await api("/api/chat/" + CHAT_BOT + "/action", { method: "POST", body: JSON.stringify({ action: "set-deputy", threadId: chatCurrent.id, uid: targetUid }) });
      toast("Đã đặt phó nhóm");
      openThreadInfo();
    } catch (e) { toast(e.message); }
    return;
  }
  // xoá/chặn khỏi nhóm cần bot cầm key
  if (action === "remove" || action === "blockgroup") {
    if (chatCurrent?.isGroup && !isAdminGroup(chatCurrent.id)) return toast("Bot chưa cầm key nhóm này — không xoá/chặn thành viên được");
  }
  if (action === "block") {
    if (!confirm("Chặn người dùng " + targetUid + "? Hành động này thật trên Zalo.")) return;
    try {
      await api("/api/chat/" + CHAT_BOT + "/action", { method: "POST", body: JSON.stringify({ action: "block-user", uid: targetUid }) });
      toast("Đã chặn");
    } catch (e) { toast(e.message); }
  }
  if (action === "remove") {
    if (!confirm("Xoá " + targetUid + " khỏi nhóm? Hành động này thật trên Zalo.")) return;
    try {
      await api("/api/chat/" + CHAT_BOT + "/action", { method: "POST", body: JSON.stringify({ action: "remove-user", threadId: chatCurrent.id, uid: targetUid }) });
      toast("Đã xoá khỏi nhóm");
      openThreadInfo();
    } catch (e) { toast(e.message); }
  }
  if (action === "blockgroup") {
    if (!confirm("Chặn " + targetUid + " khỏi nhóm? Hành động này thật trên Zalo.")) return;
    try {
      await api("/api/chat/" + CHAT_BOT + "/action", { method: "POST", body: JSON.stringify({ action: "block-group-user", threadId: chatCurrent.id, uid: targetUid }) });
      toast("Đã chặn khỏi nhóm");
    } catch (e) { toast(e.message); }
  }
}

/* ---------- khởi động ---------- */
loadConfig();
loadChatStyle();
if (!TOKEN) toggleDrawer(); // lần đầu: mở sẵn ô cấu hình
refresh();
loadCommandList();
showView("bots");
