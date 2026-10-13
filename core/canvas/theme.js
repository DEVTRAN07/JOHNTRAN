// ===== THEME DÙNG CHUNG CHO MỌI CANVAS (menu, thẻ lệnh, nhạc, panel...) =====
// Mục tiêu: mọi ảnh bot gửi ra đều MỘT KIỂU — cùng nền, cùng font, cùng màu,
// cùng cách bo góc/tạo bóng. Muốn đổi hình dáng chỉ sửa 1 file này.
const fs = require("fs");
const os = require("os");
const path = require("path");
const { createCanvas, registerFont, loadImage } = require("canvas");

// Nền ảnh: assets/bg/theme.jpg (đổi file này là đổi nền toàn bộ ảnh của bot)
const BG_IMAGE = path.join(__dirname, "..", "..", "assets", "bg", "theme.jpg");

// ===== PRESET GIAO DIỆN =====
// classic   : navy gradient + cyan/tím + kính mờ (kiểu phổ biến)
// editorial : đen–nhũ vàng, viền hairline, góc gần vuông — KIỂU RIÊNG của
//             bot, không trùng kiểu bot khác.
// Đổi preset: canvas.theme trong config.yml.
const PALETTE = {};   // resolveTheme() fill lúc module load
const THEME_STYLE = {}; // kiểu vẽ (viền/bóng/góc...) theo preset

const BASE_PALETTE = {
  bg0: "#070a14", bg1: "#0d1224", bg2: "#111735",
  ink: "#ffffff", ink2: "#aab6cf", mute: "#6b7a99",
  accent: "#38bdf8", accent2: "#a78bfa",
  green: "#34d399", red: "#fb7185", gold: "#fbbf24"
};

const BASE_STYLE = {
  panelBg: "rgba(13, 18, 36, 0.78)",
  panelBorderAlpha: 0.55,
  panelLineWidth: 1.5,
  panelRadius: 16,
  btnRadius: 14,
  frame: false,
  glowCorners: ["rgba(56, 189, 248, .16)", "rgba(167, 139, 250, .16)"],
  bgImageAlpha: 0.28,
  shade: "rgba(7, 10, 20, .7)",
  foil: false
};

const PRESETS = {
  classic: {},

  editorial: {
    PALETTE: {
      bg0: "#08080a", bg1: "#101012", bg2: "#17171a",
      ink: "#f6f2e7",      // trắng ấm
      ink2: "#bcb6a6",
      mute: "#7d7768",
      accent: "#d4af37",   // nhũ vàng
      accent2: "#c9cdd3",  // bạc (VIP cấp 2)
      green: "#8fbf9f",
      red: "#c4594e",      // đỏ son
      gold: "#d4af37"
    },
    style: {
      panelBg: "rgba(22, 21, 18, 0.86)",
      panelBorderAlpha: 0.42,   // hairline vàng mờ
      panelLineWidth: 1,
      panelRadius: 0,           // góc VUÔNG — editorial sạch
      btnRadius: 0,
      frame: true,              // khung hairline vàng quanh cả ảnh
      glowCorners: ["rgba(212, 175, 55, .10)", "rgba(212, 175, 55, .04)"],
      bgImageAlpha: 0.12,
      shade: "rgba(8, 8, 10, .78)",
      foil: true                // vệt nhũ vàng dưới tiêu đề
    }
  }
};

function resolveTheme() {
  const name = String(global.config?.canvas?.theme || "").trim();
  const preset = PRESETS[name] || {};
  Object.assign(PALETTE, BASE_PALETTE, preset.PALETTE || {});
  Object.assign(THEME_STYLE, BASE_STYLE, preset.style || {});
  THEME_STYLE.panelBorder = PALETTE.accent;
}

// Bot set global.config SAU khi require module nên phải resolve lại mỗi lần
// render (chỉ đổi assignment khi preset đổi — rẻ).
let _resolvedName = "__init__";
function ensureTheme() {
  const name = String(global.config?.canvas?.theme || "").trim();
  if (name !== _resolvedName) {
    _resolvedName = name;
    resolveTheme();
  }
}
resolveTheme();


// ===== Glyph an toàn =====
// node-canvas vẽ chữ bằng font JT (Arial/DejaVu) — KHÔNG có glyph emoji,
// mọi emoji sẽ thành ô vuông/¶. Map emoji → ký hiệu có trong font.
const GLYPH_FALLBACK = {
  "⌨️": "»", "⌨": "»", "🔗": "»", "📄": "»", "📡": "#", "📺": "▶",
  "❌": "×", "🚫": "×", "✖": "×", "❎": "×",
  "🎵": "♪", "🎧": "♫", "🎼": "♪",
  "❤️": "♥", "❤": "♥", "😽": "♥", "💔": "×",
  "👤": "o", "👥": "oo", "🙂": "o",
  "🔥": "*", "⭐": "★", "🌟": "★", "🏆": "★", "👑": "♛",
  "🔎": "?", "🔍": "?", "❓": "?", "❔": "?",
  "💡": "i", "ℹ️": "i",
  "⏳": "...", "⏰": "◷", "⏱": "◷",
  "🎯": ">", "👉": ">", "▶️": "▶", "◀️": "◀",
  "📌": "•", "📍": "•",
  "💰": "$", "💵": "$",
  "🎲": "?", "🃏": "?",
  "💬": "◌", "🗨️": "◌",
  "🖼️": "▣", "🖼": "▣",
  "🌐": "@", "📎": "♦",
  "🤖": "✦", "🧠": "✦",
  "✅": "✓", "✔️": "✓",
  "⚡": "⚡"
};
function sanitizeGlyphs(text) {
  let out = String(text ?? "");
  for (const [emoji, symbol] of Object.entries(GLYPH_FALLBACK)) {
    if (out.includes(emoji)) out = out.split(emoji).join(symbol);
  }
  // XOÁ emoji còn lại (surrogate pairs + variation selectors) — tránh ô vuông
  out = out.replace(/[\u{1F000}-\u{1FAFF}\u{1F1E6}-\u{1F1FF}\u{FE0F}\u{2600}-\u{26CF}\u{2700}-\u{27BF}]/gu, "");
  return out;
}

// ===== MÀU RANDOM cho nút điều hướng =====
// Mỗi lần render chọn 1 bộ màu ngẫu nhiên (nhưng hài hoà) — bot không bị
// đơn điệu, vẫn giữ nhũ vàng làm accent chính.
const RANDOM_ACCENTS = [
  ["#d4af37", "#fbbf24", "#c4594e"],   // vàng đồng — cam son — đỏ son
  ["#d4af37", "#8fbf9f", "#5b8dd9"],   // vàng — xanh bạc hà — xanh dương
  ["#c9cdd3", "#d4af37", "#b74134"],   // bạc — vàng — đỏ
  ["#d4af37", "#9d7bd8", "#5fa8d3"],   // vàng — tím khói — xanh nhạt
  ["#e0b84c", "#7fb069", "#c97b8a"],   // vàng nhẹ — xanh rừng — hồng đất
  ["#d4af37", "#e07a5f", "#81b29a"]    // vàng — đất nung — xanh bãi cỏ
];
function randomAccent() {
  const set = RANDOM_ACCENTS[Math.floor(Math.random() * RANDOM_ACCENTS.length)];
  return { prev: set[0], out: set[1], next: set[2] };
}

// Vệt nhũ vàng dưới tiêu đề (dấu hiệu nhận diện của preset editorial)
function foil(ctx, x, y, w) {
  ensureTheme();
  if (!THEME_STYLE.foil) return;
  const g = ctx.createLinearGradient(x, y, x + w, y);
  g.addColorStop(0, PALETTE.accent);
  g.addColorStop(0.55, "rgba(212, 175, 55, .35)");
  g.addColorStop(1, "rgba(212, 175, 55, 0)");
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, 3);
}

// Label IN HOA giãn chữ (kiểu tạp chí)
function label(ctx, str, x, y, { size = 15, color = PALETTE.accent, align = "left", spacing = 2.5 } = {}) {
  ensureTheme();
  ctx.font = font(size, "JT-Bold");
  ctx.fillStyle = color;
  ctx.textAlign = align;
  const text = sanitizeGlyphs(str).toUpperCase();
  if (ctx.letterSpacing !== undefined) {
    ctx.letterSpacing = `${spacing}px`;
    ctx.fillText(text, x, y);
    ctx.letterSpacing = "0px";
  } else {
    // fallback: vẽ từng chữ một nếu canvas cũ không có letterSpacing
    let cx = align === "center" ? x - (ctx.measureText(text).width + spacing * text.length) / 2 : x;
    for (const ch of text) {
      ctx.fillText(ch, cx, y);
      cx += ctx.measureText(ch).width + spacing;
    }
  }
  ctx.textAlign = "left";
}

// ===== CỠ ẢNH =====
// Mặc định 1280px (kích cỡ cũ, ảnh lớn rõ). Muốn Zalo gửi NGUYÊN BẢN không
// resize thì set canvas.width: 750 trong config.yml (Zalo resize ảnh > ~720px).
// Mọi kích thước trong canvas đều scale theo cỡ này nên đổi 1 chỗ là đổi hết.
const WIDTH = Number(global.config?.canvas?.width) || 1280;
const DESIGN_WIDTH = 750; // mọi số trong canvas viết cho cỡ 750
const S = (px) => Math.round((px * WIDTH) / DESIGN_WIDTH);
const font = (px, family = "JT") => `${S(px)}px ${family}`;

// ===== Font (một kiểu cho mọi ảnh — nhưng NHIỀU family để chọn) =====
// JT / JT-Bold  : chữ chính (sans)
// JT-Display   : tiêu đề (serif/trang trọng)
// JT-Round     : bo tròn thân thiện
// JT-Mono      : số liệu, thời gian
const FONT_FAMILIES = ["JT", "JT-Bold", "JT-Display", "JT-Display-Bold", "JT-Round", "JT-Round-Bold", "JT-Mono", "JT-Mono-Bold"];

let fontsReady = false;
function initFonts() {
  if (fontsReady) return;
  fontsReady = true;
  const register = (p, family) => { try { if (fs.existsSync(p)) registerFont(p, { family }); } catch { /* bỏ qua */ } };
  const platform = process.platform;

  if (platform === "darwin") {
    register("/System/Library/Fonts/Supplemental/Arial.ttf", "JT");
    register("/System/Library/Fonts/Supplemental/Arial Bold.ttf", "JT-Bold");
    register("/System/Library/Fonts/Supplemental/Georgia.ttf", "JT-Display");
    register("/System/Library/Fonts/Supplemental/Georgia Bold.ttf", "JT-Display-Bold");
    register("/System/Library/Fonts/Avenir.ttc", "JT-Round");
    register("/System/Library/Fonts/Avenir Next.ttc", "JT-Round-Bold");
    register("/System/Library/Fonts/Menlo.ttc", "JT-Mono");
    register("/System/Library/Fonts/Courier New Bold.ttf", "JT-Mono-Bold");
  } else if (platform === "win32") {
    register("C:\\Windows\\Fonts\\arial.ttf", "JT");
    register("C:\\Windows\\Fonts\\arialbd.ttf", "JT-Bold");
    register("C:\\Windows\\Fonts\\georgia.ttf", "JT-Display");
    register("C:\\Windows\\Fonts\\georgiab.ttf", "JT-Display-Bold");
    register("C:\\Windows\\Fonts\\segoeui.ttf", "JT-Round");
    register("C:\\Windows\\Fonts\\segoeuib.ttf", "JT-Round-Bold");
    register("C:\\Windows\\Fonts\\consola.ttf", "JT-Mono");
    register("C:\\Windows\\Fonts\\consolab.ttf", "JT-Mono-Bold");
  } else {
    register("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "JT");
    register("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", "JT-Bold");
    register("/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf", "JT-Display");
    register("/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf", "JT-Display-Bold");
    register("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "JT-Round");
    register("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", "JT-Round-Bold");
    register("/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf", "JT-Mono");
    register("/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf", "JT-Mono-Bold");
  }
}

// ===== Vẽ cơ bản dùng chung =====
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x, y, r);
  ctx.closePath();
}

function truncate(ctx, text, maxWidth) {
  let t = String(text ?? "");
  if (ctx.measureText(t).width <= maxWidth) return t;
  while (t.length > 1 && ctx.measureText(t + "…").width > maxWidth) t = t.slice(0, -1);
  return t + "…";
}

// Nền: ảnh theme.jpg + lớp tối + glow — NẰM Ở MỌI ẢNH
async function paintBackground(ctx, w, h) {
  initFonts();
  ensureTheme();
  const gradient = ctx.createLinearGradient(0, 0, w, h);
  gradient.addColorStop(0, PALETTE.bg0);
  gradient.addColorStop(0.5, PALETTE.bg1);
  gradient.addColorStop(1, PALETTE.bg0);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);

  // Ảnh nền (phủ toàn bộ, giữ tỉ lệ)
  try {
    if (fs.existsSync(BG_IMAGE)) {
      const img = await loadImage(fs.readFileSync(BG_IMAGE));
      const scale = Math.max(w / img.width, h / img.height);
      const dw = img.width * scale;
      const dh = img.height * scale;
      ctx.save();
      ctx.globalAlpha = THEME_STYLE.bgImageAlpha; // ảnh chỉ làm "cảm giác", chữ vẫn phải dễ đọc
      ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
      ctx.restore();
    }
  } catch { /* thiếu ảnh nền = nền gradient vẫn đẹp */ }

  // Lớp tối phủ lên để chữ luôn rõ
  const shade = ctx.createLinearGradient(0, 0, 0, h);
  const shadeColor = THEME_STYLE.shade || "rgba(7, 10, 20, .7)";
  shade.addColorStop(0, shadeColor.replace(/[\d.]+\s*\)$/, ".55)"));
  shade.addColorStop(1, THEME_STYLE.shade);
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, w, h);

  // Glow 2 góc — dấu hiệu nhận diện theo preset
  const glow = (cx, cy, r, color) => {
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, color);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  };
  const [glowA, glowB] = THEME_STYLE.glowCorners;
  glow(S(140), S(120), S(340), glowA);
  glow(w - S(140), S(120), S(340), glowB);

  // Khung hairline quanh cả ảnh (editorial)
  if (THEME_STYLE.frame) {
    ctx.save();
    ctx.strokeStyle = PALETTE.accent;
    ctx.globalAlpha = 0.28;
    ctx.lineWidth = Math.max(1, S(1));
    ctx.strokeRect(S(10), S(10), w - S(20), h - S(20));
    ctx.globalAlpha = 0.14;
    ctx.strokeRect(S(16), S(16), w - S(32), h - S(32));
    ctx.restore();
  }
}

// Thẻ dùng chung (bo góc, nền mờ, viền sáng)
function panel(ctx, x, y, w, h, r = THEME_STYLE.panelRadius, accent = THEME_STYLE.panelBorder) {
  ensureTheme();
  ctx.fillStyle = THEME_STYLE.panelBg;
  roundRect(ctx, x, y, w, h, r);
  ctx.fill();
  ctx.strokeStyle = accent;
  ctx.globalAlpha = THEME_STYLE.panelBorderAlpha;
  ctx.lineWidth = THEME_STYLE.panelLineWidth;
  ctx.stroke();
  ctx.globalAlpha = 1;
}

// Nút dùng chung (PREV / NEXT / OUT...)
function button(ctx, x, y, w, h, label, color) {
  ensureTheme();
  ctx.fillStyle = `${color}2e`; // ~18% alpha
  roundRect(ctx, x, y, w, h, S(THEME_STYLE.btnRadius));
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.6;
  ctx.lineWidth = S(1.5);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.font = font(22, "JT-Bold");
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.fillText(sanitizeGlyphs(label), x + w / 2, y + h / 2 + S(8));
  ctx.textAlign = "left";
}

function text(ctx, str, x, y, { size = 20, family = "JT", color = PALETTE.ink2, align = "left", maxWidth } = {}) {
  ctx.font = font(size, family);
  ctx.fillStyle = color;
  ctx.textAlign = align;
  const safe = sanitizeGlyphs(str);
  if (maxWidth) ctx.fillText(truncate(ctx, safe, maxWidth), x, y);
  else ctx.fillText(safe, x, y);
  ctx.textAlign = "left";
}

function newCanvas(w, h) {
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext("2d");
  // Chất lượng render cao nhất: khử răng cưcj "best", ảnh nền nét, chữ không rỗ
  try {
    ctx.antialias = "best";
    ctx.quality = "best";
    ctx.patternQuality = "best";
    ctx.filter = "best";
    ctx.textDrawingMode = "default";
  } catch { /* node-canvas cũ không hỗ trợ thì bỏ qua */ }
  return { canvas, ctx };
}

function save(canvas, prefix) {
  const filePath = path.join(os.tmpdir(), `jt_${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.png`);
  fs.writeFileSync(filePath, canvas.toBuffer("image/png"));
  return filePath;
}

module.exports = { PALETTE, WIDTH, S, font, FONT_FAMILIES, initFonts, roundRect, truncate, paintBackground, panel, button, text, newCanvas, save, foil, label, THEME_STYLE, randomAccent, RANDOM_ACCENTS, reload: resolveTheme };
