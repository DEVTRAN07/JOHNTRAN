// ===== PHÂN TÍCH ẢNH → GỢI Ý TỪ KHÓA TÌM STICKER =====
// Zalo không cho bot tạo sticker mới từ ảnh, nhưng CÓ thể tìm sticker CÓ SẴN
// trong kho (searchSticker). Module này phân tích màu chủ đạo + độ sáng của
// ảnh reply để gợi ý từ khóa, từ đó tìm sticker Zalo thật giống nhất.
const Jimp = require("jimp");

// Theo nhóm màu → từ khóa tiếng Việt tìm sticker
const HUE_KEYWORDS = [
  { max: 15,  min: -15, words: ["trái tim", "yêu", "đỏ"], label: "đỏ" },
  { max: 45,  min: 16,  words: ["mặt trời", "vàng", "cam"], label: "vàng/cam" },
  { max: 80,  min: 46,  words: ["cây xanh", "lá", "thực vật"], label: "xanh lá" },
  { max: 165, min: 81,  words: ["biển", "bầu trời", "mõi tim"], label: "xanh ngọc" },
  { max: 200, min: 166, words: ["bầu trời", "nước", "xanh"], label: "xanh dương" },
  { max: 260, min: 201, words: ["sao", "tím", "mơ"], label: "tím" },
  { max: 360, min: 261, words: ["trái tim", "yêu", "đỏ"], label: "hồng" }
];

// Ảnh tối/trắng đen → từ khóa riêng
const DARK_KEYWORDS = ["đêm", "ngủ", "trăng"];
const LIGHT_KEYWORDS = ["mây", "mặt trời", "trắng"];

function classify(rgb) {
  const [r, g, b] = rgb;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const brightness = (max + min) / 2;

  // gần như xám → theo độ sáng
  if (max - min < 25) {
    return brightness < 60 ? DARK_KEYWORDS : LIGHT_KEYWORDS;
  }

  // tính hue
  let hue;
  if (max === r) hue = ((g - b) / (max - min)) % 6;
  else if (max === g) hue = (b - r) / (max - min) + 2;
  else hue = (r - g) / (max - min) + 4;
  hue = Math.round(hue * 60);
  if (hue < 0) hue += 360;

  const hit = HUE_KEYWORDS.find((h) => hue <= h.max && hue >= h.min);
  return hit ? hit.words : ["mèo", "dễ thương"];
}

/**
 * @param {Buffer|string} src  buffer ảnh hoặc đường dẫn file
 * @returns {Promise<{keywords: string[], dominant: string, brightness: number}>}
 */
async function analyze(src) {
  const img = await Jimp.read(src);
  img.resize(64, 64);

  const counts = {};
  img.scan(0, 0, img.bitmap.width, img.bitmap.height, function (x, y, idx) {
    const d = this.bitmap.data;
    const key = `${Math.round(d[idx] / 32) * 32},${Math.round(d[idx + 1] / 32) * 32},${Math.round(d[idx + 2] / 32) * 32}`;
    counts[key] = (counts[key] || 0) + 1;
  });

  const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const [topKey] = ranked[0] || ["0,0,0"];
  const [r, g, b] = topKey.split(",").map(Number);
  const brightness = (Math.max(r, g, b) + Math.min(r, g, b)) / 2;

  const keywords = classify([r, g, b]);
  return {
    keywords,
    dominant: `rgb(${r},${g},${b})`,
    brightness: Math.round(brightness)
  };
}

module.exports = { analyze, classify };
