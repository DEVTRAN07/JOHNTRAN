// ===== Thẻ nhạc — dùng theme chung (core/canvas/theme.js) =====
// Kích thước viết theo cỡ 750 rồi scale theo theme.WIDTH (config canvas.width).
const theme = require("./theme");

// Số lượt nghe gọn: 12345 → 12K, 1234567 → 1.2M
function shortPlays(n) {
  const value = Number(n) || 0;
  if (value >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(0)}K`;
  return String(value);
}

function formatDuration(seconds) {
  const total = Number(seconds) || 0;
  return `${Math.floor(total / 60)}:${String(Math.floor(total % 60)).padStart(2, "0")}`;
}

async function fetchThumb(url) {
  if (!url) return null;
  try {
    const { buffer } = await require("../http").getBuffer(url, { timeout: 10000, retries: 1 });
    return await require("canvas").loadImage(buffer);
  } catch {
    return null;
  }
}

// ===== Lưới kết quả tìm kiếm (4 bài/trang, đọc rõ trên điện thoại) =====
async function renderSearchGrid(query, tracks, { page = 1, totalPages = 1, source }) {
  theme.initFonts();
  const S = theme.S;
  const W = theme.WIDTH;
  const { PALETTE, panel, button, text } = theme;

  const perPage = 4;
  const shown = tracks.slice(0, perPage);
  const cardW = W - S(44);
  const cardH = S(190);
  const gapY = S(12);
  const headerH = S(108);
  const footerH = S(130);
  const H = headerH + shown.length * cardH + Math.max(0, shown.length - 1) * gapY + footerH;

  const { ctx, canvas } = theme.newCanvas(W, H);
  await theme.paintBackground(ctx, W, H);

  // ===== Header =====
  text(ctx, "🔎", S(22), S(52), { size: 32, color: PALETTE.accent });
  text(ctx, theme.truncate(ctx, query, W - S(130)), W / 2, S(52), {
    size: 32, family: "JT-Display-Bold", color: PALETTE.ink, align: "center", maxWidth: W - S(130)
  });
  text(
    ctx,
    `🎵 ${shown.length} bài  •  📡 ${source || "SoundCloud"}  •  🔥 nghe nhiều nhất`,
    W / 2, S(84),
    { size: 16, family: "JT-Mono", color: PALETTE.ink2, align: "center" }
  );

  // Nạp sẵn ảnh bìa (không await trong forEach được)
  const covers = [];
  for (const track of shown) covers.push(await fetchThumb(track.thumbnail));

  // ===== Danh sách bài =====
  shown.forEach((track, index) => {
    const x = S(22);
    const y = headerH + index * (cardH + gapY);

    panel(ctx, x, y, cardW, cardH, S(14));

    // ảnh bìa vuông bên trái
    const coverSize = cardH - S(36);
    const cover = covers[index];
    if (cover) {
      ctx.save();
      theme.roundRect(ctx, x + S(18), y + S(18), coverSize, coverSize, S(12));
      ctx.clip();
      ctx.drawImage(cover, x + S(18), y + S(18), coverSize, coverSize);
      ctx.restore();
    } else {
      ctx.fillStyle = "rgba(56, 189, 248, .12)";
      theme.roundRect(ctx, x + S(18), y + S(18), coverSize, coverSize, S(12));
      ctx.fill();
      text(ctx, "🎵", x + S(18) + coverSize / 2, y + S(18) + coverSize / 2 + S(16), { size: 34, color: PALETTE.accent, align: "center" });
    }

    // số thứ tự nổi trên ảnh bìa
    ctx.fillStyle = "rgba(7, 10, 20, .82)";
    theme.roundRect(ctx, x + S(28), y + S(28), S(40), S(30), S(8));
    ctx.fill();
    text(ctx, String(index + 1), x + S(48), y + S(51), { size: 20, family: "JT-Bold", color: PALETTE.accent, align: "center" });

    // thông tin bài bên phải
    const infoX = x + coverSize + S(34);
    const infoW = cardW - coverSize - S(52);
    text(ctx, track.title, infoX, y + S(56), { size: 22, family: "JT-Round-Bold", color: PALETTE.ink, maxWidth: infoW });
    text(ctx, `♫ ${track.artist} • ${formatDuration(track.duration)}`, infoX, y + S(92), { size: 16, family: "JT-Mono", color: PALETTE.ink2, maxWidth: infoW });
    text(
      ctx,
      `👤 ${shortPlays(track.plays)} nghe  •  ❤️ ${shortPlays(track.likes)}`,
      infoX, y + S(124),
      { size: 15, family: "JT-Bold", color: PALETTE.green, maxWidth: infoW }
    );
  });

  // ===== Footer điều hướng: 3 nút emoji =====
  const footY = H - footerH + S(16);
  const btnW = (W - S(44) - S(20)) / 3;
  button(ctx, S(22), footY, btnW, S(46), "⬅ PREV", PALETTE.gold);
  text(ctx, `📄 ${page}/${totalPages}`, W / 2, footY + S(30), { size: 22, family: "JT-Bold", color: PALETTE.ink, align: "center" });
  button(ctx, S(22) + btnW + S(10), footY, btnW - S(10), S(46), "❌ OUT", PALETTE.red);
  button(ctx, S(22) + btnW * 2 + S(20), footY, btnW, S(46), "NEXT ➡", PALETTE.green);

  text(
    ctx,
    `⌨️ ${global.config.prefix}scl <số> để tải bài  •  gõ trần next / prev / out`,
    W / 2, footY + S(84),
    { size: 15, family: "JT-Mono", color: PALETTE.ink2, align: "center" }
  );

  return theme.save(canvas, "music_grid");
}

// ===== Thẻ ĐANG PHÁT =====
async function renderNowPlaying(track, sourceLabel) {
  theme.initFonts();
  const S = theme.S;
  const W = theme.WIDTH;
  const { PALETTE, panel, text } = theme;

  const coverSize = S(300);
  const H = S(470);
  const { ctx, canvas } = theme.newCanvas(W, H);
  await theme.paintBackground(ctx, W, H);

  text(ctx, "🎶", S(24), S(56), { size: 34, color: PALETTE.accent });
  text(ctx, "ĐANG PHÁT", W / 2, S(56), { size: 32, family: "JT-Display-Bold", color: PALETTE.ink, align: "center" });

  const cover = await fetchThumb(track.thumbnail);
  const cx = (W - coverSize) / 2;
  const cy = S(74);
  if (cover) {
    ctx.save();
    theme.roundRect(ctx, cx, cy, coverSize, coverSize, S(20));
    ctx.clip();
    ctx.drawImage(cover, cx, cy, coverSize, coverSize);
    ctx.restore();
    ctx.strokeStyle = PALETTE.accent;
    ctx.lineWidth = S(3);
    theme.roundRect(ctx, cx, cy, coverSize, coverSize, S(20));
    ctx.stroke();
  } else {
    panel(ctx, cx, cy, coverSize, coverSize, S(20));
    text(ctx, "🎵", cx + coverSize / 2, cy + coverSize / 2 + S(22), { size: 70, color: PALETTE.accent, align: "center" });
  }

  text(ctx, track.title, W / 2, cy + coverSize + S(52), { size: 26, family: "JT-Display-Bold", color: PALETTE.ink, align: "center", maxWidth: W - S(60) });
  text(ctx, `♫ ${track.artist}  •  ⏱ ${formatDuration(track.duration)}`, W / 2, cy + coverSize + S(84), {
    size: 18, family: "JT-Mono", color: PALETTE.ink2, align: "center", maxWidth: W - S(60)
  });
  text(ctx, `📡 ${sourceLabel || track.source}${track.plays ? `  •  👤 ${shortPlays(track.plays)} lượt nghe` : ""}`, W / 2, cy + coverSize + S(114), {
    size: 16, family: "JT-Bold", color: PALETTE.accent, align: "center", maxWidth: W - S(60)
  });
  text(ctx, "➜ Đang tải file nhạc, vui lòng chờ...", W / 2, H - S(34), { size: 15, color: PALETTE.ink2, align: "center" });

  return theme.save(canvas, "music_now");
}

module.exports = { renderSearchGrid, renderNowPlaying };
