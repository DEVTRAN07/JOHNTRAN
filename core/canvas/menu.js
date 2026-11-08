const theme = require("./theme");

const CATEGORY_STYLES = [
  { icon: "i", color: "#8b72e8" },
  { icon: "✦", color: "#4b8ff5" },
  { icon: "♪", color: "#e681b8" },
  { icon: "G", color: "#6d788c" },
  { icon: "▣", color: "#eebd43" },
  { icon: "›_", color: "#62666e" },
  { icon: "S", color: "#547eea" },
  { icon: "⚙", color: "#9196a0" },
  { icon: "A", color: "#8567dc" },
  { icon: "M", color: "#58a9c8" },
  { icon: "H", color: "#a568d5" }
];

async function renderMenuGrid({
  requesterName,
  requesterAvatarUrl,
  botVersion,
  prefix,
  page,
  totalPages,
  categories,
  totalCommands
}) {
  theme.initFonts();
  const S = theme.S;
  const W = theme.WIDTH;
  const { text, font, newCanvas } = theme;

  const cols = 3;
  const marginX = S(24);
  const gapX = S(10);
  const gapY = S(10);
  const headerH = S(66);
  const cardH = S(82);
  const footerH = S(82);
  const rows = Math.ceil(categories.length / cols);
  const cardW = (W - marginX * 2 - gapX * (cols - 1)) / cols;
  const H = headerH + rows * cardH + Math.max(0, rows - 1) * gapY + footerH;

  const { ctx, canvas } = newCanvas(W, H);
  const background = ctx.createLinearGradient(0, 0, W, H);
  background.addColorStop(0, "#35251f");
  background.addColorStop(0.52, "#42281d");
  background.addColorStop(1, "#281d1a");
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, W, H);

  const glow = ctx.createRadialGradient(W * 0.1, 0, 0, W * 0.1, 0, S(420));
  glow.addColorStop(0, "rgba(255, 216, 170, .11)");
  glow.addColorStop(1, "rgba(255, 216, 170, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  text(ctx, "Tất cả lệnh", marginX, S(42), {
    size: 29,
    family: "JT-Round-Bold",
    color: "#fffaf5"
  });
  drawClock(ctx, W - marginX - S(100), S(23), S(18), "#d8dce6");
  const time = new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh"
  }).format(new Date());
  text(ctx, time, W - marginX, S(42), {
    size: 19,
    family: "JT-Bold",
    color: "#d8dce6",
    align: "right"
  });

  for (const [index, category] of categories.entries()) {
    const col = index % cols;
    const row = Math.floor(index / cols);
    const x = marginX + col * (cardW + gapX);
    const y = headerH + row * (cardH + gapY);
    const style = CATEGORY_STYLES[index % CATEGORY_STYLES.length];

    drawCard(ctx, x, y, cardW, cardH, S);
    drawCategoryIcon(ctx, x + S(12), y + S(20), S(42), style, S);

    text(ctx, category.name, x + S(62), y + S(34), {
      size: 18,
      family: "JT-Round-Bold",
      color: "#fff",
      maxWidth: cardW - S(78)
    });

    const examples = category.commands.slice(0, 2).map((command) => command.name);
    const more = category.commands.length - examples.length;
    const commandSummary = examples.join(" · ") + (more > 0 ? ` +${more}` : "");
    text(ctx, commandSummary || `${category.commands.length} lệnh`, x + S(62), y + S(53), {
      size: 12,
      family: "JT",
      color: "#c5cada",
      maxWidth: cardW - S(76)
    });

    text(ctx, `${category.commands.length} lệnh`, x + S(62), y + S(70), {
      size: 10,
      family: "JT-Bold",
      color: style.color,
      maxWidth: cardW - S(76)
    });

    text(ctx, "›", x + cardW - S(15), y + S(53), {
      size: 20,
      family: "JT",
      color: "#aeb7c9",
      align: "center"
    });
  }

  const footerY = H - footerH + S(4);
  await drawFooter(ctx, {
    x: marginX,
    y: footerY,
    width: W - marginX * 2,
    height: S(58),
    requesterName,
    requesterAvatarUrl,
    botVersion,
    prefix,
    totalCommands,
    page,
    totalPages,
    S,
    text
  });
  text(ctx, `Gõ ${prefix}menu all để xem đầy đủ  ·  ${prefix}menu next / prev để chuyển trang`, W / 2, H - S(7), {
    size: 10,
    family: "JT",
    color: "#c5bdba",
    align: "center",
    maxWidth: W - S(36)
  });

  return theme.save(canvas, "menu");
}

function drawCard(ctx, x, y, width, height, S) {
  theme.roundRect(ctx, x, y, width, height, S(12));
  ctx.fillStyle = "rgba(42, 48, 62, .96)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, .9)";
  ctx.lineWidth = Math.max(1, S(1));
  ctx.stroke();
}

function drawCategoryIcon(ctx, x, y, size, style, S) {
  const radius = S(12);
  theme.roundRect(ctx, x, y, size, size, radius);
  const gradient = ctx.createLinearGradient(x, y, x + size, y + size);
  gradient.addColorStop(0, style.color);
  gradient.addColorStop(1, "#4e65bd");
  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.font = theme.font(22, "JT-Bold");
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(style.icon, x + size / 2, y + size / 2 + S(1));
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
}

function drawClock(ctx, x, y, size, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, size * 0.1);
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size * 0.44, 0, Math.PI * 2);
  ctx.moveTo(x + size / 2, y + size * 0.22);
  ctx.lineTo(x + size / 2, y + size * 0.51);
  ctx.lineTo(x + size * 0.7, y + size * 0.58);
  ctx.stroke();
  ctx.restore();
}

async function drawFooter(ctx, {
  x,
  y,
  width,
  height,
  requesterName,
  requesterAvatarUrl,
  botVersion,
  totalCommands,
  page,
  totalPages,
  S,
  text
}) {
  theme.roundRect(ctx, x, y, width, height, S(14));
  ctx.fillStyle = "rgba(19, 21, 28, .96)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, .88)";
  ctx.lineWidth = Math.max(1, S(1));
  ctx.stroke();

  const avatarSize = S(42);
  const avatarX = x + S(12);
  const avatarY = y + (height - avatarSize) / 2;
  await drawAvatar(ctx, requesterAvatarUrl, avatarX, avatarY, avatarSize);

  text(ctx, requesterName || "Người dùng", avatarX + avatarSize + S(10), y + S(35), {
    size: 17,
    family: "JT-Round-Bold",
    color: "#fff",
    maxWidth: width * 0.47
  });
  text(ctx, `${totalCommands} lệnh`, avatarX + avatarSize + S(10), y + S(51), {
    size: 11,
    family: "JT",
    color: "#c5cada"
  });

  text(ctx, `v${botVersion}`, x + width - S(12), y + S(26), {
    size: 13,
    family: "JT-Bold",
    color: "#d8dce6",
    align: "right"
  });
  text(ctx, `Trang ${page}/${totalPages}`, x + width - S(12), y + S(46), {
    size: 11,
    family: "JT",
    color: "#aeb7c9",
    align: "right"
  });
}

async function drawAvatar(ctx, avatarUrl, x, y, size) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = "#626a79";
  ctx.fillRect(x, y, size, size);

  if (avatarUrl) {
    try {
      const { buffer } = await require("../http").getBuffer(avatarUrl, { timeout: 12000, retries: 1 });
      const { loadImage } = require("canvas");
      const img = await loadImage(buffer);
      ctx.drawImage(img, x, y, size, size);
    } catch { /* use the fallback avatar */ }
  }

  ctx.restore();
}

module.exports = { renderMenuGrid };
