// /card — Thẻ hồ sơ kiểu Kenne400k (avatar tròn + thông tin bên phải)
// Tham khảo layout từ Kenne400k/filebotha-leak modules/commands/card.js
// Nhưng viết lại hoàn toàn cho Zalo API (không dùng Facebook token).
//
// Layout gốc (Kenne400k): nền ảnh → avatar tròn bên trái (162,96 232x232)
// → thông tin xếp cột bên phải (x=820): tên, sinh nhật, giới tính, follow,
// mối quan hệ, nơi ở, quê hương, UID → link profile ở dưới.
const fs = require("fs");
const os = require("os");
const path = require("path");
const http = require("../../core/http");
const { fetchProfile } = require("../../core/zaloProfile");
const { Jimp } = require("jimp");

const BG = path.join(__dirname, "..", "..", "assets", "bg", "theme.jpg");

module.exports.config = {
  name: "card",
  aliases: ["cardinfo", "userinfo", "info"],
  version: "3.0.0",
  role: 0,
  author: "ᴶᴼᴴᴺ ᵀᴿᴬᴺ",
  description: "Thẻ hồ sơ người dùng (avatar tròn + thông tin)",
  category: "Tiện ích",
  usage: "card (reply) | card <uid> | card box",
  cooldowns: 5,
  dependencies: {}
};

// Cắt ảnh thành hình tròn (jimp circle) — đúng cách Kenne400k làm
async function circle(image) {
  const img = await Jimp.read(image);
  img.circle();
  return await img.getBufferAsync("image/png");
}

function genderText(g) {
  const n = Number(g);
  if (n === 1) return "Nam";
  if (n === 2) return "Nữ";
  return "Không công khai";
}

function dobText(dob, sdob) {
  if (sdob) return String(sdob);
  if (!dob) return "không công khai";
  const d = new Date(Number(dob) * 1000);
  if (Number.isNaN(d.getTime())) return "không công khai";
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

module.exports.run = async function ({ api, event, args, reply }) {
  const { threadId, type, data } = event;
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "jt_card_"));
  const bgPath = path.join(tmpDir, "bg.png");
  const avtPath = path.join(tmpDir, "avt.png");

  try {
    await api.sendMessage({ msg: "⏳ Đang tạo thẻ...", plain: true }, threadId, type);

    // ---- chọn uid: reply → uid → chính mình ----
    let uid = null;
    const quote = data?.quote;
    if (Array.isArray(quote?.mentions) && quote.mentions[0]?.uid) uid = String(quote.mentions[0].uid);
    else if (args[0] && /^\d{6,}$/.test(args[0])) uid = args[0];
    else if (data?.mentions && Object.keys(data.mentions)[0]) uid = String(Object.keys(data.mentions)[0]);
    else if (quote?.uidFrom) uid = String(quote.uidFrom);
    else uid = String(data.uidFrom);

    const { user } = await fetchProfile(api, uid);
    if (!user) return reply.error(`Không đọc được hồ sơ của ${uid}.`);

    // ---- nền: ảnh theme (images.jpeg của bạn) ----
    const bgBuffer = fs.existsSync(BG) ? fs.readFileSync(BG) : await (async () => {
      // fallback: nền trơn nếu thiếu ảnh
      const { createCanvas } = require("canvas");
      const c = createCanvas(750, 520);
      const ctx = c.getContext("2d");
      const g = ctx.createLinearGradient(0, 0, 750, 520);
      g.addColorStop(0, "#070a14"); g.addColorStop(1, "#111735");
      ctx.fillStyle = g; ctx.fillRect(0, 0, 750, 520);
      return c.toBuffer("image/png");
    })();
    fs.writeFileSync(bgPath, bgBuffer);

    // ---- avatar tròn ----
    let avatarCircle = null;
    const avatar = String(user.avatar || "").trim();
    if (/^https?:\/\//i.test(avatar)) {
      const { buffer } = await http.getBuffer(avatar, { timeout: 20000 });
      fs.writeFileSync(avtPath, buffer);
      avatarCircle = await circle(avtPath);
    }

    // ---- vẽ thẻ ----
    const { loadImage, createCanvas, registerFont } = require("canvas");
    const bg = await loadImage(bgPath);

    const W = 750, H = 520;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext("2d");

    // phủ nền
    const s = Math.max(W / bg.width, H / bg.height);
    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.drawImage(bg, (W - bg.width * s) / 2, (H - bg.height * s) / 2, bg.width * s, bg.height * s);
    ctx.restore();
    // lớp tối cho chữ rõ
    ctx.fillStyle = "rgba(6,9,22,.62)";
    ctx.fillRect(0, 0, W, H);

    // font
    const fontBold = process.platform === "win32" ? "C:\\Windows\\Fonts\\arialbd.ttf" : "/System/Library/Fonts/Supplemental/Arial Bold.ttf";
    try { registerFont(fontBold, { family: "CardBold" }); } catch { /* bỏ qua */ }

    // avatar tròn bên trái (theo tỉ lệ Kenne400k: 232/1280 ≈ 18% chiều rộng)
    const avSize = 210;
    const avX = 44, avY = 96;
    if (avatarCircle) {
      const av = await loadImage(avatarCircle);
      ctx.save();
      ctx.beginPath();
      ctx.arc(avX + avSize / 2, avY + avSize / 2, avSize / 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(av, avX, avY, avSize, avSize);
      ctx.restore();
      // viền sáng
      ctx.lineWidth = 4;
      ctx.strokeStyle = "#38bdf8";
      ctx.beginPath();
      ctx.arc(avX + avSize / 2, avY + avSize / 2, avSize / 2 + 3, 0, Math.PI * 2);
      ctx.stroke();
    }

    // tên (bên phải avatar)
    const infoX = avX + avSize + 36;
    const infoW = W - infoX - 40;
    ctx.font = "34px CardBold, sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "left";
    ctx.fillText(String(user.displayName || user.zaloName || "—").slice(0, 22), infoX, 140);

    // cột thông tin
    const rows = [
      ["» Sinh nhật", dobText(user.dob, user.sdob)],
      ["» Giới tính", genderText(user.gender)],
      ["» Bạn bè", Number(user.isFr) === 1 ? "Có" : "Chưa kết bạn"],
      ["» Trạng thái", user.status ? String(user.status).slice(0, 26) : "Không có"],
      ["» UID", uid]
    ];
    let y = 196;
    for (const [label, value] of rows) {
      ctx.font = "21px sans-serif";
      ctx.fillStyle = "#38bdf8";
      ctx.fillText(`${label}:`, infoX, y);
      ctx.font = "21px sans-serif";
      ctx.fillStyle = "#e8eefc";
      ctx.fillText(String(value), infoX + 130, y);
      y += 46;
    }

    // (lớp tối đã phủ ngay sau ảnh nền — KHÔNG phủ sau chữ, không thì mất chữ)

    const outPath = path.join(tmpDir, "card.png");
    fs.writeFileSync(outPath, canvas.toBuffer("image/png"));
    await api.sendMessage({ msg: "", attachments: [outPath], ttlKind: "card" }, threadId, type);
  } catch (error) {
    console.error("card:", error.message);
    return reply.error(`Tạo thẻ thất bại: ${error.message}`);
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* bỏ qua */ }
  }
};
