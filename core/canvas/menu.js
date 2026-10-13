// ===== Menu dạng lưới thẻ — dùng theme chung (core/canvas/theme.js) =====
// Mọi kích thước viết theo cỡ 750 rồi scale theo theme.WIDTH (config canvas.width).
const fs = require("fs");
const theme = require("./theme");

// Ảnh trong Zalo KHÔNG có nút bấm được nên footer ghi rõ lệnh để gõ.
// Đồng thời menu.js có handleEvent bắt "next"/"prev"/"out" (khỏi cần prefix).
async function renderMenuGrid({ botName, avatarUrl, prefix, page, totalPages, commands, uptimeText }) {
  theme.initFonts();
  const S = theme.S;
  const W = theme.WIDTH;
  const { PALETTE, panel, button, text, font, label, foil, randomAccent } = theme;

  // ===== Bố cục: 9 lệnh/trang, 3 CỘT x 3 HÀNG (vuông, không dài) =====
  const perPage = 9;
  const cols = 3; // 3x3 — 2 cột trước đây thành ảnh cao và dài
  const rows = Math.ceil(Math.min(commands.page.length, perPage) / cols);
  const cardW = (W - S(50) - S(24) * (cols - 1)) / cols;
  const cardH = S(142);
  const gapX = S(22);
  const gapY = S(14);
  const headerH = S(104);
  const footerH = S(126);
  const H = headerH + rows * cardH + Math.max(0, rows - 1) * gapY + footerH;

  const { ctx, canvas } = theme.newCanvas(W, H);
  await theme.paintBackground(ctx, W, H);

  // ===== Header: icon + tên bot (font Display) + info (font Mono) =====
  label(ctx, "ᴶᴼᴴᴺ ᵀᴿᴬᴺ • MENU", W / 2, S(34), { align: "center", size: 14 });
  text(ctx, botName, W / 2, S(66), { size: 33, family: "JT-Display-Bold", color: PALETTE.ink, align: "center", maxWidth: W - S(150) });
  foil(ctx, W / 2 - S(60), S(78), S(120));
  ctx.font = font(17, "JT-Mono");
  ctx.fillStyle = PALETTE.ink2;
  ctx.textAlign = "center";
  ctx.fillText(`🕐 ${uptimeText}  •  🔑 ${prefix}  •  📋 ${commands.total} lệnh`, W / 2, S(82));
  ctx.textAlign = "left";

  // avatar tròn góc phải
  if (avatarUrl) {
    try {
      const { buffer } = await require("../http").getBuffer(avatarUrl, { timeout: 12000, retries: 1 });
      const { loadImage } = require("canvas");
      const img = await loadImage(buffer);
      const size = S(64);
      const ax = W - S(22) - size;
      ctx.save();
      ctx.beginPath();
      ctx.arc(ax + size / 2, S(16) + size / 2, size / 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(img, ax, S(16), size, size);
      ctx.restore();
      ctx.strokeStyle = PALETTE.accent;
      ctx.lineWidth = S(2.5);
      ctx.beginPath();
      ctx.arc(ax + size / 2, S(16) + size / 2, size / 2 + 2, 0, Math.PI * 2);
      ctx.stroke();
    } catch { /* bỏ qua */ }
  }

  // ===== Lưới thẻ lệnh =====
  const shown = commands.page.slice(0, perPage);
  shown.forEach((cmd, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    const x = S(25) + col * (cardW + gapX);
    const y = headerH + row * (cardH + gapY);

    panel(ctx, x, y, cardW, cardH, S(14));

    // emoji + tên lệnh (font Round cho thân thiện)
    text(ctx, commandEmoji(cmd.name), x + S(16), y + S(40), { size: 24 });
    text(ctx, cmd.name, x + S(52), y + S(38), { size: 19, family: "JT-Round-Bold", color: PALETTE.ink, maxWidth: cardW - S(76) });

    // cách dùng (font Mono cho rõ prefix)
    text(ctx, `*${prefix}${cmd.usage || cmd.name}`, x + S(16), y + S(76), { size: 12, family: "JT-Mono", color: PALETTE.mute, maxWidth: cardW - S(32) });

    // nhóm lệnh
    text(ctx, cmd.category.toUpperCase(), x + S(16), y + S(108), { size: 11, family: "JT-Bold", color: PALETTE.accent2, maxWidth: cardW - S(32) });
  });

  // ===== Footer điều hướng: dòng "Trang x/y" + 3 nút =====
  const footY = H - footerH + S(4);
  const btnW = (W - S(50) - S(20)) / 3;
  const navColors = randomAccent();
  text(ctx, `Trang ${page}/${totalPages}`, W / 2, footY + S(24), { size: 20, family: "JT-Bold", color: PALETTE.ink, align: "center" });
  const btnY = footY + S(38);
  button(ctx, S(25), btnY, btnW, S(42), `◀ PREV`, navColors.prev);
  button(ctx, S(25) + btnW + S(10), btnY, btnW - S(10), S(42), `✕ OUT`, navColors.out);
  button(ctx, S(25) + btnW * 2 + S(20), btnY, btnW, S(42), `NEXT ▶`, navColors.next);

  text(
    ctx,
    `» ${prefix}menu next • prev • <số> • out  —  hoặc gõ trần next / prev / out`,
    W / 2, footY + S(92),
    { size: 14, family: "JT-Mono", color: PALETTE.ink2, align: "center" }
  );

  return theme.save(canvas, "menu");
}

const COMMAND_EMOJI = ["✚", "★", "♪", "▲", "●", "◆", "■", "♞", "✦", "♦", "⬢", "✿", "☰", "◈", "⬟", "✵", "◉", "▶", "✜", "✱", "❖", "☀", "☂", "☑", "✂"];
function commandEmoji(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 17 + name.charCodeAt(i)) | 0;
  return COMMAND_EMOJI[Math.abs(hash) % COMMAND_EMOJI.length];
}

module.exports = { renderMenuGrid };
