// ===== Menu dạng lưới thẻ — dùng theme chung (core/canvas/theme.js) =====
const theme = require("./theme");

// Ảnh trong Zalo KHÔNG có nút bấm được nên footer ghi rõ lệnh để gõ.
// Đồng thời menu.js có handleEvent bắt "next"/"prev"/"out" (khỏi cần prefix).
async function renderMenuGrid({ botName, avatarUrl, prefix, page, totalPages, commands, uptimeText }) {
  const { ctx, canvas } = theme.newCanvas(theme.WIDTH, 1280);
  const W = theme.WIDTH;
  const { PALETTE, panel, button, text } = theme;

  await theme.paintBackground(ctx, W, 1280);

  // ===== Header =====
  text(ctx, "⚡", 40, 78, { font: "44px JT", color: PALETTE.accent });
  text(ctx, botName, W / 2, 78, { font: "bold 54px JT-Bold", color: PALETTE.ink, align: "center", maxWidth: W - 320 });
  text(
    ctx,
    `🕐 ${uptimeText}   •   🔑 Prefix: ${prefix}   •   📋 ${commands.total} lệnh`,
    W / 2, 122,
    { font: "22px JT", color: PALETTE.ink2, align: "center" }
  );

  // avatar tròn góc phải
  if (avatarUrl) {
    try {
      const { buffer } = await require("../http").getBuffer(avatarUrl, { timeout: 12000, retries: 1 });
      const { loadImage } = require("canvas");
      const img = await loadImage(buffer);
      const size = 104;
      const ax = W - 48 - size;
      ctx.save();
      ctx.beginPath();
      ctx.arc(ax + size / 2, 32 + size / 2, size / 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(img, ax, 32, size, size);
      ctx.restore();
      ctx.strokeStyle = PALETTE.accent;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(ax + size / 2, 32 + size / 2, size / 2 + 2, 0, Math.PI * 2);
      ctx.stroke();
    } catch { /* bỏ qua */ }
  }

  // ===== Lưới thẻ lệnh =====
  const cols = 3;
  const cardW = 384;
  const cardH = 170;
  const gapX = 24;
  const gapY = 20;
  const padX = (W - (cols * cardW + (cols - 1) * gapX)) / 2;
  const top = 160;

  commands.page.forEach((cmd, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    const x = padX + col * (cardW + gapX);
    const y = top + row * (cardH + gapY);

    panel(ctx, x, y, cardW, cardH);

    text(ctx, commandEmoji(cmd.name), x + 20, y + 48, { font: "28px JT" });
    text(ctx, cmd.name, x + 66, y + 46, { font: "bold 30px JT-Bold", color: PALETTE.ink, maxWidth: cardW - 96 });
    text(ctx, `*${prefix}${cmd.usage || cmd.name}`, x + 20, y + 92, { font: "18px JT", color: PALETTE.mute, maxWidth: cardW - 40 });
    text(ctx, cmd.category.toUpperCase(), x + 20, y + 128, { font: "bold 15px JT-Bold", color: PALETTE.accent2, maxWidth: cardW - 40 });
  });

  // ===== Footer điều hướng (nút vẽ để HƯỚNG DẪN, gõ lệnh mới chạy) =====
  const footY = 1040;
  button(ctx, padX, footY, 300, 52, "◀  PREV", PALETTE.gold);
  text(ctx, `Trang ${page} / ${totalPages}`, W / 2, footY + 34, { font: "bold 28px JT-Bold", color: PALETTE.ink, align: "center" });
  button(ctx, W - padX - 300, footY, 300, 52, "NEXT  ▶", PALETTE.green);

  text(
    ctx,
    `Gõ ${prefix}menu next (trang sau) • ${prefix}menu prev (trang trước) • ${prefix}menu <số> (nhảy trang) • ${prefix}menu out (đóng)`,
    W / 2, footY + 96,
    { font: "19px JT", color: PALETTE.ink2, align: "center" }
  );
  text(
    ctx,
    `💡 Gõ next / prev / out (không cần prefix) cũng chuyển trang được`,
    W / 2, footY + 128,
    { font: "18px JT", color: PALETTE.mute, align: "center" }
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
