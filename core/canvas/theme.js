// ===== THEME DÙNG CHUNG CHO MỌI CANVAS (menu, thẻ lệnh, nhạc, panel...) =====
// Mục tiêu: mọi ảnh bot gửi ra đều MỘT KIỂU — cùng nền, cùng font, cùng màu,
// cùng cách bo góc/tạo bóng. Muốn đổi hình dáng chỉ sửa 1 file này.
const fs = require("fs");
const os = require("os");
const path = require("path");
const { createCanvas, registerFont, loadImage } = require("canvas");

// Nền ảnh: assets/bg/theme.jpg (đổi file này là đổi nền toàn bộ ảnh của bot)
const BG_IMAGE = path.join(__dirname, "..", "..", "assets", "bg", "theme.jpg");

const PALETTE = {
  bg0: "#070a14",   // tối nhất
  bg1: "#0d1224",   // giữa
  bg2: "#111735",   // sáng hơn chút
  ink: "#ffffff",   // chữ chính
  ink2: "#aab6cf",  // chữ phụ
  mute: "#6b7a99",  // chữ mờ
  accent: "#38bdf8", // cyan — màu chủ đạo
  accent2: "#a78bfa", // tím
  green: "#34d399",
  red: "#fb7185",
  gold: "#fbbf24"
};

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
      ctx.globalAlpha = 0.28; // ảnh chỉ làm "cảm giác", chữ vẫn phải dễ đọc
      ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
      ctx.restore();
    }
  } catch { /* thiếu ảnh nền = nền gradient vẫn đẹp */ }

  // Lớp tối phủ lên để chữ luôn rõ
  const shade = ctx.createLinearGradient(0, 0, 0, h);
  shade.addColorStop(0, "rgba(7, 10, 20, .55)");
  shade.addColorStop(1, "rgba(7, 10, 20, .85)");
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, w, h);

  // Glow 2 góc — dấu hiệu nhận diện chung
  const glow = (cx, cy, r, color) => {
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, color);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  };
  glow(140, 120, 340, "rgba(56, 189, 248, .16)");
  glow(w - 140, 120, 340, "rgba(167, 139, 250, .16)");
}

// Thẻ dùng chung (bo góc, nền mờ, viền sáng)
function panel(ctx, x, y, w, h, r = 16, accent = PALETTE.accent) {
  ctx.fillStyle = "rgba(13, 18, 36, 0.78)";
  roundRect(ctx, x, y, w, h, r);
  ctx.fill();
  ctx.strokeStyle = accent;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.globalAlpha = 1;
}

// Nút dùng chung (PREV / NEXT / OUT...)
function button(ctx, x, y, w, h, label, color) {
  ctx.fillStyle = `${color}2e`; // ~18% alpha
  roundRect(ctx, x, y, w, h, S(14));
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.6;
  ctx.lineWidth = S(1.5);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.font = font(22, "JT-Bold");
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.fillText(label, x + w / 2, y + h / 2 + S(8));
  ctx.textAlign = "left";
}

function text(ctx, str, x, y, { size = 20, family = "JT", color = PALETTE.ink2, align = "left", maxWidth } = {}) {
  ctx.font = font(size, family);
  ctx.fillStyle = color;
  ctx.textAlign = align;
  if (maxWidth) ctx.fillText(truncate(ctx, str, maxWidth), x, y);
  else ctx.fillText(String(str ?? ""), x, y);
  ctx.textAlign = "left";
}

function newCanvas(w, h) {
  const canvas = createCanvas(w, h);
  return { canvas, ctx: canvas.getContext("2d") };
}

function save(canvas, prefix) {
  const filePath = path.join(os.tmpdir(), `jt_${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.png`);
  fs.writeFileSync(filePath, canvas.toBuffer("image/png"));
  return filePath;
}

module.exports = { PALETTE, WIDTH, S, font, FONT_FAMILIES, initFonts, roundRect, truncate, paintBackground, panel, button, text, newCanvas, save };
