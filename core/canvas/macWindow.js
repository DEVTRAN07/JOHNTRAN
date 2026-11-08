const { createCanvas } = require("canvas");

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
  const radius = Math.round(18 * scale);
  const canvas = createCanvas(content.width, content.height + toolbarHeight);
  const ctx = canvas.getContext("2d");

  roundedRect(ctx, 0.5, 0.5, canvas.width - 1, canvas.height - 1, radius);
  ctx.save();
  ctx.clip();
  ctx.fillStyle = "#f4f4f6";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(content, 0, toolbarHeight);

  const toolbar = ctx.createLinearGradient(0, 0, 0, toolbarHeight);
  toolbar.addColorStop(0, "#fafafc");
  toolbar.addColorStop(1, "#e9e9ed");
  ctx.fillStyle = toolbar;
  ctx.fillRect(0, 0, canvas.width, toolbarHeight);
  ctx.fillStyle = "rgba(25, 25, 30, 0.14)";
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
  ctx.fillStyle = "#55555a";
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
