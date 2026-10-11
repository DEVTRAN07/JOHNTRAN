// ===== Menu dạng lưới thẻ — cỡ 750px (Zalo giữ nguyên PNG, chữ sắc) =====
// Dùng theme chung (core/canvas/theme.js) cho nền/font/bo góc.
const theme = require("./theme");

// Ảnh trong Zalo KHÔNG có nút bấm được nên footer ghi rõ lệnh để gõ.
// Đồng thời menu.js có handleEvent bắt "next"/"prev"/"out" (khỏi cần prefix).
async function renderMenuGrid({ botName, avatarUrl, prefix, page, totalPages, commands, uptimeText }) {
  theme.initFonts();
  const W = theme.WIDTH;
  const { PALETTE, panel, button, text } = theme;

  // ===== Bố cục 2 cột × 4 hàng = 8 lệnh/trang, thẻ vừa đủ chữ đọc trên điện thoại =====
  const perPage = 8;
  const cols = 2;
  const rows = Math.ceil(Math.min(commands.page.length, perPage) / cols);
  const cardW = (W - 36 - 18) / cols; // 36px lề + 18px khe giữa 2 cột
  const cardH = 148;
  const gapX = 18;
  const gapY = 14;
  const headerH = 118;
  const footerH = 132;
  const H = headerH + rows * cardH + Math.max(0, rows - 1) * gapY + footerH;

  const { ctx, canvas } = theme.newCanvas(W, H);
  await theme.paintBackground(ctx, W, H);

  // ===== Header =====
  text(ctx, "⚡", 22, 56, { font: "34px JT", color: PALETTE.accent });
  text(ctx, botName, W / 2, 56, { font: "bold 38px JT-Bold", color: PALETTE.ink, align: "center", maxWidth: W - 150 });
  text(
    ctx,
    `🕐 ${uptimeText}  •  🔑 ${prefix}  •  📋 ${commands.total} lệnh`,
    W / 2, 92,
    { font: "17px JT", color: PALETTE.ink2, align: "center" }
  );

  // avatar tròn góc phải
  if (avatarUrl) {
    try {
      const { buffer } = await require("../http").getBuffer(avatarUrl, { timeout: 12000, retries: 1 });
      const { loadImage } = require("canvas");
      const img = await loadImage(buffer);
      const size = 78;
      const ax = W - 22 - size;
      ctx.save();
      ctx.beginPath();
      ctx.arc(ax + size / 2, 20 + size / 2, size / 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(img, ax, 20, size, size);
      ctx.restore();
      ctx.strokeStyle = PALETTE.accent;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(ax + size / 2, 20 + size / 2, size / 2 + 2, 0, Math.PI * 2);
      ctx.stroke();
    } catch { /* bỏ qua */ }
  }

  // ===== Lưới thẻ lệnh =====
  const shown = commands.page.slice(0, perPage);
  shown.forEach((cmd, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    const x = 22 + col * (cardW + gapX);
    const y = headerH + row * (cardH + gapY);

    panel(ctx, x, y, cardW, cardH, 14);

    // emoji + tên lệnh
    text(ctx, commandEmoji(cmd.name), x + 16, y + 44, { font: "26px JT" });
    text(ctx, cmd.name, x + 56, y + 42, { font: "bold 25px JT-Bold", color: PALETTE.ink, maxWidth: cardW - 80 });

    // cách dùng
    text(ctx, `*${prefix}${cmd.usage || cmd.name}`, x + 16, y + 84, { font: "16px JT", color: PALETTE.mute, maxWidth: cardW - 32 });

    // nhóm lệnh
    text(ctx, cmd.category.toUpperCase(), x + 16, y + 118, { font: "bold 13px JT-Bold", color: PALETTE.accent2, maxWidth: cardW - 32 });
  });

  // ===== Footer điều hướng =====
  const footY = H - footerH + 16;
  const btnW = (W - 44 - 20) / 3;
  button(ctx, 22, footY, btnW, 46, "⬅ PREV", PALETTE.gold);
  text(ctx, `📄 ${page}/${totalPages}`, W / 2, footY + 30, { font: "bold 22px JT-Bold", color: PALETTE.ink, align: "center" });
  button(ctx, 22 + btnW * 2 + 20, footY, btnW, 46, "NEXT ➡", PALETTE.green);
  button(ctx, 22 + btnW + 10, footY, btnW - 10, 46, "❌ OUT", PALETTE.red);

  text(
    ctx,
    `⌨️ ${prefix}menu next • prev • <số> • out  (hoặc gõ trần next/prev/out)`,
    W / 2, footY + 86,
    { font: "15px JT", color: PALETTE.ink2, align: "center" }
  );
  text(
    ctx,
    `💡 Gõ trần next / prev / out (khỏi prefix) — nhớ gõ /menu trước đã nhé`,
    W / 2, footY + 110,
    { font: "14px JT", color: PALETTE.mute, align: "center" }
  );

  return theme.save(canvas, "menu");
}

const COMMAND_EMOJI = ["🔥", "🎵", "🎮", "🚀", "⭐", "🎲", "💎", "🧩", "📌", "🛠️", "💬", "📊", "🔧", "🎯", "🧠", "📥", "🎬", "🌐"];
function commandEmoji(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 17 + name.charCodeAt(i)) | 0;
  return COMMAND_EMOJI[Math.abs(hash) % COMMAND_EMOJI.length];
}

module.exports = { renderMenuGrid };
