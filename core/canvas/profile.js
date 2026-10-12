// ===== RENDERER MỚI CHO THẺ HỒ SƠ (getavt / cardzalo / cardtiktok / cardfb) =====
// Thiết kế hoàn toàn mới, độc lập với core/canvas/vip.js + theme.js.
// Đặc điểm: thẻ dọc, avatar tròn viền sáng, hàng thông tin có icon,
// mỗi loại hồ sơ một màu chủ đạo riêng.
const fs = require("fs");
const os = require("os");
const path = require("path");
const { createCanvas, loadImage, registerFont } = require("canvas");

const WIDTH = 750;
const PAD = 44;
const BG_IMAGE = path.join(__dirname, "..", "..", "assets", "bg", "theme.jpg");

// Bảng màu theo loại hồ sơ — chỉ ăn với bộ mới này
const SKINS = {
  zalo:    { name: "ZALO",     a: "#0068ff", b: "#00c8ff", glow: "rgba(0,140,255,.35)",  icon: "🟦" },
  tiktok:  { name: "TIKTOK",   a: "#00e5d0", b: "#ff2e63", glow: "rgba(0,229,208,.30)",  icon: "🎵" },
  facebook:{ name: "FACEBOOK", a: "#1877f2", b: "#4267b2", glow: "rgba(24,119,242,.32)",  icon: "📘" },
  neutral: { name: "PROFILE",  a: "#a78bfa", b: "#38bdf8", glow: "rgba(167,139,250,.30)", icon: "🪪" }
};

let fontReady = false;
function fonts() {
  if (fontReady) return;
  fontReady = true;
  const add = (p, f) => { try { if (fs.existsSync(p)) registerFont(p, { family: f }); } catch { /* bỏ qua */ } };
  if (process.platform === "darwin") {
    add("/System/Library/Fonts/Supplemental/Arial.ttf", "P");
    add("/System/Library/Fonts/Supplemental/Arial Bold.ttf", "PB");
  } else if (process.platform === "win32") {
    add("C:\\Windows\\Fonts\\arial.ttf", "P");
    add("C:\\Windows\\Fonts\\arialbd.ttf", "PB");
  } else {
    add("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "P");
    add("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", "PB");
  }
}

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x, y, r);
  ctx.closePath();
}

function fit(ctx, text, w) {
  let t = String(text ?? "");
  if (ctx.measureText(t).width <= w) return t;
  while (t.length > 1 && ctx.measureText(t + "…").width > w) t = t.slice(0, -1);
  return t + "…";
}

async function loadImg(url) {
  // Zalo trả avatar kiểu "/default" hoặc "" khi người dùng chưa đặt ảnh —
  // không phải URL đầy đủ, phải bỏ qua chứ không ném lỗi
  if (!url || !/^https?:\/\//i.test(String(url).trim())) return null;
  try {
    const mod = /^https:/i.test(String(url)) ? require("https") : require("http");
    const buffer = await new Promise((resolve, reject) => {
      mod.get(url, { timeout: 12000 }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return mod.get(res.headers.location, { timeout: 12000 }, (r2) => {
            const chunks = [];
            r2.on("data", (c) => chunks.push(c));
            r2.on("end", () => resolve(Buffer.concat(chunks)));
          }).on("error", reject);
        }
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve(Buffer.concat(chunks)));
      }).on("error", reject);
    });
    return await loadImage(buffer);
  } catch {
    return null;
  }
}

/**
 * Vẽ thẻ hồ sơ kiểu MỚI.
 * @param {object} o
 * @param {string} o.skin     "zalo" | "tiktok" | "facebook" | "neutral"
 * @param {string} o.title    tên người dùng
 * @param {string} o.handle   @username / UID
 * @param {string} o.avatar   url ảnh đại diện (nền mờ + ảnh tròn)
 * @param {Array}  o.rows     [{icon,label,value}]
 * @param {string} o.subtitle dòng phụ dưới tên
 * @param {string} o.footer   chữ chân thẻ
 */
async function renderProfile(o = {}) {
  fonts();
  const skin = SKINS[o.skin] || SKINS.neutral;
  const rows = Array.isArray(o.rows) ? o.rows.filter(Boolean).slice(0, 7) : [];

  const avatarSize = 190;
  const rowH = 62;
  const headerH = 132 + avatarSize + 62;
  const bodyH = rows.length ? rows.length * rowH + 40 : 40;
  const H = headerH + bodyH + 74;

  const canvas = createCanvas(WIDTH, H);
  const ctx = canvas.getContext("2d");
  ctx.quality = "best";

  // ===== Nền: ảnh theme + gradient màu riêng của loại hồ sơ =====
  const g = ctx.createLinearGradient(0, 0, WIDTH, H);
  g.addColorStop(0, "#060913");
  g.addColorStop(0.55, "#0b1020");
  g.addColorStop(1, "#060913");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, WIDTH, H);

  const bg = await loadImg(BG_IMAGE);
  if (bg) {
    const s = Math.max(WIDTH / bg.width, H / bg.height);
    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.drawImage(bg, (WIDTH - bg.width * s) / 2, (H - bg.height * s) / 2, bg.width * s, bg.height * s);
    ctx.restore();
  }

  // vệt màu chủ đạo + mạch gradient đặc trưng
  const stripe = ctx.createLinearGradient(0, 0, 0, 190);
  stripe.addColorStop(0, skin.a);
  stripe.addColorStop(1, skin.b);
  ctx.save();
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = stripe;
  ctx.fillRect(0, 0, WIDTH, 190);
  ctx.restore();
  ctx.save();
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = skin.glow;
  ctx.fillRect(0, 150, WIDTH, 40);
  ctx.restore();

  // ===== Avatar tròn viền sáng =====
  const av = await loadImg(o.avatar);
  const cx = WIDTH / 2;
  const cy = 132 + avatarSize / 2 + 40;
  if (av) {
    // nền mờ phía sau
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.drawImage(av, 0, 190, WIDTH, H - 190);
    ctx.restore();
    // ảnh tròn
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, avatarSize / 2, 0, Math.PI * 2);
    ctx.clip();
    const s = Math.max(avatarSize / av.width, avatarSize / av.height);
    ctx.drawImage(av, cx - (av.width * s) / 2, cy - (av.height * s) / 2, av.width * s, av.height * s);
    ctx.restore();
  } else {
    ctx.fillStyle = "rgba(255,255,255,.08)";
    ctx.beginPath();
    ctx.arc(cx, cy, avatarSize / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = "60px P";
    ctx.fillStyle = skin.a;
    ctx.textAlign = "center";
    ctx.fillText("👤", cx, cy + 22);
    ctx.textAlign = "left";
  }
  // viền
  ctx.lineWidth = 6;
  ctx.strokeStyle = skin.b;
  ctx.beginPath();
  ctx.arc(cx, cy, avatarSize / 2 + 4, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(255,255,255,.5)";
  ctx.beginPath();
  ctx.arc(cx, cy, avatarSize / 2 + 12, 0, Math.PI * 2);
  ctx.stroke();

  // ===== Tên + handle =====
  ctx.textAlign = "center";
  ctx.font = "bold 40px PB";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(fit(ctx, o.title || "—", WIDTH - PAD * 2), cx, cy + avatarSize / 2 + 52);
  if (o.handle) {
    ctx.font = "22px P";
    ctx.fillStyle = skin.b;
    ctx.fillText(fit(ctx, o.handle, WIDTH - PAD * 2), cx, cy + avatarSize / 2 + 84);
  }
  if (o.subtitle) {
    ctx.font = "19px P";
    ctx.fillStyle = "#aab6cf";
    ctx.fillText(fit(ctx, o.subtitle, WIDTH - PAD * 2), cx, cy + avatarSize / 2 + 112);
  }
  ctx.textAlign = "left";

  // ===== Các hàng thông tin =====
  let y = headerH + 16;
  for (const row of rows) {
    // hộp
    ctx.fillStyle = "rgba(9,14,28,.72)";
    rr(ctx, PAD, y, WIDTH - PAD * 2, rowH - 12, 12);
    ctx.fill();
    ctx.strokeStyle = skin.a;
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.globalAlpha = 1;

    // icon ô tròn
    ctx.fillStyle = `${skin.a}33`;
    ctx.beginPath();
    ctx.arc(PAD + 36, y + (rowH - 12) / 2, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = "22px P";
    ctx.textAlign = "center";
    ctx.fillText(row.icon || "•", PAD + 36, y + (rowH - 12) / 2 + 8);
    ctx.textAlign = "left";

    // nhãn + giá trị
    ctx.font = "15px P";
    ctx.fillStyle = "#7c8aa5";
    ctx.fillText(String(row.label || "").toUpperCase(), PAD + 68, y + 24);
    ctx.font = "bold 19px PB";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(fit(ctx, row.value ?? "—", WIDTH - PAD * 2 - 90), PAD + 68, y + 46);

    y += rowH;
  }

  // ===== Nhãn loại + chân thẻ =====
  const tagW = 190;
  ctx.fillStyle = `${skin.a}2e`;
  rr(ctx, PAD, H - 56, tagW, 34, 17);
  ctx.fill();
  ctx.strokeStyle = skin.a;
  ctx.globalAlpha = 0.6;
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.font = "bold 16px PB";
  ctx.fillStyle = skin.b;
  ctx.textAlign = "center";
  ctx.fillText(`${skin.icon} ${skin.name}`, PAD + tagW / 2, H - 33);
  ctx.textAlign = "left";

  ctx.font = "bold 16px PB";
  ctx.fillStyle = "#6b7a99";
  ctx.textAlign = "right";
  ctx.fillText(String(o.footer || "ᴶᴼᴴᴺ ᵀᴿᴬᴺ"), WIDTH - PAD, H - 33);
  ctx.textAlign = "left";

  const filePath = path.join(os.tmpdir(), `jt_prof_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.png`);
  fs.writeFileSync(filePath, canvas.toBuffer("image/png"));
  return filePath;
}

/** Tải ảnh về file tạm (dùng cho getavt) */
async function downloadImage(url, prefix = "avt") {
  const img = await loadImg(url);
  if (!img) return null;
  const filePath = path.join(os.tmpdir(), `jt_${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.png`);
  fs.writeFileSync(filePath, img.toBuffer("image/png"));
  return filePath;
}

function cleanup(filePath) {
  try { if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch { /* bỏ qua */ }
}

module.exports = { renderProfile, downloadImage, cleanup, SKINS, WIDTH };
