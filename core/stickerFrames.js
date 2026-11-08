const fs = require("fs");
const path = require("path");

const FRAME_DIR = path.join(__dirname, "..", "khung-stk");
const FRAMES = [
  { id: 1, name: "Mộng Vuốt Rồng", asset: "mong-vuot-rong.png" },
  { id: 2, name: "Nguyệt Quang", asset: "nguyet-quang.png" },
  { id: 3, name: "Kim Long", asset: "kim-long.png" },
  { id: 4, name: "Tinh Tú", asset: "tinh-tu.png" },
  { id: 5, name: "Hoa Anh Đào", asset: "hoa-anh-dao.png" }
];

function frameList() {
  return FRAMES.map(({ id, name }) => ({ id, name }));
}

function resolveFramePath(frameId) {
  const frame = FRAMES.find((item) => item.id === Number(frameId));
  if (!frame) {
    throw new Error(`Mẫu khung phải từ 1 đến ${FRAMES.length}`);
  }

  const framePath = path.join(FRAME_DIR, frame.asset);
  if (!fs.existsSync(framePath)) {
    throw new Error(`Không tìm thấy file khung sticker: ${framePath}`);
  }
  return framePath;
}

module.exports = { frameList, resolveFramePath };
