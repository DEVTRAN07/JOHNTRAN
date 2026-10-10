const fs = require("fs");
const path = require("path");
const os = require("os");
const { createCanvas, registerFont } = require("canvas");

const FONT_CANDIDATES = {
  darwin: [
    ["/System/Library/Fonts/Supplemental/Arial.ttf", "Arial"],
    ["/System/Library/Fonts/Supplemental/Arial Bold.ttf", "Arial-Bold"],
    ["/System/Library/Fonts/AppleSDGothicNeo.ttc", "AppleSDGothicNeo"],
    ["/System/Library/Fonts/Apple Color Emoji.ttc", "Emoji"]
  ],
  linux: [
    ["/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "DejaVu Sans"],
    ["/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", "DejaVu Sans Bold"],
    ["/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf", "Noto Sans"],
    ["/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf", "Noto Sans Bold"],
    ["/usr/share/fonts/truetype/noto/NotoColorEmoji.ttf", "Emoji"]
  ],
  win32: [
    ["C:\\Windows\\Fonts\\arial.ttf", "Arial"],
    ["C:\\Windows\\Fonts\\arialbd.ttf", "Arial Bold"],
    ["C:\\Windows\\Fonts\\segoeui.ttf", "Segoe UI"],
    ["C:\\Windows\\Fonts\\seguiemj.ttf", "Segoe UI Emoji"]
  ]
};

const THEMES = {
  brand:   { bg: "#0b0e14", bg2: "#131a26", accent: "#00d9ff", accent2: "#7c5cff", text: "#eef2f8", sub: "#8b98ad", border: "#1f2a3a", chip: "#13202e" },
  success: { bg: "#08130d", bg2: "#0e2015", accent: "#22c55e", accent2: "#16a34a", text: "#eafff2", sub: "#7fb894", border: "#173324", chip: "#10281a" },
  error:   { bg: "#160a0c", bg2: "#231016", accent: "#f43f5e", accent2: "#e11d48", text: "#fff0f3", sub: "#c98d99", border: "#3a1a22", chip: "#2a1219" },
  warn:    { bg: "#161206", bg2: "#221a0c", accent: "#f59e0b", accent2: "#d97706", text: "#fff8ea", sub: "#c8a86a", border: "#3a2c12", chip: "#2a1f0e" },
  music:   { bg: "#0a0f1e", bg2: "#101a33", accent: "#00d9ff", accent2: "#ff5ca8", text: "#eaf2ff", sub: "#8ba3c7", border: "#1c2742", chip: "#111d33" },
  ai:      { bg: "#0d0a18", bg2: "#18112b", accent: "#a78bfa", accent2: "#6366f1", text: "#f3efff", sub: "#9d92c4", border: "#271f42", chip: "#1a1430" }
};

const EMOJI_FALLBACK = {
  "🎵": "♪", "🎧": "♫", "❤️": "❤", "✅": "✔", "❌": "✘", "⚠️": "!",
  "⏳": "...", "🚫": "×", "💡": "i", "🔎": "?", "📡": "#", "🎯": ">",
  "🤖": "AI", "🖼️": "[img]", "⏱": "⏱", "♪": "♪", "♫": "♫", "🔍": "?",
  "📺": "▶", "🌐": "@", "👁‍🗨": "◉", "👉": ">", "📎": "♦", "😽": "♥",
  "💬": "☰", "⏰": "◷", "🏆": "★", "💰": "$", "🎲": "?", "🃏": "?"
};

let fontsReady = false;
let hasEmojiFont = false;
let baseFont = "Arial";

function initFonts() {
  if (fontsReady) return;
  fontsReady = true;
  const platform = os.platform();
  const candidates = FONT_CANDIDATES[platform] || FONT_CANDIDATES.linux;

  for (const [fontPath, family] of candidates) {
    try {
      if (!fs.existsSync(fontPath)) continue;
      registerFont(fontPath, { family });
      if (family === "Emoji") hasEmojiFont = true;
      if (platform !== "win32" && baseFont === "Arial" && family !== "Emoji") baseFont = family;
      if (platform === "win32" && baseFont === "Arial") baseFont = family;
    } catch { /* bỏ qua font lỗi */ }
  }
}

function sanitize(text) {
  let output = String(text ?? "");
  if (!hasEmojiFont) {
    for (const [emoji, symbol] of Object.entries(EMOJI_FALLBACK)) {
      output = output.split(emoji).join(symbol);
    }
    // xoá emoji còn lại (surrogate pairs) để tránh ô vuông
    output = output.replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{1F1E6}-\u{1F1FF}]/gu, "");
  }
  return output;
}

function roundRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function wrapText(ctx, text, maxWidth) {
  const lines = [];
  for (const paragraph of String(text).split("\n")) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push("");
      continue;
    }
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
    if (current) lines.push(current);
  }
  return lines;
}

function measureContent(spec) {
  const lineHeight = 34;
  const padding = 56;
  const width = 1000;
  const contentWidth = width - padding * 2;

  initFonts();
  const canvas = createCanvas(width, 10);
  const ctx = canvas.getContext("2d");

  let height = 200; // header
  ctx.font = `26px ${baseFont}`;

  if (spec.subtitle) {
    const lines = wrapText(ctx, sanitize(spec.subtitle), contentWidth);
    height += lines.length * 36 + 10;
  }

  const sections = Array.isArray(spec.sections) ? spec.sections : [];
  for (const section of sections) {
    if (section.title) {
      ctx.font = `bold 24px ${baseFont}`;
      height += 60;
    }
    ctx.font = `26px ${baseFont}`;
    const lines = (section.lines || []).flatMap((line) => wrapText(ctx, sanitize(line), contentWidth - 30));
    height += lines.length * lineHeight + 24;
  }

  if (spec.footer) {
    ctx.font = `22px ${baseFont}`;
    height += 56;
  }

  height += 70; // padding bottom
  return { width, height };
}

function renderCard(spec = {}) {
  initFonts();
  const theme = THEMES[spec.theme] || THEMES.brand;
  const brand = spec.brand || global.config?.name_bot || "JOHN TRAN";
  const { width, height } = measureContent(spec);
  const padding = 56;
  const contentWidth = width - padding * 2;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // background
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, theme.bg);
  gradient.addColorStop(1, theme.bg2);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // border
  ctx.strokeStyle = theme.border;
  ctx.lineWidth = 2;
  roundRect(ctx, 10, 10, width - 20, height - 20, 24);
  ctx.stroke();

  let y = 84;

  // header chip
  ctx.font = `bold 24px ${baseFont}`;
  const chipText = sanitize(`${spec.chip || "ᴶᴼᴴᴺ ᵀᴿᴬᴺ"} • ${brand}`);
  const chipWidth = Math.min(ctx.measureText(chipText).width + 48, contentWidth);
  ctx.fillStyle = theme.chip;
  roundRect(ctx, padding, y - 40, chipWidth, 52, 12);
  ctx.fill();
  ctx.fillStyle = theme.accent;
  ctx.textBaseline = "middle";
  ctx.fillText(chipText, padding + 24, y - 14);

  // title
  ctx.font = `bold 52px ${baseFont}`;
  ctx.fillStyle = theme.text;
  const titleLines = wrapText(ctx, sanitize(spec.title || "Thông báo"), contentWidth);
  for (const line of titleLines) {
    ctx.fillText(line, padding, y + 12);
    y += 62;
  }

  // subtitle
  if (spec.subtitle) {
    ctx.font = `26px ${baseFont}`;
    ctx.fillStyle = theme.sub;
    const lines = wrapText(ctx, sanitize(spec.subtitle), contentWidth);
    for (const line of lines) {
      ctx.fillText(line, padding, y + 6);
      y += 36;
    }
  }

  // sections
  for (const section of Array.isArray(spec.sections) ? spec.sections : []) {
    y += 18;
    if (section.title) {
      ctx.font = `bold 24px ${baseFont}`;
      ctx.fillStyle = theme.accent2;
      ctx.fillText(sanitize(section.title.toUpperCase()), padding, y);
      y += 42;
    }
    ctx.font = `26px ${baseFont}`;
    const lines = (section.lines || []).flatMap((line) => wrapText(ctx, sanitize(line), contentWidth - 30));
    for (const line of lines) {
      ctx.fillStyle = theme.text;
      ctx.fillText(line, padding + 30, y);
      y += 34;
    }
    y += 10;
  }

  // footer
  if (spec.footer) {
    ctx.font = `22px ${baseFont}`;
    ctx.fillStyle = theme.sub;
    const lines = wrapText(ctx, sanitize(spec.footer), contentWidth);
    let footerY = height - 48;
    for (let i = lines.length - 1; i >= 0; i--) {
      ctx.fillText(lines[i], padding, footerY);
      footerY -= 28;
    }
  }

  return canvas;
}

function renderCardToFile(spec, filePath) {
  const canvas = renderCard(spec);
  const outPath = filePath || path.join(os.tmpdir(), `jt_card_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.png`);
  fs.writeFileSync(outPath, canvas.toBuffer("image/png"));
  return outPath;
}

module.exports = { renderCard, renderCardToFile, sanitize, THEMES };
