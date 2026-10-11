// ===== Thẻ VIP (reply.card / reply.text / reply.error...) — dùng theme chung =====
// Mọi ảnh bot gửi ra đều CÙNG một kiểu: nền, font, bo góc, bóng (xem theme.js).
// Muốn đổi hình dạng toàn bộ ảnh → sửa core/canvas/theme.js (1 chỗ).
const theme = require("./theme");
const { THEMES } = require("./index");

const WIDTH = theme.WIDTH;
const PADDING = 30;

// Emoji → ký tự an toàn khi máy không có font emoji (Linux minimal)
const EMOJI_FALLBACK = {
  "🎵": "♪", "🎧": "♫", "❤️": "❤", "✅": "✔", "❌": "✘", "⚠️": "!",
  "⏳": "...", "🚫": "×", "💡": "i", "🔎": "?", "📡": "#", "🎯": ">",
  "🤖": "AI", "🖼️": "[img]", "⏱": "⏱", "🔍": "?", "📺": "▶", "🌐": "@",
  "👉": ">", "📎": "♦", "💬": "☰", "⏰": "◷", "🏆": "★", "💰": "$",
  "🎲": "?", "🎮": ">", "⭐": "*", "💎": "◆", "🧩": "▤", "📌": "•",
  "🛠️": "+", "📊": "▥", "🔧": "+", "🧠": "◔", "📥": "↓", "🎬": "▶",
  "🚀": ">", "🔥": "^", "😉": "‿", "😁": "^", "😋": "~", "😴": "z",
  "🎉": "*", "🚿": "~", "🍚": "=", "📴": "×", "🛌": "_", "🌙": ")", "💤": "z"
};

let emojiReady = false;
let hasEmojiFont = false;

function sanitizeEmoji(text) {
  if (emojiReady) return text;
  // Không dò được font emoji → thay bằng ký tự ASCII cho chắc
  let out = "";
  for (const ch of String(text)) {
    out += hasEmojiFont ? ch : (EMOJI_FALLBACK[ch] || ch);
  }
  return out;
}

// Đo chiều cao thẻ theo nội dung (mỗi ảnh cao vừa đủ — không dư khoảng trắng)
function measure(spec) {
  const { ctx } = theme.newCanvas(100, 100);
  ctx.font = "17px JT";
  let height = 120 /* header */ + (spec.subtitle ? 52 : 0) + 22;

  const rows = Array.isArray(spec.rows) ? spec.rows : [];
  for (const row of rows) {
    const lines = Array.isArray(row.lines) ? row.lines : [String(row.lines || "")];
    let rowH = 40;
    for (const line of lines) {
      const wrapped = Math.max(1, Math.ceil(ctx.measureText(sanitizeEmoji(line)).width / (WIDTH - PADDING * 2 - 60)));
      rowH += wrapped * 30 + 8;
    }
    height += rowH + 18;
  }
  return { height: Math.max(height + 96, 260) };
}

async function renderVipCard(spec = {}) {
  const palette = theme.PALETTE;
  const themeColors = THEMES[spec.theme] || THEMES.brand;
  const accent = themeColors.accent || palette.accent;
  const accent2 = themeColors.accent2 || palette.accent2;

  const { height } = measure(spec);
  const { ctx, canvas } = theme.newCanvas(WIDTH, height);

  await theme.paintBackground(ctx, WIDTH, height);

  let y = 74;

  // ===== Tiêu đề =====
  const icon = spec.icon || (spec.theme === "error" ? "❌" : spec.theme === "success" ? "✅" : spec.theme === "music" ? "🎵" : spec.theme === "info" ? "💡" : "⚡");
  theme.text(ctx, sanitizeEmoji(icon), PADDING, y, { font: "34px JT", color: accent });
  theme.text(ctx, String(spec.title || "").toUpperCase(), PADDING + 52, y, {
    font: "bold 33px JT-Bold", color: palette.ink, maxWidth: WIDTH - PADDING * 2 - 110
  });

  // Chip hiển thị TTL (tin tự xoá sau bao lâu) — cùng kiểu chip ở mọi thẻ
  const ttlMs = Number(spec.ttl) || 0;
  const ttlText = ttlMs > 0 ? `⏳ ${Math.round(ttlMs / 1000)}s` : "♾️ không tự xoá";
  ctx.font = "bold 14px JT-Bold";
  const chipW = ctx.measureText(ttlText).width + 22;
  ctx.fillStyle = "rgba(255,255,255,.08)";
  theme.roundRect(ctx, WIDTH - PADDING - chipW, y - 24, chipW, 27, 14);
  ctx.fill();
  ctx.strokeStyle = accent;
  ctx.globalAlpha = 0.4;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.globalAlpha = 1;
  theme.text(ctx, ttlText, WIDTH - PADDING - chipW / 2, y - 5, { font: "bold 14px JT-Bold", color: accent, align: "center" });
  y += 42;

  // ===== Mô tả ngắn =====
  if (spec.subtitle) {
    theme.text(ctx, sanitizeEmoji(String(spec.subtitle)), PADDING, y + 4, {
      font: "18px JT", color: palette.ink2, maxWidth: WIDTH - PADDING * 2
    });
    y += 50;
  }

  // ===== Các khối nội dung =====
  const rows = Array.isArray(spec.rows) ? spec.rows : [];
  for (const row of rows) {
    if (!row) continue;
    const lines = Array.isArray(row.lines) ? row.lines : [String(row.lines || "")];
    theme.panel(ctx, PADDING, y - 18, WIDTH - PADDING * 2, 32 + lines.length * 26, 12, row.tone === "error" ? palette.red : accent);
    y += 2;

    if (row.label) {
      theme.text(ctx, sanitizeEmoji(row.label), WIDTH - PADDING - 170, y, {
        font: "14px JT", color: palette.mute, maxWidth: 150
      });
    }
    if (row.icon) {
      theme.text(ctx, sanitizeEmoji(row.icon), PADDING + 16, y + 4, { font: "20px JT", color: row.tone === "error" ? palette.red : accent2 });
    }

    let ly = y;
    for (const line of lines) {
      ly += 30;
      theme.text(ctx, sanitizeEmoji(String(line)), PADDING + 44, ly, {
        font: row.strong ? "bold 17px JT-Bold" : "16px JT",
        color: row.strong ? palette.ink : palette.ink2,
        maxWidth: WIDTH - PADDING * 2 - 62
      });
    }
    y = ly + 26;
  }

  // ===== Footer thương hiệu =====
  theme.text(ctx, String(spec.footer || "ᴶᴼᴴᴺ ᵀᴿᴬᴺ"), WIDTH / 2, height - 40, {
    font: "bold 18px JT-Bold", color: palette.mute, align: "center"
  });

  return theme.save(canvas, "card");
}

module.exports = { renderVipCard, WIDTH, EMOJI_FALLBACK };
