const rustBridge = require("./rustBridge");
const fs = require("fs");
const path = require("path");
const { loadImage } = require("canvas");
const theme = require("./theme");

const COMMAND_ICONS = ["✦", "♪", "◆", "●", "▣", "⌘", "★", "◈", "✚", "▲", "♧", "◉"];
const CATEGORY_COLORS = ["#8b72e8", "#4b8ff5", "#e681b8", "#eebd43", "#58a9c8", "#a568d5"];
const BACKGROUND_IMAGE = path.join(__dirname, "..", "..", "assets", "bg", "theme.jpg");

async function renderMenuGrid({
  requesterName,
  requesterAvatarUrl,
  botVersion,
  prefix,
  page,
  totalPages,
  commands,
  totalCommands
}) {
  theme.initFonts();
  const S = theme.S;
  const W = theme.WIDTH;
  const { text, font, newCanvas } = theme;

  const cols = 3;
  const marginX = S(25);
  const gapX = S(10);
  const gapY = S(10);
  const headerH = S(66);
  const cardH = S(82);
  const footerH = S(82);
  const rows = Math.ceil(commands.length / cols);
  const cardW = (W - marginX * 2 - gapX * (cols - 1)) / cols;
  const H = headerH + rows * cardH + Math.max(0, rows - 1) * gapY + footerH;

  const { ctx, canvas } = newCanvas(W, H);
  await paintMenuBackground(ctx, W, H);

  const glow = ctx.createRadialGradient(W * 0.1, 0, 0, W * 0.1, 0, S(420));
  glow.addColorStop(0, "rgba(255, 216, 170, .08)");
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

  for (const [index, command] of commands.entries()) {
    const col = index % cols;
    const row = Math.floor(index / cols);
    const x = marginX + col * (cardW + gapX);
    const y = headerH + row * (cardH + gapY);
    const accent = categoryColor(command.category);

    drawCard(ctx, x, y, cardW, cardH, S);
    drawCommandIcon(ctx, x + S(12), y + S(20), S(42), COMMAND_ICONS[hash(command.name) % COMMAND_ICONS.length], accent, S);
    text(ctx, command.name, x + S(62), y + S(34), {
      size: 17,
      family: "JT-Round-Bold",
      color: "#fff",
      maxWidth: cardW - S(78)
    });
    text(ctx, `${prefix}${command.usage || command.name}`, x + S(62), y + S(54), {
      size: 11,
      family: "JT",
      color: "#c5cada",
      maxWidth: cardW - S(78)
    });
    text(ctx, command.category.toUpperCase(), x + S(62), y + S(71), {
      size: 9,
      family: "JT-Bold",
      color: accent,
      maxWidth: cardW - S(78)
    });
    text(ctx, "›", x + cardW - S(15), y + S(51), {
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
    totalCommands,
    page,
    totalPages,
    S,
    text
  });
  text(ctx, `Gõ next / prev để chuyển trang  ·  out để đóng`, W / 2, H - S(7), {
    size: 10,
    family: "JT",
    color: "#c5bdba",
    align: "center",
    maxWidth: W - S(36)
  });

  return theme.save(canvas, "menu");
}

async function paintMenuBackground(ctx, width, height) {
  const image = await loadImage(fs.readFileSync(BACKGROUND_IMAGE));
  const scale = Math.max(width / image.width, height / image.height);
  const imageWidth = image.width * scale;
  const imageHeight = image.height * scale;
  ctx.drawImage(image, (width - imageWidth) / 2, (height - imageHeight) / 2, imageWidth, imageHeight);

  const warmOverlay = ctx.createLinearGradient(0, 0, width, height);
  warmOverlay.addColorStop(0, "rgba(63, 39, 29, .92)");
  warmOverlay.addColorStop(0.52, "rgba(68, 42, 30, .94)");
  warmOverlay.addColorStop(1, "rgba(39, 29, 26, .94)");
  ctx.fillStyle = warmOverlay;
  ctx.fillRect(0, 0, width, height);
}

function drawCard(ctx, x, y, width, height, S) {
  theme.roundRect(ctx, x, y, width, height, S(12));
  ctx.fillStyle = "rgba(42, 48, 62, .96)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, .9)";
  ctx.lineWidth = Math.max(1, S(1));
  ctx.stroke();
}

function drawCommandIcon(ctx, x, y, size, icon, accent, S) {
  theme.roundRect(ctx, x, y, size, size, S(12));
  const gradient = ctx.createLinearGradient(x, y, x + size, y + size);
  gradient.addColorStop(0, accent);
  gradient.addColorStop(1, "#4e65bd");
  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.font = theme.font(22, "JT-Bold");
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(icon, x + size / 2, y + size / 2 + S(1));
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
}

function categoryColor(category) {
  return CATEGORY_COLORS[hash(String(category || "")) % CATEGORY_COLORS.length];
}

function hash(value) {
  let result = 0;
  for (let i = 0; i < value.length; i++) result = (result * 31 + value.charCodeAt(i)) >>> 0;
  return result;
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
