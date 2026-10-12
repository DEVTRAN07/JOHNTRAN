// ===== RENDERER THẺ HỒ SƠ THEO LAYOUT Kenne400k/filebotha-leak =====
// Tham khảo modules/commands/card.js của Kenne400k nhưng viết lại cho Zalo API.
//
// ĐẶC ĐIỂM LAYOUT GỐC (Kenne400k):
//   • nền ảnh (thay vì imgur cố định → dùng assets/bg/theme.jpg)
//   • avatar TRÒN bên trái (232/1280 ≈ 18% chiều rộng) viền sáng
//   • TÊN to (35px) nằm trên, màu CYAN #00FFFF
//   • cột thông tin "» label: value" bên phải, cỡ 28px, CYAN #00FFFF
//   • dòng link profile cuối thẻ, cỡ 24px, XANH LÁ #00FF33
const fs = require("fs");
const os = require("os");
const path = require("path");
const Jimp = require("jimp");
const { createCanvas, loadImage, registerFont } = require("canvas");

const W = 750, H = 520; // cùng tỉ lệ 1600x900 của bản gốc
const BG = path.join(__dirname, "..", "..", "assets", "bg", "theme.jpg");

// Màu đúng như repo Kenne400k
const CYAN = "#00FFFF";
const GREEN = "#00FF33";

// Cắt ảnh thành hình tròn (jimp circle — cách làm trong repo gốc)
async function circle(buffer) {
  const img = await Jimp.read(buffer);
  img.circle();
  return await img.getBufferAsync("image/png");
}

// Font đậm hệ thống
function pickBold() {
  const cands = [
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    "C:\\Windows\\Fonts\\arialbd.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
  ];
  for (const p of cands) { try { if (fs.existsSync(p)) return p; } catch { /* bỏ qua */ } }
  return null;
}

// Ảnh nền: theme.jpg, fallback gradient
async function loadBackground() {
  if (fs.existsSync(BG)) return fs.readFileSync(BG);
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, "#070a14"); g.addColorStop(0.5, "#0e1428"); g.addColorStop(1, "#070a14");
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  return canvas.toBuffer("image/png");
}

/**
 * @param {object} o
 * @param {string} o.name        tên hiển thị
 * @param {Buffer|null} o.avatarBuffer  buffer ảnh đại diện (tùy chọn)
 * @param {Array<[string,string]>} o.rows  [["» Sinh nhật","01/01/2000"], ...]
 * @param {string} o.link        dòng link ở chân thẻ
 * @returns {Promise<string>}    đường dẫn file PNG
 */
async function render(o = {}) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "jt_pcard_"));
  const bold = pickBold();
  try {
    if (bold) registerFont(bold, { family: "KenBold" });

    const bg = await loadImage(await loadBackground());
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext("2d");

    // phủ nền (giữ nguyên ảnh, cùng cách repo gốc)
    ctx.drawImage(bg, 0, 0, W, H);

    // lớp tối mỏng cho chữ rõ trên mọi nền
    ctx.fillStyle = "rgba(4, 7, 16, .35)";
    ctx.fillRect(0, 0, W, H);

    // ---- avatar tròn bên trái (tỉ lệ gốc 232/1280) ----
    const avSize = 205;          // 232 * 750/1280 ≈ 136... chọn to hơn cho dễ nhìn
    const avX = 44, avY = 108;
    if (o.avatarBuffer) {
      const av = await loadImage(await circle(o.avatarBuffer));
      ctx.save();
      ctx.beginPath();
      ctx.arc(avX + avSize / 2, avY + avSize / 2, avSize / 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(av, avX, avY, avSize, avSize);
      ctx.restore();
      ctx.lineWidth = 4;
      ctx.strokeStyle = CYAN;
      ctx.beginPath();
      ctx.arc(avX + avSize / 2, avY + avSize / 2, avSize / 2 + 3, 0, Math.PI * 2);
      ctx.stroke();
    }

    // ---- TÊN (35px → tỉ lệ 750/1600 ≈ 20px, dùng 26px cho rõ) ----
    const infoX = avX + avSize + 34;
    ctx.font = bold ? "26px KenBold" : "bold 26px sans-serif";
    ctx.fillStyle = CYAN;
    ctx.textAlign = "left";
    ctx.fillText(String(o.name || "—").slice(0, 20), infoX, 150);

    // ---- cột thông tin "» label: value" (28px → tỉ lệ ≈ 17px) ----
    let y = 196;
    for (const [label, value] of o.rows || []) {
      ctx.font = "17px sans-serif";
      ctx.fillStyle = CYAN;
      ctx.fillText(`${label}:`, infoX, y);
      ctx.font = "17px sans-serif";
      ctx.fillStyle = "#eafcff";
      ctx.fillText(String(value).slice(0, 22), infoX + 148, y);
      y += 44;
    }

    // ---- link profile (24px → ≈ 15px, xanh lá như gốc) ----
    if (o.link) {
      ctx.font = "15px sans-serif";
      ctx.fillStyle = GREEN;
      ctx.fillText(`» Profile: ${String(o.link).slice(0, 46)}`, 60, H - 40);
    }

    const outPath = path.join(tmpDir, "card.png");
    fs.writeFileSync(outPath, canvas.toBuffer("image/png"));
    // tmpDir được dọn ở caller qua cleanup; giữ đường dẫn riêng
    return outPath;
  } finally {
    setTimeout(() => { try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* bỏ qua */ } }, 60000);
  }
}

module.exports = { render, circle, CYAN, GREEN, WIDTH: W, HEIGHT: H };
