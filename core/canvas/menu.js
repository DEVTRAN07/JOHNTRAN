// ===== Menu dạng lưới thẻ (thiết kế ᴶᴼᴴᴺ ᵀᴿᴬᴺ) =====
const fs = require("fs");
const os = require("os");
const path = require("path");
const { createCanvas, registerFont, loadImage } = require("canvas");

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

// Màu viền thẻ xoay vòng theo tên lệnh (ổn định cho cùng một lệnh)
const CARD_COLORS = ["#22d3ee", "#a855f7", "#f97316", "#22c55e", "#f43f5e", "#3b82f6", "#eab308", "#14b8a6"];
function cardColor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return CARD_COLORS[Math.abs(hash) % CARD_COLORS.length];
}

const COMMAND_EMOJI = ["🔥", "🎵", "🎮", "🚀", "⭐", "🎲", "💎", "🧩", "📌", "🛠️", "💬", "📊", "🔧", "🎯", "🧠", "📥", "🎬", "🌐"];

function emojiFor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 17 + name.charCodeAt(i)) | 0;
  return COMMAND_EMOJI[Math.abs(hash) % COMMAND_EMOJI.length];
}

async function renderMenuGrid({ botName, avatarUrl, prefix, page, totalPages, commands, uptimeText }) {
  initFonts();
  const W = 1280;
  const headerH = 150;
  const cols = 3;
  const rows = 3;
  const perPage = cols * rows;
  const cardW = 380;
  const cardH = 190;
  const gapX = 25;
  const gapY = 22;
  const footerH = 130;
  const padX = (W - (cols * cardW + (cols - 1) * gapX)) / 2;
  const gridH = rows * cardH + (rows - 1) * gapY;
  const H = headerH + gridH + footerH;

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  // Nền
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#0a0d1a");
  bg.addColorStop(0.5, "#101527");
  bg.addColorStop(1, "#0a0d1a");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Glow
  const glow = (cx, cy, r, color) => {
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, color);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  };
  glow(120, 100, 300, "rgba(34, 211, 238, .12)");
  glow(W - 120, 100, 300, "rgba(168, 85, 247, .12)");

  // ===== Header =====
  // icon sét
  ctx.font = "46px Arial";
  ctx.fillText("⚡", padX + 20, 95);

  // tên bot
  ctx.font = "bold 58px Arial-Bold";
  ctx.fillStyle = "#ffffff";
  const title = truncate(ctx, botName, W - 300);
  ctx.textAlign = "center";
  ctx.fillText(title, W / 2 + 30, 98);
  ctx.textAlign = "left";

  // dòng thông tin
  ctx.font = "22px Arial";
  ctx.fillStyle = "#8b98ad";
  ctx.textAlign = "center";
  ctx.fillText(`🕐 ${uptimeText}   •   🔑 Prefix: ${prefix}   •   📋 Tất cả lệnh   •   ${commands.total} lệnh`, W / 2, 140);
  ctx.textAlign = "left";

  // avatar tròn góc phải
  if (avatarUrl) {
    try {
      const { buffer } = await require("../http").getBuffer(avatarUrl, { timeout: 12000, retries: 1 });
      const img = await loadImage(buffer);
      const size = 110;
      const ax = W - padX - size;
      const ay = 20;
      ctx.save();
      ctx.beginPath();
      ctx.arc(ax + size / 2, ay + size / 2, size / 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(img, ax, ay, size, size);
      ctx.restore();
      ctx.strokeStyle = "#22d3ee";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(ax + size / 2, ay + size / 2, size / 2 + 2, 0, Math.PI * 2);
      ctx.stroke();
    } catch { /* bỏ qua */ }
  }

  // ===== Grid thẻ lệnh =====
  commands.page.forEach((cmd, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    const x = padX + col * (cardW + gapX);
    const y = headerH + row * (cardH + gapY);
    const color = cardColor(cmd.name);

    // thẻ
    ctx.fillStyle = "rgba(16, 21, 39, 0.85)";
    rr(ctx, x, y, cardW, cardH, 16);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.75;
    ctx.stroke();
    ctx.globalAlpha = 1;

    // emoji
    ctx.font = "30px Arial";
    ctx.fillText(emojiFor(cmd.name), x + 18, y + 45);

    // tên lệnh
    ctx.font = "bold 32px Arial-Bold";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(truncate(ctx, cmd.name, cardW - 90), x + 62, y + 45);

    // mô tả/cách dùng
    ctx.font = "18px Arial";
    ctx.fillStyle = "#7c8aa5";
    ctx.fillText(truncate(ctx, `*${prefix}${cmd.usage || cmd.name}`, cardW - 40), x + 20, y + 95);

    // nút MEM
    const btnW = 62, btnH = 26;
    const bx = x + cardW - btnW - 14;
    const by = y + cardH - btnH - 14;
    ctx.fillStyle = "rgba(34, 211, 238, .15)";
    rr(ctx, bx, by, btnW, btnH, 13);
    ctx.fill();
    ctx.strokeStyle = "rgba(34, 211, 238, .5)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.font = "bold 13px Arial-Bold";
    ctx.fillStyle = "#22d3ee";
    ctx.textAlign = "center";
    ctx.fillText("MEM", bx + btnW / 2, by + 18);
    ctx.textAlign = "left";
  });

  // ===== Footer =====
  const footY = H - footerH + 20;

  // nút NEXT
  const btnH = 50;
  ctx.fillStyle = "rgba(34, 197, 94, .18)";
  rr(ctx, padX, footY, 420, btnH, 12);
  ctx.fill();
  ctx.strokeStyle = "rgba(34, 197, 94, .6)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.font = "bold 22px Arial-Bold";
  ctx.fillStyle = "#22c55e";
  ctx.textAlign = "center";
  ctx.fillText(`▶  NEXT`, padX + 210, footY + 33);

  // số trang
  ctx.font = "bold 24px Arial-Bold";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(`Trang ${page} / ${totalPages}`, W / 2, footY + 33);

  // nút OUT
  const outW = 420;
  ctx.fillStyle = "rgba(244, 63, 94, .15)";
  rr(ctx, W - padX - outW, footY, outW, btnH, 12);
  ctx.fill();
  ctx.strokeStyle = "rgba(244, 63, 94, .55)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.font = "bold 22px Arial-Bold";
  ctx.fillStyle = "#f43f5e";
  ctx.fillText(`✕  OUT`, W - padX - outW / 2, footY + 33);

  // ghi chú
  ctx.font = "18px Arial";
  ctx.fillStyle = "#5c6a85";
  ctx.fillText(`*${prefix}menu mode text / canvas`, W / 2, footY + btnH + 35);
  ctx.textAlign = "left";

  const filePath = path.join(os.tmpdir(), `jt_menu_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.png`);
  fs.writeFileSync(filePath, canvas.toBuffer("image/png"));
  return filePath;
}

module.exports = { renderMenuGrid };
