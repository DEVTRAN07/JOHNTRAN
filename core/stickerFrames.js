const fs = require("fs");
const path = require("path");
const { createCanvas } = require("canvas");

const SIZE = 480;
const CENTER = SIZE / 2;
const FRAMES = [
  { id: 1, name: "Mộng Vuốt Rồng", asset: "mong-vuot-rong.png" },
  { id: 2, name: "Nguyệt Quang", style: "moon" },
  { id: 3, name: "Kim Long", style: "gold" },
  { id: 4, name: "Tinh Tú", style: "stars" },
  { id: 5, name: "Hoa Anh Đào", style: "blossom" }
];

function frameList() {
  return FRAMES.map(({ id, name }) => ({ id, name }));
}

function addDiamond(ctx, x, y, radius, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = color;
  ctx.fillRect(-radius, -radius, radius * 2, radius * 2);
  ctx.restore();
}

function drawMoonFrame(ctx) {
  const gradient = ctx.createLinearGradient(46, 64, 434, 416);
  gradient.addColorStop(0, "#9efcff");
  gradient.addColorStop(0.5, "#a17aff");
  gradient.addColorStop(1, "#f5a8ff");
  ctx.strokeStyle = gradient;
  ctx.shadowColor = "#8b7bff";
  ctx.shadowBlur = 12;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(CENTER, CENTER, 190, 0, Math.PI * 2);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(201, 248, 255, 0.9)";
  ctx.beginPath();
  ctx.arc(CENTER, CENTER, 202, 0, Math.PI * 2);
  ctx.stroke();

  for (let i = 0; i < 16; i++) {
    const angle = (Math.PI * 2 * i) / 16;
    const radius = i % 2 === 0 ? 216 : 209;
    const x = CENTER + Math.cos(angle) * radius;
    const y = CENTER + Math.sin(angle) * radius;
    addDiamond(ctx, x, y, i % 2 === 0 ? 4 : 2.5, i % 2 === 0 ? "#fff3ad" : "#c2fcff");
  }
}

function drawGoldFrame(ctx) {
  const gold = ctx.createLinearGradient(30, 240, 450, 240);
  gold.addColorStop(0, "#7b4316");
  gold.addColorStop(0.25, "#ffda77");
  gold.addColorStop(0.5, "#fff3c4");
  gold.addColorStop(0.75, "#f4b745");
  gold.addColorStop(1, "#70400e");
  ctx.strokeStyle = gold;
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(CENTER, CENTER, 193, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = "rgba(255, 235, 171, 0.9)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(CENTER, CENTER, 208, 0, Math.PI * 2);
  ctx.stroke();

  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(CENTER + side * 222, CENTER);
    ctx.rotate(side * Math.PI / 2);
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.ellipse(-28 + i * 14, -4, 6, 14, Math.PI / 4, 0, Math.PI * 2);
      ctx.fillStyle = i % 2 ? "#f5c55e" : "#fff0bc";
      ctx.fill();
    }
    ctx.restore();
  }
  addDiamond(ctx, CENTER, 226, 11, "#fff0bc");
  addDiamond(ctx, CENTER, SIZE - 226, 11, "#fff0bc");
}

function drawStarsFrame(ctx) {
  const cyan = "#8ef8ff";
  const blue = "#6687ff";
  ctx.shadowColor = "#42cfff";
  ctx.shadowBlur = 15;
  ctx.strokeStyle = cyan;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(CENTER, CENTER, 190, -Math.PI * 0.82, Math.PI * 0.82);
  ctx.stroke();
  ctx.strokeStyle = blue;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(CENTER, CENTER, 190, Math.PI * 0.18, Math.PI * 0.82);
  ctx.stroke();
  ctx.shadowBlur = 0;

  for (let i = 0; i < 24; i++) {
    const angle = (Math.PI * 2 * i) / 24;
    const radius = i % 3 === 0 ? 222 : 208;
    const x = CENTER + Math.cos(angle) * radius;
    const y = CENTER + Math.sin(angle) * radius;
    const size = i % 3 === 0 ? 5 : 2.5;
    ctx.fillStyle = i % 2 ? cyan : "#fff4ba";
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
    if (i % 3 === 0) {
      ctx.globalAlpha = 0.75;
      ctx.fillRect(x - 1, y - 10, 2, 20);
      ctx.fillRect(x - 10, y - 1, 20, 2);
      ctx.globalAlpha = 1;
    }
  }
}

function drawBlossomFrame(ctx) {
  ctx.strokeStyle = "#ffb2d2";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(CENTER, CENTER, 192, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = "rgba(255, 224, 240, 0.9)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(CENTER, CENTER, 207, 0, Math.PI * 2);
  ctx.stroke();

  for (let i = 0; i < 12; i++) {
    const angle = (Math.PI * 2 * i) / 12;
    const radius = i % 2 ? 222 : 214;
    const x = CENTER + Math.cos(angle) * radius;
    const y = CENTER + Math.sin(angle) * radius;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    for (let petal = 0; petal < 5; petal++) {
      ctx.rotate((Math.PI * 2) / 5);
      ctx.beginPath();
      ctx.ellipse(0, -6, 3.5, 6, 0, 0, Math.PI * 2);
      ctx.fillStyle = petal % 2 ? "#ffd6e7" : "#ff9fc6";
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = "#fff1a8";
    ctx.fill();
    ctx.restore();
  }
}

function createFrameBuffer(frameId) {
  const frame = FRAMES.find((item) => item.id === Number(frameId));
  if (!frame) {
    throw new Error(`Không tìm thấy mẫu khung số ${frameId}`);
  }
  if (frame.asset) return null;

  const canvas = createCanvas(SIZE, SIZE);
  const ctx = canvas.getContext("2d");
  if (frame.style === "moon") drawMoonFrame(ctx);
  if (frame.style === "gold") drawGoldFrame(ctx);
  if (frame.style === "stars") drawStarsFrame(ctx);
  if (frame.style === "blossom") drawBlossomFrame(ctx);
  return canvas.toBuffer("image/png");
}

function resolveFramePath(frameId, outDir) {
  const frame = FRAMES.find((item) => item.id === Number(frameId));
  if (!frame) {
    throw new Error(`Mẫu khung phải từ 1 đến ${FRAMES.length}`);
  }
  if (frame.asset) return path.join(__dirname, "..", "khung-stk", frame.asset);

  fs.mkdirSync(outDir, { recursive: true });
  const frameDir = fs.mkdtempSync(path.join(outDir, `frame-${frame.id}-`));
  const framePath = path.join(frameDir, "frame.png");
  fs.writeFileSync(framePath, createFrameBuffer(frame.id));
  return framePath;
}

module.exports = { frameList, createFrameBuffer, resolveFramePath };
