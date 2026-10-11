// ===== HỆ THỐNG TTL (tự xoá tin nhắn) — viết lại hoàn toàn =====
//
// Zalo CHỈ tự xoá tin nhắn khi ttl >= 60 giây (nhỏ hơn bị bỏ qua im lặng)
// và TỪ CHỐI tin có ttl quá lớn. Vì vậy mọi giá trị đi qua đây đều được:
//   1) Hiểu theo ĐƠN VỊ con người trong config: 30s / 2m / 1h / 1d (hoặc ms thuần)
//   2) Kẹp về khoản an toàn: tối thiểu 60s, tối đa 7 ngày
//   3) Mặc định theo LOẠI tin (thường, lỗi, media, thẻ, menu, nhạc, spam...)
//
// Cách dùng:
//   const ttl = require("./ttl");
//   ttl.ms("message")                 → số ms dùng cho sendMessage
//   ttl.normalize(options.ttl, "media") → ttl của lệnh, đã kẹp an toàn
//   ttl.normalize(0)                  → bỏ tự xoá (Zalo giữ tin)
const UNIT_MS = {
  ms: 1,
  s: 1000,
  sec: 1000,
  m: 60000,
  min: 60000,
  h: 3600000,
  hr: 3600000,
  hour: 3600000,
  d: 86400000,
  day: 86400000
};

const MIN_TTL_MS = 60000; // Zalo bỏ qua ttl < 60s
const MAX_TTL_MS = 7 * 24 * 3600 * 1000; // quá 7 ngày Zalo từ chối

// Mặc định theo loại tin — dùng khi config thiếu/không đọc được
const DEFAULTS = {
  message: 60000,   // tin thông báo ngắn
  error: 120000,    // thông báo lỗi (cần đọc kỹ hơn)
  info: 120000,     // thẻ thông tin / hướng dẫn
  media: 300000,    // ảnh / video / voice / gif
  card: 180000,     // thẻ canvas đẹp
  menu: 300000,     // menu ảnh (người dùng soi kỹ)
  music: 300000,    // kết quả tìm nhạc + đang phát
  spam: 60000,      // tin spam (nhiều tin, xoá nhanh cho nhóm sạch)
  sticker: 60000    // sticker spam
};

// "2m" → 120000 | "5000" → 5000 | "" → null
function parseDuration(value) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const match = String(value).trim().match(/^(\d+(?:\.\d+)?)\s*(ms|s|sec|m|min|h|hr|hour|d|day)?$/i);
  if (!match) return null;
  const amount = Number(match[1]);
  const unit = (match[2] || "ms").toLowerCase();
  return amount * UNIT_MS[unit];
}

function clamp(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return 0; // <= 0 nghĩa là KHÔNG tự xoá
  return Math.min(Math.max(Math.round(ms), MIN_TTL_MS), MAX_TTL_MS);
}

function configTtl() {
  const raw = global.config?.ttl || {};
  const parsed = {};
  for (const [key, value] of Object.entries(raw)) {
    const ms = parseDuration(value);
    if (ms !== null) parsed[key] = clamp(ms);
  }
  return parsed;
}

// TTL theo loại tin (ms) — trả về luôn đã kẹp an toàn
function ms(kind = "message") {
  const parsed = configTtl();
  return parsed[kind] || DEFAULTS[kind] || DEFAULTS.message;
}

// TTL do lệnh tự chỉ định; không hợp lệ/không có → theo loại tin
function normalize(value, kind = "message") {
  const explicit = parseDuration(value);
  if (explicit === null) return ms(kind);
  return clamp(explicit);
}

module.exports = { ms, normalize, parseDuration, clamp, MIN_TTL_MS, MAX_TTL_MS, DEFAULTS };
