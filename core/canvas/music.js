// ===== Thẻ nhạc — cỡ 750px (Zalo giữ nguyên PNG) =====
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
  const W = theme.WIDTH;
  const { PALETTE, panel, button, text } = theme;

  const perPage = 4;
  const shown = tracks.slice(0, perPage);
  const cardW = W - 44;
  const cardH = 190;
  const gapY = 12;
  const headerH = 108;
  const footerH = 130;
  const H = headerH + shown.length * cardH + Math.max(0, shown.length - 1) * gapY + footerH;

  const { ctx, canvas } = theme.newCanvas(W, H);
  await theme.paintBackground(ctx, W, H);

  // ===== Header =====
  text(ctx, "🔎", 22, 52, { font: "32px JT", color: PALETTE.accent });
  text(ctx, theme.truncate(ctx, query, W - 120), W / 2, 52, {
    font: "bold 32px JT-Bold", color: PALETTE.ink, align: "center", maxWidth: W - 130
  });
  text(
    ctx,
    `🎵 ${shown.length} bài  •  📡 ${source || "SoundCloud"}  •  🔥 nghe nhiều nhất`,
    W / 2, 84,
    { font: "16px JT", color: PALETTE.ink2, align: "center" }
  );

  // Nạp sẵn ảnh bìa (không await trong forEach được)
  const covers = [];
  for (const track of shown) covers.push(await fetchThumb(track.thumbnail));

  // ===== Danh sách bài =====
  shown.forEach((track, index) => {
    const x = 22;
    const y = headerH + index * (cardH + gapY);

    panel(ctx, x, y, cardW, cardH);

    // ảnh bìa vuông bên trái
    const coverSize = cardH - 36;
    const cover = covers[index];
    if (cover) {
      ctx.save();
      theme.roundRect(ctx, x + 18, y + 18, coverSize, coverSize, 12);
      ctx.clip();
      ctx.drawImage(cover, x + 18, y + 18, coverSize, coverSize);
      ctx.restore();
    } else {
      ctx.fillStyle = "rgba(56, 189, 248, .12)";
      theme.roundRect(ctx, x + 18, y + 18, coverSize, coverSize, 12);
      ctx.fill();
      text(ctx, "🎵", x + 18 + coverSize / 2, y + 18 + coverSize / 2 + 16, { font: "34px JT", color: PALETTE.accent, align: "center" });
    }

    // số thứ tự nổi trên ảnh bìa
    ctx.fillStyle = "rgba(7, 10, 20, .82)";
    theme.roundRect(ctx, x + 28, y + 28, 40, 30, 8);
    ctx.fill();
    text(ctx, String(index + 1), x + 48, y + 51, { font: "bold 20px JT-Bold", color: PALETTE.accent, align: "center" });

    // thông tin bài bên phải
    const infoX = x + coverSize + 34;
    const infoW = cardW - coverSize - 52;
    text(ctx, track.title, infoX, y + 56, { font: "bold 22px JT-Bold", color: PALETTE.ink, maxWidth: infoW });
    text(ctx, `♫ ${track.artist} • ${formatDuration(track.duration)}`, infoX, y + 92, { font: "16px JT", color: PALETTE.ink2, maxWidth: infoW });
    text(
      ctx,
      `👤 ${shortPlays(track.plays)} nghe  •  ❤️ ${shortPlays(track.likes)}`,
      infoX, y + 124,
      { font: "bold 15px JT-Bold", color: PALETTE.green, maxWidth: infoW }
    );
  });

  // ===== Footer điều hướng =====
  const footY = H - footerH + 16;
  const btnW = (W - 44 - 20) / 3;
  button(ctx, 22, footY, btnW, 46, "⬅ PREV", PALETTE.gold);
  text(ctx, `📄 ${page}/${totalPages}`, W / 2, footY + 30, { font: "bold 22px JT-Bold", color: PALETTE.ink, align: "center" });
  button(ctx, 22 + btnW + 10, footY, btnW - 10, 46, "❌ OUT", PALETTE.red);
  button(ctx, 22 + btnW * 2 + 20, footY, btnW, 46, "NEXT ➡", PALETTE.green);

  text(
    ctx,
    `⌨️ ${global.config.prefix}scl <số> để tải bài  •  gõ trần next / prev / out`,
    W / 2, footY + 84,
    { font: "15px JT", color: PALETTE.ink2, align: "center" }
  );

  return theme.save(canvas, "music_grid");
}

// ===== Thẻ ĐANG PHÁT =====
async function renderNowPlaying(track, sourceLabel) {
  theme.initFonts();
  const W = theme.WIDTH;
  const { PALETTE, panel, text } = theme;

  const coverSize = 300;
  const H = 470;
  const { ctx, canvas } = theme.newCanvas(W, H);
  await theme.paintBackground(ctx, W, H);

  text(ctx, "🎶", 24, 56, { font: "34px JT", color: PALETTE.accent });
  text(ctx, "ĐANG PHÁT", W / 2, 56, { font: "bold 32px JT-Bold", color: PALETTE.ink, align: "center" });

  const cover = await fetchThumb(track.thumbnail);
  const cx = (W - coverSize) / 2;
  const cy = 74;
  if (cover) {
    ctx.save();
    theme.roundRect(ctx, cx, cy, coverSize, coverSize, 20);
    ctx.clip();
    ctx.drawImage(cover, cx, cy, coverSize, coverSize);
    ctx.restore();
    ctx.strokeStyle = PALETTE.accent;
    ctx.lineWidth = 3;
    theme.roundRect(ctx, cx, cy, coverSize, coverSize, 20);
    ctx.stroke();
  } else {
    panel(ctx, cx, cy, coverSize, coverSize, 20);
    text(ctx, "🎵", cx + coverSize / 2, cy + coverSize / 2 + 22, { font: "70px JT", color: PALETTE.accent, align: "center" });
  }

  text(ctx, track.title, W / 2, cy + coverSize + 52, { font: "bold 26px JT-Bold", color: PALETTE.ink, align: "center", maxWidth: W - 60 });
  text(ctx, `♫ ${track.artist}  •  ⏱ ${formatDuration(track.duration)}`, W / 2, cy + coverSize + 84, {
    font: "18px JT", color: PALETTE.ink2, align: "center", maxWidth: W - 60
  });
  text(ctx, `📡 ${sourceLabel || track.source}${track.plays ? `  •  👤 ${shortPlays(track.plays)} lượt nghe` : ""}`, W / 2, cy + coverSize + 114, {
    font: "16px JT", color: PALETTE.accent, align: "center", maxWidth: W - 60
  });
  text(ctx, "➜ Đang tải file nhạc, vui lòng chờ...", W / 2, H - 34, { font: "15px JT", color: PALETTE.ink2, align: "center" });

  return theme.save(canvas, "music_now");
}

module.exports = { renderSearchGrid, renderNowPlaying };
