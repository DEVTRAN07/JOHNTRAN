const path = require("path");
const { createCanvas, loadImage, registerFont } = require("canvas");
const { GroupEventType } = require("zalo-client");

const FONT_DIR = path.join(__dirname, "..", "..", "assets", "fonts");
const BG_DIR = path.join(__dirname, "..", "..", "assets", "bg");

let fontsReady = false;
function initFonts() {
  if (fontsReady) return;
  fontsReady = true;
  for (const font of ["Lobster-Regular.ttf", "Signika-SemiBold.ttf"]) {
    try {
      registerFont(path.join(FONT_DIR, font), { family: font.replace(".ttf", "") });
    } catch { /* bỏ qua */ }
  }
}

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = String(text).split(" ");
  let line = "";
  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + " ";
    if (ctx.measureText(testLine).width > maxWidth && n > 0) {
      ctx.fillText(line.trim(), x, y);
      line = words[n] + " ";
      y += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line.trim(), x, y);
}

async function getAvatar(url) {
  try {
    const { buffer } = await require("../../core/http").getBuffer(url, { timeout: 12000, retries: 1 });
    return loadImage(buffer);
  } catch {
    return null;
  }
}

async function makeWelcomeImage({ avatarUrl, name, groupName, memberCount }) {
  initFonts();
  const width = 1200, height = 500;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // background ngẫu nhiên
  try {
    const bgFiles = fs.readdirSync(BG_DIR).filter((f) => /\.(jpe?g|png)$/i.test(f));
    if (bgFiles.length > 0) {
      const bgPath = path.join(BG_DIR, bgFiles[Math.floor(Math.random() * bgFiles.length)]);
      const bg = await loadImage(bgPath);
      const imgRatio = bg.width / bg.height;
      const canvasRatio = width / height;
      let sx = 0, sy = 0, sWidth = bg.width, sHeight = bg.height;
      if (imgRatio > canvasRatio) { sWidth = sHeight * canvasRatio; sx = (bg.width - sWidth) / 2; }
      else { sHeight = sWidth / canvasRatio; sy = (bg.height - sHeight) / 2; }
      ctx.drawImage(bg, sx, sy, sWidth, sHeight, 0, 0, width, height);
    } else {
      ctx.fillStyle = "#2c2c2c";
      ctx.fillRect(0, 0, width, height);
    }
  } catch {
    ctx.fillStyle = "#2c2c2c";
    ctx.fillRect(0, 0, width, height);
  }

  // hộp kính
  const padding = 50;
  ctx.save();
  rr(ctx, padding, padding, width - padding * 2, height - padding * 2, 35);
  ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
  ctx.shadowColor = "rgba(0, 0, 0, 0.4)";
  ctx.shadowBlur = 80;
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();

  // avatar
  const avatarSize = 180;
  const avatarX = padding + 50;
  const avatarY = height / 2 - avatarSize / 2;
  ctx.save();
  ctx.beginPath();
  ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2 + 5, 0, Math.PI * 2);
  ctx.fillStyle = "#FFFFFF";
  ctx.shadowColor = "#FFFFFF";
  ctx.shadowBlur = 40;
  ctx.fill();
  ctx.restore();

  const avatar = await getAvatar(avatarUrl);
  ctx.save();
  ctx.beginPath();
  ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
  ctx.clip();
  if (avatar) ctx.drawImage(avatar, avatarX, avatarY, avatarSize, avatarSize);
  else {
    ctx.fillStyle = "#1f2937";
    ctx.fillRect(avatarX, avatarY, avatarSize, avatarSize);
  }
  ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.restore();

  // chữ
  const textAreaX = avatarX + avatarSize + 50;
  const textAreaY = padding + 140;
  const maxWidth = width - padding * 2 - (avatarX - padding) - avatarSize - 70;
  const rainbowColors = ["#ff3838", "#ff9f1a", "#fff200", "#32ff7e", "#18dcff", "#7d5fff", "#f368e0"];

  ctx.font = `bold 40px "Signika-SemiBold"`;
  const welcomeText = "WELCOME";
  ctx.fillStyle = "#FFFFFF";
  ctx.shadowColor = "rgba(50, 255, 200, 0.9)";
  ctx.shadowBlur = 40;
  ctx.fillText(welcomeText, textAreaX, textAreaY);
  ctx.shadowColor = "transparent";

  const welcomeMetrics = ctx.measureText(welcomeText);
  let nameFontSize = 40;
  const nameText = ` ${name}`;
  ctx.font = `bold ${nameFontSize}px "Lobster-Regular"`;
  while (welcomeMetrics.width + ctx.measureText(nameText).width > maxWidth && nameFontSize > 10) {
    nameFontSize--;
    ctx.font = `bold ${nameFontSize}px "Lobster-Regular"`;
  }

  const nameX = textAreaX + welcomeMetrics.width;
  const nameWidth = ctx.measureText(nameText).width;
  const nameGrad = ctx.createLinearGradient(nameX, 0, nameX + nameWidth, 0);
  rainbowColors.forEach((color, i) => nameGrad.addColorStop(i / (rainbowColors.length - 1), color));
  ctx.fillStyle = nameGrad;
  ctx.shadowColor = "rgba(255, 255, 255, 0.95)";
  ctx.shadowBlur = 35;
  ctx.fillText(nameText, nameX, textAreaY);
  ctx.shadowColor = "transparent";

  ctx.font = "20px \"Signika-SemiBold\"";
  ctx.fillStyle = "#FFFFFF";
  ctx.fillText(`Là thành viên thứ ${memberCount} của nhóm ${groupName}.`, textAreaX, textAreaY + 60);

  ctx.font = "15px \"Signika-SemiBold\"";
  ctx.fillStyle = "#FFFFFF";
  wrapText(ctx, "Chúc bạn có những giây phút vui vẻ và ý nghĩa!", textAreaX, textAreaY + 105, maxWidth, 30);

  return canvas.toBuffer("image/png");
}

const fs = require("fs");

module.exports.config = {
  event_type: ["group_event"],
  name: "userjoin",
  version: "2.0.0",
  author: "ᴶᴼᴴᴺ ᵀᴿᴬᴺ",
  description: "Chào đón thành viên mới bằng ảnh canvas"
};

module.exports.run = async function ({ api, event }) {
  if (event.type !== GroupEventType.JOIN) return;
  const { threadId, data } = event;
  if (!data || !Array.isArray(data.updateMembers) || data.updateMembers.length === 0) return;

  const ownId = await api.getOwnId();
  const newMembers = data.updateMembers.filter((m) => String(m.id) !== String(ownId));
  if (newMembers.length === 0) return;

  const tempDir = path.join(__dirname, "temp");
  try {
    fs.mkdirSync(tempDir, { recursive: true });

    const info = await api.getGroupInfo(threadId);
    const groupInfo = info?.gridInfoMap?.[threadId];
    const groupName = groupInfo?.name || "nhóm";
    const memberCount = groupInfo?.totalMember || newMembers.length;

    for (const member of newMembers.slice(0, 5)) {
      const imgBuffer = await makeWelcomeImage({
        avatarUrl: member.avatar,
        name: member.dName,
        groupName,
        memberCount
      });
      const imgPath = path.join(tempDir, `welcome_${member.id}.png`);
      fs.writeFileSync(imgPath, imgBuffer);

      await api.sendMessage(
        { msg: "", attachments: imgPath, ttl: 120000 },
        threadId,
        1
      );
      fs.unlinkSync(imgPath);
    }
  } catch (err) {
    console.error("Lỗi userjoin:", err.message);
  }
};
