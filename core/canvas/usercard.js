// ===== Thẻ thông tin người dùng (thiết kế ᴶᴼᴴᴺ ᵀᴿᴬᴺ) =====
const fs = require("fs");
const os = require("os");
const path = require("path");
const { createCanvas, registerFont, loadImage } = require("canvas");
const http = require("../http");

let fontsReady = false;
function initFonts() {
  if (fontsReady) return;
  fontsReady = true;
  const register = (p, family) => { try { if (fs.existsSync(p)) registerFont(p, { family }); } catch { /* bỏ qua */ } };
  const platform = process.platform;
  if (platform === "darwin") {
    register("/System/Library/Fonts/Supplemental/Arial.ttf", "Arial");
    register("/System/Library/Fonts/Supplemental/Arial Bold.ttf", "Arial-Bold");
  } else if (platform === "win32") {
    register("C:\\Windows\\Fonts\\arial.ttf", "Arial");
    register("C:\\Windows\\Fonts\\arialbd.ttf", "Arial-Bold");
  } else {
    register("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "Arial");
    register("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", "Arial-Bold");
  }
}

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function truncate(ctx, text, maxWidth) {
  let t = String(text ?? "");
  if (ctx.measureText(t).width <= maxWidth) return t;
  while (t.length > 1 && ctx.measureText(t + "…").width > maxWidth) t = t.slice(0, -1);
  return t + "…";
}

async function loadAvatar(url) {
  if (!url) return null;
  try {
    const { buffer } = await http.getBuffer(url, { timeout: 12000, retries: 1 });
    return loadImage(buffer);
  } catch {
    return null;
  }
}

function genderText(gender) {
  if (gender === 1 || gender === "1") return "Nam";
  if (gender === 2 || gender === "2") return "Nữ";
  return "Không công khai";
}

function saveTemp(canvas, prefix) {
  const filePath = path.join(os.tmpdir(), `jt_${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.png`);
  fs.writeFileSync(filePath, canvas.toBuffer("image/png"));
  return filePath;
}

/* ================= CARD USER — thẻ dọc ================= */
async function renderCardUser({ user }) {
  initFonts();
  const W = 900, H = 620;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#0b1220");
  bg.addColorStop(1, "#152244");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const glow = ctx.createRadialGradient(W / 2, 0, 0, W / 2, 0, 420);
  glow.addColorStop(0, "rgba(34,211,238,.18)");
  glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // avatar tròn lớn ở giữa-trên
  const avatarSize = 250;
  const ax = (W - avatarSize) / 2;
  const ay = 55;
  const avatar = await loadAvatar(user.avatar);
  ctx.save();
  ctx.beginPath();
  ctx.arc(ax + avatarSize / 2, ay + avatarSize / 2, avatarSize / 2 + 8, 0, Math.PI * 2);
  ctx.fillStyle = "#0f172a";
  ctx.shadowColor = "rgba(34,211,238,.8)";
  ctx.shadowBlur = 45;
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.arc(ax + avatarSize / 2, ay + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
  ctx.clip();
  if (avatar) ctx.drawImage(avatar, ax, ay, avatarSize, avatarSize);
  else {
    ctx.fillStyle = "#1f2937";
    ctx.fillRect(ax, ay, avatarSize, avatarSize);
  }
  ctx.restore();

  ctx.strokeStyle = "rgba(34,211,238,.9)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(ax + avatarSize / 2, ay + avatarSize / 2, avatarSize / 2 + 4, 0, Math.PI * 2);
  ctx.stroke();

  // tên
  ctx.font = "bold 44px Arial-Bold";
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.fillText(truncate(ctx, user.displayName || user.zaloName || "Người dùng", W - 120), W / 2, ay + avatarSize + 65);
  ctx.textAlign = "left";

  // ── dòng thông tin trên thẻ ──
  const rows = [
    ["ID", String(user.userId || user.uid || "—")],
    ["Giới tính", genderText(user.gender)],
    ["Sinh nhật", user.sdob || "Không công khai"],
    ["Bio", user.status ? truncate(ctx, user.status, W - 260) : "Không có"],
    ["Trạng thái", user.isActive ? "🟢 Đang hoạt động" : "⚪ Không hoạt động"]
  ];

  let y = ay + avatarSize + 118;
  for (const [label, value] of rows) {
    ctx.fillStyle = "rgba(255,255,255,.05)";
    rr(ctx, 70, y - 30, W - 140, 46, 10);
    ctx.fill();
    ctx.font = "bold 22px Arial-Bold";
    ctx.fillStyle = "#22d3ee";
    ctx.fillText(`${label}:`, 92, y);
    ctx.font = "22px Arial";
    ctx.fillStyle = "#cbd5e1";
    ctx.fillText(value, 260, y);
    y += 58;
  }

  // chân thẻ
  ctx.font = "bold 18px Arial-Bold";
  ctx.fillStyle = "rgba(34,211,238,.75)";
  ctx.textAlign = "center";
  ctx.fillText("ᴶᴼᴴᴺ ᵀᴿᴬᴺ • USER CARD", W / 2, H - 22);

  return saveTemp(canvas, "carduser");
}

/* ================= CARD INFO — thẻ ngang ================= */
async function renderCardInfo({ user }) {
  initFonts();
  const W = 1000, H = 460;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#120e22");
  bg.addColorStop(1, "#1d1638");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const glow = ctx.createRadialGradient(W, 0, 0, W, 0, 460);
  glow.addColorStop(0, "rgba(168,85,247,.16)");
  glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // viền
  ctx.strokeStyle = "rgba(168,85,247,.45)";
  ctx.lineWidth = 2;
  rr(ctx, 14, 14, W - 28, H - 28, 26);
  ctx.stroke();

  // avatar bên phải
  const avatarSize = 300;
  const ax = W - avatarSize - 60;
  const ay = (H - avatarSize) / 2;
  const avatar = await loadAvatar(user.avatar);

  ctx.save();
  ctx.beginPath();
  ctx.arc(ax + avatarSize / 2, ay + avatarSize / 2, avatarSize / 2 + 8, 0, Math.PI * 2);
  ctx.fillStyle = "#1a1330";
  ctx.shadowColor = "rgba(168,85,247,.7)";
  ctx.shadowBlur = 40;
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.beginPath();
  ctx.arc(ax + avatarSize / 2, ay + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
  ctx.clip();
  if (avatar) ctx.drawImage(avatar, ax, ay, avatarSize, avatarSize);
  else {
    ctx.fillStyle = "#241a3d";
    ctx.fillRect(ax, ay, avatarSize, avatarSize);
  }
  ctx.restore();

  // thông tin bên trái
  const textX = 60;
  ctx.font = "bold 42px Arial-Bold";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(truncate(ctx, user.displayName || user.zaloName || "Người dùng", avatarSize - 90), textX, 108);

  const rows = [
    ["Giới tính", genderText(user.gender)],
    ["Sinh nhật", user.sdob || "Không công khai"],
    ["Bio", user.status ? truncate(ctx, user.status, avatarSize - 120) : "Không có"],
    ["UID", String(user.userId || user.uid || "—")]
  ];

  let y = 175;
  for (const [label, value] of rows) {
    ctx.font = "bold 22px Arial-Bold";
    ctx.fillStyle = "#a855f7";
    ctx.fillText(`${label}:`, textX, y);
    ctx.font = "22px Arial";
    ctx.fillStyle = "#cbd5e1";
    ctx.fillText(String(value), textX + 150, y);
    y += 56;
  }

  ctx.font = "17px Arial";
  ctx.fillStyle = "rgba(168,85,247,.6)";
  ctx.fillText("ᴶᴼᴴᴺ ᵀᴿᴬᴺ • CARD INFO", textX, H - 32);

  return saveTemp(canvas, "cardinfo");
}

module.exports = { renderCardUser, renderCardInfo };
