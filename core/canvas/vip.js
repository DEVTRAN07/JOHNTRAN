const fs = require("fs");
const os = require("os");
const path = require("path");
const { createCanvas, loadImage, registerFont } = require("canvas");
const { THEMES } = require("./index");
const { drawIcon } = require("./icons");
const http = require("../http");

const WIDTH = 1080;
const PAD = 64;

let fontReady = false;
const FONTS = {
  regular: [
    ["/System/Library/Fonts/Supplemental/Arial.ttf", "VipSans"],
    ["/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "VipSans"],
    ["C:\\Windows\\Fonts\\arial.ttf", "VipSans"]
  ],
  bold: [
    ["/System/Library/Fonts/Supplemental/Arial Bold.ttf", "VipSans-Bold"],
    ["/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", "VipSans-Bold"],
    ["C:\\Windows\\Fonts\\arialbd.ttf", "VipSans-Bold"]
  ]
};

function initFonts() {
  if (fontReady) return;
  fontReady = true;
  for (const list of Object.values(FONTS)) {
    for (const [fontPath, family] of list) {
      try {
        if (fs.existsSync(fontPath)) registerFont(fontPath, { family });
      } catch { /* bỏ qua */ }
    }
  }
}

function sanitize(text) {
  return String(text ?? "");
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapLines(ctx, text, maxWidth, font) {
  ctx.font = font;
  const lines = [];
  for (const paragraph of String(text).split("\n")) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (!words.length) { lines.push(""); continue; }
    let current = "";
    for (const word of words) {
      const test = current ? `${current} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && current) {
        lines.push(current);
        current = word;
      } else {
        current = test;
      }
    }
    lines.push(current);
  }
  return lines;
}

let measureCanvas = null;
function measure() {
  if (!measureCanvas) {
    initFonts();
    measureCanvas = createCanvas(100, 100).getContext("2d");
  }
  return measureCanvas;
}

function estimateHeight(spec) {
  const m = measure();
  const contentW = WIDTH - PAD * 2;
  let height = 250; // header zone

  if (spec.subtitle) {
    const lines = wrapLines(m, sanitize(spec.subtitle), contentW, "300 27px VipSans");
    height += lines.length * 38 + 8;
  }

  const rows = Array.isArray(spec.rows) ? spec.rows : (spec.sections || []).flatMap((section) =>
    [{ icon: section.icon || "list", label: section.title, lines: section.lines || [] }]
  );

  for (const row of rows) {
    height += 16;
    if (row.label) {
      height += 44;
    }
    const font = "300 28px VipSans";
    for (const line of row.lines || []) {
      height += wrapLines(m, sanitize(line), contentW - 92, font).length * 40 + 8;
    }
  }

  if (spec.progress) height += 96;
  if (spec.footer) {
    height += wrapLines(m, sanitize(spec.footer), contentW, "300 21px VipSans").length * 30 + 36;
  }
  height += 56;
  return Math.max(height, 340);
}

async function loadAvatar(url) {
  if (!url) return null;
  // hỗ trợ cả đường dẫn file local
  try {
    if (typeof url === "string" && (url.startsWith("/") || url.startsWith("./")) && fs.existsSync(url)) {
      return await loadImage(url);
    }
  } catch {
    return null;
  }
  try {
    const { buffer } = await http.getBuffer(url, { timeout: 10000, retries: 0 });
    return await loadImage(buffer);
  } catch {
    return null;
  }
}

function drawBackground(ctx, theme, height) {
  const g = ctx.createLinearGradient(0, 0, WIDTH, height);
  g.addColorStop(0, theme.bg);
  g.addColorStop(0.5, theme.bg2);
  g.addColorStop(1, theme.bg);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, WIDTH, height);

  // glow blobs
  const blob = (cx, cy, r, color) => {
    const rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    rg.addColorStop(0, color);
    rg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, WIDTH, height);
  };
  blob(WIDTH * 0.85, 120, 380, theme.glow || "rgba(0,217,255,0.14)");
  blob(WIDTH * 0.1, height - 100, 420, theme.glow2 || "rgba(124,92,255,0.12)");

  // họa tiết chấm mịn
  ctx.fillStyle = "rgba(255,255,255,0.028)";
  for (let x = 40; x < WIDTH; x += 40) {
    for (let y = 40; y < height; y += 40) {
      ctx.beginPath();
      ctx.arc(x, y, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawGlass(ctx, x, y, w, h, radius) {
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.45)";
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 16;
  const grad = ctx.createLinearGradient(x, y, x, y + h);
  grad.addColorStop(0, "rgba(255,255,255,0.075)");
  grad.addColorStop(1, "rgba(255,255,255,0.028)");
  ctx.fillStyle = grad;
  roundRect(ctx, x, y, w, h, radius);
  ctx.fill();
  ctx.restore();

  ctx.save();
  roundRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, radius);
  ctx.strokeStyle = "rgba(255,255,255,0.14)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
}

function drawLogoMark(ctx, x, y, size, accent, accent2) {
  const g = ctx.createLinearGradient(x, y, x + size, y + size);
  g.addColorStop(0, accent);
  g.addColorStop(1, accent2);
  ctx.save();
  ctx.shadowColor = accent;
  ctx.shadowBlur = 18;
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x + size * 0.5, y);
  ctx.lineTo(x + size, y + size * 0.32);
  ctx.lineTo(x + size * 0.78, y + size);
  ctx.lineTo(x + size * 0.22, y + size);
  ctx.lineTo(x, y + size * 0.32);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = "rgba(6,10,18,0.85)";
  ctx.lineWidth = size * 0.1;
  ctx.beginPath();
  ctx.moveTo(x + size * 0.5, y + size * 0.22);
  ctx.lineTo(x + size * 0.5, y + size * 0.66);
  ctx.arc(x + size * 0.62, y + size * 0.72, size * 0.11, 0, Math.PI * 2);
  ctx.stroke();
}

function drawTitle(ctx, spec, theme, y) {
  const contentW = WIDTH - PAD * 2;
  const titleFont = "700 46px VipSans-Bold";
  ctx.font = titleFont;
  const lines = wrapLines(ctx, sanitize(spec.title || "Thông báo"), contentW, titleFont);
  for (const line of lines) {
    const grad = ctx.createLinearGradient(PAD, y - 34, PAD + contentW, y + 10);
    grad.addColorStop(0, theme.text);
    grad.addColorStop(1, theme.accent);
    ctx.fillStyle = grad;
    ctx.fillText(line, PAD, y);
    y += 54;
  }
  return y;
}

function drawChip(ctx, text, x, y, theme) {
  ctx.font = "600 20px VipSans-Bold";
  const w = ctx.measureText(text).width + 36;
  ctx.fillStyle = theme.chip || "rgba(255,255,255,0.08)";
  roundRect(ctx, x, y, w, 40, 20);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.16)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = theme.accent;
  ctx.fillText(text, x + 18, y + 27);
  return w;
}

function drawProgress(ctx, x, y, w, percent, theme, label) {
  ctx.font = "600 22px VipSans-Bold";
  ctx.fillStyle = theme.sub;
  ctx.fillText(label, x, y - 12);
  ctx.fillStyle = "rgba(255,255,255,0.1)";
  roundRect(ctx, x, y, w, 14, 7);
  ctx.fill();
  const pw = Math.max(12, (w * Math.min(100, Math.max(0, percent))) / 100);
  const g = ctx.createLinearGradient(x, y, x + pw, y);
  g.addColorStop(0, theme.accent);
  g.addColorStop(1, theme.accent2);
  ctx.fillStyle = g;
  roundRect(ctx, x, y, pw, 14, 7);
  ctx.fill();
}

async function renderVipCard(spec = {}) {
  initFonts();
  const theme = { ...(THEMES[spec.theme] || THEMES.brand), ...(spec.themeOverride || {}) };
  const height = estimateHeight(spec);
  const contentW = WIDTH - PAD * 2;

  const canvas = createCanvas(WIDTH, height);
  const ctx = canvas.getContext("2d");

  drawBackground(ctx, theme, height);

  // viền ngoài
  ctx.strokeStyle = "rgba(255,255,255,0.09)";
  ctx.lineWidth = 2;
  roundRect(ctx, 12, 12, WIDTH - 24, height - 24, 30);
  ctx.stroke();

  // header: logo + brand + chip
  let y = 96;
  drawLogoMark(ctx, PAD, 42, 52, theme.accent, theme.accent2);
  ctx.font = "700 24px VipSans-Bold";
  ctx.fillStyle = theme.text;
  ctx.fillText(spec.brand || global.config?.name_bot || "ᴶᴼᴴᴺ ᵀᴿᴬᴺ", PAD + 72, 66);
  ctx.font = "400 18px VipSans";
  ctx.fillStyle = theme.sub;
  ctx.fillText(spec.chip || "PREMIUM", PAD + 72, 92);

  // avatar tròn bên phải header
  if (spec.avatar) {
    const img = await loadAvatar(spec.avatar);
    if (img) {
      const size = 76;
      const ax = WIDTH - PAD - size;
      const ay = 40;
      ctx.save();
      ctx.beginPath();
      ctx.arc(ax + size / 2, ay + size / 2, size / 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(img, ax, ay, size, size);
      ctx.restore();
      ctx.strokeStyle = theme.accent;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(ax + size / 2, ay + size / 2, size / 2 + 2, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  y = drawTitle(ctx, spec, theme, 176);

  if (spec.subtitle) {
    ctx.font = "300 27px VipSans";
    ctx.fillStyle = theme.sub;
    for (const line of wrapLines(ctx, sanitize(spec.subtitle), contentW, "300 27px VipSans")) {
      ctx.fillText(line, PAD, y);
      y += 38;
    }
    y += 10;
  }

  // rows (hỗ trợ cả spec.rows và spec.sections cũ)
  const rows = Array.isArray(spec.rows) ? spec.rows : (spec.sections || []).map((section) => ({
    icon: section.icon,
    label: section.title,
    lines: section.lines || []
  }));

  for (const row of rows) {
    y += 16;
    if (row.label) {
      ctx.font = "700 20px VipSans-Bold";
      ctx.fillStyle = theme.accent2;
      const label = sanitize(row.label).toUpperCase();
      const lw = ctx.measureText(label).width + 28;
      ctx.fillStyle = theme.chip || "rgba(255,255,255,0.06)";
      roundRect(ctx, PAD, y - 22, lw, 36, 10);
      ctx.fill();
      ctx.fillStyle = theme.accent2;
      ctx.fillText(label, PAD + 14, y + 2);
      y += 44;
    }
    ctx.font = "300 28px VipSans";
    for (const line of row.lines || []) {
      const icon = row.icon || "spark";
      const wrapped = wrapLines(ctx, sanitize(line), contentW - 92, ctx.font);
      drawIcon(ctx, icon, PAD, y - 26, 26, theme.accent);
      let ly = y;
      for (const wline of wrapped) {
        ctx.fillStyle = theme.text;
        ctx.fillText(wline, PAD + 42, ly);
        ly += 40;
      }
      y = ly + 8;
    }
  }

  // progress bar
  if (spec.progress) {
    y += 24;
    drawProgress(ctx, PAD, y + 22, contentW, spec.progress.percent, theme, sanitize(spec.progress.label || "Tiến trình"));
    y += 60;
  }

  // footer
  if (spec.footer) {
    const lines = wrapLines(ctx, sanitize(spec.footer), contentW, "300 21px VipSans");
    let fy = height - 46 - (lines.length - 1) * 30;
    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PAD, fy - 30);
    ctx.lineTo(WIDTH - PAD, fy - 30);
    ctx.stroke();
    ctx.font = "300 21px VipSans";
    ctx.fillStyle = theme.sub;
    for (const line of lines) {
      ctx.fillText(line, PAD, fy);
      fy += 30;
    }
  }

  const filePath = path.join(os.tmpdir(), `jt_vip_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.png`);
  fs.writeFileSync(filePath, canvas.toBuffer("image/png"));
  return filePath;
}

module.exports = { renderVipCard };
