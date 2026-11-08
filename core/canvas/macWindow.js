const fs = require("fs");
const path = require("path");
const { createCanvas, Image } = require("canvas");

const THEME_IMAGE = path.join(__dirname, "..", "..", "assets", "bg", "theme.jpg");

function roundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function withMacWindow(content, title = "JOHN TRAN") {
  const scale = content.width / 750;
  const toolbarHeight = Math.round(44 * scale);
  const contentInset = Math.round(12 * scale);
  const contentWidth = content.width - contentInset * 2;
  const contentScale = contentWidth / content.width;
  const contentHeight = Math.round(content.height * contentScale);
  const radius = Math.round(18 * scale);
  const canvas = createCanvas(content.width, contentHeight + toolbarHeight + contentInset * 2);
  const ctx = canvas.getContext("2d");

  try {
    ctx.antialias = "best";
    ctx.quality = "best";
    ctx.patternQuality = "best";
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
  } catch { /* node-canvas versions may omit optional quality settings */ }

  roundedRect(ctx, 0.5, 0.5, canvas.width - 1, canvas.height - 1, radius);
  ctx.save();
  ctx.clip();
  const outer = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  outer.addColorStop(0, "#493126");
  outer.addColorStop(0.55, "#38241d");
  outer.addColorStop(1, "#261b19");
  ctx.fillStyle = outer;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (fs.existsSync(THEME_IMAGE)) {
    const image = new Image();
    image.src = fs.readFileSync(THEME_IMAGE);
    const imageScale = Math.max(canvas.width / image.width, canvas.height / image.height);
    const imageWidth = image.width * imageScale;
    const imageHeight = image.height * imageScale;
    ctx.globalAlpha = 0.16;
    ctx.drawImage(image, (canvas.width - imageWidth) / 2, (canvas.height - imageHeight) / 2, imageWidth, imageHeight);
    ctx.globalAlpha = 1;
    ctx.fillStyle = "rgba(57, 35, 27, .72)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  const cardX = contentInset - Math.max(1, Math.round(2 * scale));
  const cardY = toolbarHeight + contentInset - Math.max(1, Math.round(2 * scale));
  const cardWidth = contentWidth + Math.max(2, Math.round(4 * scale));
  const cardHeight = contentHeight + Math.max(2, Math.round(4 * scale));
  roundedRect(ctx, cardX, cardY, cardWidth, cardHeight, Math.round(14 * scale));
  ctx.fillStyle = "#08090d";
  ctx.fill();

  roundedRect(ctx, contentInset, toolbarHeight + contentInset, contentWidth, contentHeight, Math.round(11 * scale));
  ctx.save();
  ctx.clip();
  ctx.drawImage(content, contentInset, toolbarHeight + contentInset, contentWidth, contentHeight);
  ctx.restore();

  const toolbar = ctx.createLinearGradient(0, 0, 0, toolbarHeight);
  toolbar.addColorStop(0, "#52382b");
  toolbar.addColorStop(1, "#3b2922");
  ctx.fillStyle = toolbar;
  ctx.fillRect(0, 0, canvas.width, toolbarHeight);
  ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
  ctx.fillRect(0, toolbarHeight - Math.max(1, Math.round(scale)), canvas.width, Math.max(1, Math.round(scale)));

  const dotColors = ["#ff5f57", "#febc2e", "#28c840"];
  const dotRadius = 6 * scale;
  const firstDotX = 21 * scale;
  const dotY = toolbarHeight / 2;
  for (let i = 0; i < dotColors.length; i++) {
    const x = firstDotX + i * 20 * scale;
    ctx.beginPath();
    ctx.arc(x, dotY, dotRadius, 0, Math.PI * 2);
    ctx.fillStyle = dotColors[i];
    ctx.fill();
    ctx.strokeStyle = "rgba(0, 0, 0, 0.12)";
    ctx.lineWidth = Math.max(1, scale);
    ctx.stroke();
  }

  ctx.font = `500 ${Math.round(13 * scale)}px Arial`;
  ctx.fillStyle = "#f0e5df";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(title || "JOHN TRAN").slice(0, 48), canvas.width / 2, dotY);
  ctx.restore();

  ctx.strokeStyle = "rgba(30, 30, 35, 0.2)";
  ctx.lineWidth = Math.max(1, scale);
  roundedRect(ctx, 0.5, 0.5, canvas.width - 1, canvas.height - 1, radius);
  ctx.stroke();
  return canvas;
}

module.exports = { withMacWindow };
