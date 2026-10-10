// Icon vector vẽ tay trên canvas — không phụ thuộc font emoji (chạy tốt trên mọi OS)

function drawMusicNote(ctx, x, y, size, color) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2, size * 0.09);
  const s = size / 24;
  ctx.beginPath();
  ctx.ellipse(x + 4 * s, y + 18 * s, 4 * s, 3 * s, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x + 7.5 * s, y + 18 * s);
  ctx.lineTo(x + 7.5 * s, y + 3 * s);
  ctx.lineTo(x + 17 * s, y + 5 * s);
  ctx.lineTo(x + 17 * s, y + 18 * s);
  ctx.lineTo(x + 14.5 * s, y + 18 * s);
  ctx.stroke();
  ctx.restore();
}

function drawUser(ctx, x, y, size, color) {
  ctx.save();
  ctx.fillStyle = color;
  const s = size / 24;
  ctx.beginPath();
  ctx.arc(x + 12 * s, y + 8 * s, 5 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + 12 * s, y + 20 * s, 8.5 * s, Math.PI * 1.05, Math.PI * 1.95);
  ctx.lineTo(x + 3.5 * s, y + 20 * s);
  ctx.arc(x + 12 * s, y + 20 * s, 8.5 * s, Math.PI * 1.95, Math.PI * 1.05, true);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawClock(ctx, x, y, size, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2, size * 0.1);
  const s = size / 24;
  ctx.beginPath();
  ctx.arc(x + 12 * s, y + 12 * s, 9.5 * s, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + 12 * s, y + 12 * s);
  ctx.lineTo(x + 12 * s, y + 7 * s);
  ctx.moveTo(x + 12 * s, y + 12 * s);
  ctx.lineTo(x + 16 * s, y + 13.5 * s);
  ctx.stroke();
  ctx.restore();
}

function drawSearch(ctx, x, y, size, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2, size * 0.11);
  const s = size / 24;
  ctx.beginPath();
  ctx.arc(x + 10.5 * s, y + 10.5 * s, 6.5 * s, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + 15.5 * s, y + 15.5 * s);
  ctx.lineTo(x + 20.5 * s, y + 20.5 * s);
  ctx.stroke();
  ctx.restore();
}

function drawSpark(ctx, x, y, size, color) {
  ctx.save();
  ctx.fillStyle = color;
  const s = size / 24;
  ctx.beginPath();
  ctx.moveTo(x + 12 * s, y + 1 * s);
  ctx.lineTo(x + 14.5 * s, y + 9 * s);
  ctx.lineTo(x + 22.5 * s, y + 11 * s);
  ctx.lineTo(x + 15.5 * s, y + 15 * s);
  ctx.lineTo(x + 17.5 * s, y + 23 * s);
  ctx.lineTo(x + 12 * s, y + 18 * s);
  ctx.lineTo(x + 6.5 * s, y + 23 * s);
  ctx.lineTo(x + 8.5 * s, y + 15 * s);
  ctx.lineTo(x + 1.5 * s, y + 11 * s);
  ctx.lineTo(x + 9.5 * s, y + 9 * s);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawList(ctx, x, y, size, color) {
  ctx.save();
  ctx.fillStyle = color;
  const s = size / 24;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(x + 4 * s, y + (5 + i * 7) * s, 1.8 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(x + 8 * s, y + (4 + i * 7) * s, 11 * s, 2.4 * s);
  }
  ctx.restore();
}

function drawHeart(ctx, x, y, size, color) {
  ctx.save();
  ctx.fillStyle = color;
  const s = size / 24;
  ctx.beginPath();
  ctx.moveTo(x + 12 * s, y + 21 * s);
  ctx.bezierCurveTo(x + 2 * s, y + 14 * s, x + 5 * s, y + 4 * s, x + 12 * s, y + 9 * s);
  ctx.bezierCurveTo(x + 19 * s, y + 4 * s, x + 22 * s, y + 14 * s, x + 12 * s, y + 21 * s);
  ctx.fill();
  ctx.restore();
}

function drawRobot(ctx, x, y, size, color) {
  ctx.save();
  ctx.fillStyle = color;
  const s = size / 24;
  ctx.beginPath();
  ctx.arc(x + 12 * s, y + 6 * s, 1.6 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(x + 10.5 * s, y + 7.5 * s, 3 * s, 3 * s);
  ctx.beginPath();
  ctx.roundRect?.(x + 4 * s, y + 10 * s, 16 * s, 11 * s, 3 * s);
  if (!ctx.beginPath) return;
  ctx.fill();
  ctx.globalCompositeOperation = "destination-out";
  ctx.beginPath();
  ctx.arc(x + 9 * s, y + 15 * s, 1.8 * s, 0, Math.PI * 2);
  ctx.arc(x + 15 * s, y + 15 * s, 1.8 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawChart(ctx, x, y, size, color) {
  ctx.save();
  ctx.fillStyle = color;
  const s = size / 24;
  ctx.fillRect(x + 3 * s, y + 13 * s, 4.5 * s, 8 * s);
  ctx.fillRect(x + 9.75 * s, y + 8 * s, 4.5 * s, 13 * s);
  ctx.fillRect(x + 16.5 * s, y + 3 * s, 4.5 * s, 18 * s);
  ctx.restore();
}

const ICONS = {
  music: drawMusicNote,
  user: drawUser,
  clock: drawClock,
  search: drawSearch,
  spark: drawSpark,
  list: drawList,
  heart: drawHeart,
  robot: drawRobot,
  chart: drawChart
};

function drawIcon(ctx, name, x, y, size, color) {
  const drawer = ICONS[name];
  if (drawer) {
    try {
      drawer(ctx, x, y, size, color);
    } catch {
      // icon lỗi thì bỏ qua, không được làm hỏng thẻ
    }
  }
}

module.exports = { drawIcon, ICONS };
