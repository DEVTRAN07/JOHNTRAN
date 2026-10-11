// ===== Render thẻ nhạc theo thiết kế ᴶᴼᴴᴺ ᵀᴿᴬᴺ =====
// 3 loại: lưới kết quả tìm kiếm, thẻ NOW PLAYING, thẻ player (waveform)
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

function formatDuration(seconds) {
  const m = Math.floor((seconds || 0) / 60);
  const s = Math.floor((seconds || 0) % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatPlays(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return String(n);
}

const BADGE_COLORS = ["#22c55e", "#f97316", "#ef4444", "#a855f7", "#111827", "#ec4899", "#06b6d4", "#eab308"];

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

async function loadThumb(url) {
  if (!url) return null;
  try {
    const { buffer } = await require("../http").getBuffer(url, { timeout: 12000, retries: 1 });
    return await loadImage(buffer);
  } catch {
    return null;
  }
}

function drawThumbFill(ctx, img, x, y, w, h, radius) {
  ctx.save();
  rr(ctx, x, y, w, h, radius);
  ctx.clip();
  if (img) {
    const scale = Math.max(w / img.width, h / img.height);
    const dw = img.width * scale;
    const dh = img.height * scale;
    ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  } else {
    ctx.fillStyle = "#1f2937";
    ctx.fillRect(x, y, w, h);
  }
  ctx.restore();
}

function drawEqualizer(ctx, x, y, width, height, seed) {
  const bars = 24;
  const gap = 2;
  const bw = (width - gap * (bars - 1)) / bars;
  for (let i = 0; i < bars; i++) {
    const pseudo = Math.abs(Math.sin(i * 12.9898 + seed) * 43758.5453) % 1;
    const h = Math.max(3, pseudo * height);
    ctx.fillStyle = BADGE_COLORS[i % BADGE_COLORS.length];
    ctx.globalAlpha = 0.85;
    ctx.fillRect(x + i * (bw + gap), y + (height - h), bw, h);
  }
  ctx.globalAlpha = 1;
}

/* ================= LƯỚI KẾT QUẢ TÌM KIẾM ================= */
async function renderSearchGrid(query, tracks, { page = 1, totalPages = 1, source } = {}) {
  initFonts();
  const cols = 4;
  const rows = Math.ceil(tracks.length / cols);
  const cardW = 260;
  const cardH = 235;
  const gap = 18;
  const padX = 40;
  const headerH = 100;
  const W = padX * 2 + cols * cardW + (cols - 1) * gap;
  const H = headerH + rows * (cardH + gap) + 40;

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#0a1014");
  bg.addColorStop(1, "#0d151b");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // header
  ctx.fillStyle = "#22d3ee";
  ctx.fillRect(padX, 34, 16, 16);
  ctx.font = "bold 30px Arial-Bold";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(`Kết quả: "${truncate(ctx, query, 500)}"`, padX + 30, 50);
  ctx.font = "19px Arial";
  ctx.fillStyle = "#8b98ad";
  ctx.fillText(`Trang ${page}/${totalPages} • Nhấn số để tải • 'next' trang sau`, padX + 30, 82);

  for (let i = 0; i < tracks.length; i++) {
    const track = tracks[i];
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = padX + col * (cardW + gap);
    const y = headerH + row * (cardH + gap);

    ctx.fillStyle = "#101a20";
    rr(ctx, x, y, cardW, cardH, 14);
    ctx.fill();
    ctx.strokeStyle = "#1fd6a0";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // thumbnail
    const thumbH = 130;
    const img = await loadThumb(track.thumbnail);
    drawThumbFill(ctx, img, x + 8, y + 8, cardW - 16, thumbH, 10);

    // badge số thứ tự
    ctx.fillStyle = BADGE_COLORS[i % BADGE_COLORS.length];
    ctx.beginPath();
    ctx.arc(x + 26, y + 26, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 18px Arial-Bold";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(i + 1), x + 26, y + 26);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";

    // tiêu đề
    ctx.font = "bold 17px Arial-Bold";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(truncate(ctx, track.title, cardW - 24), x + 12, y + thumbH + 34);

    // dòng thông tin
    ctx.font = "14px Arial";
    ctx.fillStyle = "#8b98ad";
    ctx.fillText(`♫ ${truncate(ctx, track.artist, cardW - 60)}`, x + 12, y + thumbH + 56);
    ctx.fillStyle = "#f59e0b";
    ctx.fillText(`▣ ${formatDuration(track.duration)}`, x + 12, y + thumbH + 76);

    // equalizer
    drawEqualizer(ctx, x + 12, y + thumbH + 88, cardW - 24, 16, i + 1);
  }

  const filePath = path.join(os.tmpdir(), `jt_grid_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.png`);
  fs.writeFileSync(filePath, canvas.toBuffer("image/png"));
  return filePath;
}

/* ================= THẺ NOW PLAYING ================= */
async function renderNowPlaying(track, source) {
  initFonts();
  const W = 1160;
  const H = 420;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#0b1220");
  bg.addColorStop(1, "#101a2e");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const sourceLabel = String(source || track.source || "MUSIC").toUpperCase();

  // ảnh bìa
  const img = await loadThumb(track.thumbnail);
  const artSize = 300;
  drawThumbFill(ctx, img, 50, (H - artSize) / 2, artSize, artSize, 20);

  // nhãn nguồn góc phải
  ctx.font = "bold 22px Arial-Bold";
  const labelW = ctx.measureText(sourceLabel).width + 44;
  ctx.fillStyle = "rgba(255,255,255,.08)";
  rr(ctx, W - labelW - 40, 44, labelW, 44, 10);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.fillText(sourceLabel, W - labelW / 2 - 40, 71);
  ctx.textAlign = "left";

  // tiêu đề
  ctx.font = "bold 56px Arial-Bold";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(truncate(ctx, track.title, 640), 400, 150);

  // nghệ sĩ
  ctx.font = "34px Arial";
  ctx.fillStyle = "#f97316";
  ctx.fillText(truncate(ctx, track.artist, 560), 400, 210);

  // now playing
  ctx.font = "bold 24px Arial-Bold";
  ctx.fillStyle = "#f97316";
  ctx.fillText("NOW PLAYING", 400, 272);

  // tổng thời lượng bên phải
  ctx.font = "22px Arial";
  ctx.fillStyle = "#94a3b8";
  ctx.textAlign = "right";
  ctx.fillText(formatDuration(track.duration), W - 40, 272);
  ctx.textAlign = "left";

  // thanh tiến trình
  const barY = 320;
  const barX = 400;
  const barW = W - 40 - barX;
  ctx.fillStyle = "rgba(255,255,255,.15)";
  rr(ctx, barX, barY, barW, 6, 3);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(barX, barY, barW, 6);
  ctx.beginPath();
  ctx.arc(barX, barY + 3, 9, 0, Math.PI * 2);
  ctx.fill();

  ctx.font = "18px Arial";
  ctx.fillStyle = "#94a3b8";
  ctx.fillText("0:00", barX, barY + 34);

  // chân thẻ
  ctx.font = "bold 20px Arial-Bold";
  ctx.fillStyle = "#f97316";
  ctx.fillText("♫", barX, barY + 74);
  ctx.font = "19px Arial";
  ctx.fillStyle = "#cbd5e1";
  ctx.fillText(`AUTODOWN • ${sourceLabel} • VOICE`, barX + 30, barY + 74);

  const filePath = path.join(os.tmpdir(), `jt_playing_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.png`);
  fs.writeFileSync(filePath, canvas.toBuffer("image/png"));
  return filePath;
}

/* ================= THẺ PLAYER (waveform) ================= */
async function renderPlayerCard(track, source, plays) {
  initFonts();
  const W = 1160;
  const H = 300;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#191527");
  bg.addColorStop(1, "#221d38");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // viền hồng
  ctx.strokeStyle = "#ec4899";
  ctx.lineWidth = 3;
  rr(ctx, 10, 10, W - 20, H - 20, 24);
  ctx.stroke();

  const sourceLabel = String(source || track.source || "MUSIC").toUpperCase();

  // ảnh bìa
  const img = await loadThumb(track.thumbnail);
  const artSize = 220;
  drawThumbFill(ctx, img, 40, (H - artSize) / 2, artSize, artSize, 16);

  // nguồn
  ctx.font = "20px Arial";
  ctx.fillStyle = "#f97316";
  ctx.fillText("▣ " + sourceLabel, 300, 58);

  // tiêu đề
  ctx.font = "bold 44px Arial-Bold";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(truncate(ctx, track.title, 700), 300, 122);

  // nghệ sĩ
  ctx.font = "26px Arial";
  ctx.fillStyle = "#e879f9";
  ctx.fillText(`♪ ${truncate(ctx, track.artist, 500)}`, 300, 168);

  // thông tin: thời lượng + lượt nghe
  ctx.font = "19px Arial";
  ctx.fillStyle = "#a1a1aa";
  ctx.fillText(`▣ ${formatDuration(track.duration)}`, 300, 208);
  if (plays !== undefined && plays !== null) {
    ctx.fillText(`▣ ${formatPlays(plays)}`, 430, 208);
  }

  // waveform
  ctx.fillStyle = "#f472b6";
  const bars = 40;
  const barW = 8;
  const gap = 4;
  const startX = 300;
  const y = 240;
  for (let i = 0; i < bars; i++) {
    const pseudo = Math.abs(Math.sin(i * 78.233 + Math.cos(i) * 43.5455) * 43758.5453) % 1;
    const h = 10 + pseudo * 30;
    ctx.globalAlpha = 0.5 + pseudo * 0.5;
    ctx.fillRect(startX + i * (barW + gap), y + (40 - h) / 2, barW, h);
  }
  ctx.globalAlpha = 1;

  const filePath = path.join(os.tmpdir(), `jt_player_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.png`);
  fs.writeFileSync(filePath, canvas.toBuffer("image/png"));
  return filePath;
}

module.exports = { renderSearchGrid, renderNowPlaying, renderPlayerCard, formatDuration, formatPlays };
