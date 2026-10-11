// ===== Thẻ nhạc — dùng theme chung (core/canvas/theme.js) =====
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

// ===== Lưới kết quả tìm kiếm =====
async function renderSearchGrid(query, tracks, { page = 1, totalPages = 1, source }) {
  const W = theme.WIDTH;
  const { PALETTE, panel, button, text } = theme;

  // ===== Kích thước TỰ TÍNH: chỉ vừa đủ số bài trong trang =====
  const cols = 4;
  const rows = Math.max(1, Math.ceil(tracks.length / cols));
  const cardW = 286;
  const cardH = 320;
  const gapX = 22;
  const gapY = 20;
  const padX = (W - (cols * cardW + (cols - 1) * gapX)) / 2;
  const headerH = 130;
  const footerH = 140;
  const H = headerH + rows * cardH + (rows - 1) * gapY + footerH;

  const { ctx, canvas } = theme.newCanvas(W, H);
  await theme.paintBackground(ctx, W, H);

  text(ctx, "🔎", 40, 74, { font: "40px JT", color: PALETTE.accent });
  text(ctx, `Kết quả: ${theme.truncate(ctx, query, W - 500)}`, W / 2, 74, {
    font: "bold 48px JT-Bold", color: PALETTE.ink, align: "center", maxWidth: W - 320
  });
  text(
    ctx,
    `🎵 ${tracks.length} bài • 📡 ${source || "SoundCloud"} • 🔥 xếp theo lượt nghe & lượt thích`,
    W / 2, 116,
    { font: "21px JT", color: PALETTE.ink2, align: "center" }
  );

  const shown = tracks.slice(0, cols * rows);
  for (let index = 0; index < shown.length; index++) {
    const track = shown[index];
    const col = index % cols;
    const row = Math.floor(index / cols);
    const x = padX + col * (cardW + gapX);
    const y = headerH + row * (cardH + gapY);

    panel(ctx, x, y, cardW, cardH);

    // ảnh bìa (vuông)
    const cover = await fetchThumb(track.thumbnail);
    const coverSize = cardW - 40;
    if (cover) {
      ctx.save();
      theme.roundRect(ctx, x + 20, y + 18, coverSize, coverSize, 12);
      ctx.clip();
      ctx.drawImage(cover, x + 20, y + 18, coverSize, coverSize);
      ctx.restore();
    } else {
      ctx.fillStyle = "rgba(56, 189, 248, .12)";
      theme.roundRect(ctx, x + 20, y + 18, coverSize, coverSize, 12);
      ctx.fill();
      text(ctx, "🎵", x + 20 + coverSize / 2, y + 18 + coverSize / 2 + 14, { font: "40px JT", color: PALETTE.accent, align: "center" });
    }

    // số thứ tự (nổi trên ảnh bìa)
    ctx.fillStyle = "rgba(7, 10, 20, .8)";
    theme.roundRect(ctx, x + 30, y + 28, 46, 34, 8);
    ctx.fill();
    text(ctx, String(index + 1), x + 53, y + 53, { font: "bold 22px JT-Bold", color: PALETTE.accent, align: "center" });

    // tên bài
    text(ctx, track.title, x + 20, y + 250, { font: "bold 20px JT-Bold", color: PALETTE.ink, maxWidth: cardW - 40 });
    // ca sĩ + thời lượng
    text(ctx, `${track.artist} • ${formatDuration(track.duration)}`, x + 20, y + 280, {
      font: "17px JT", color: PALETTE.mute, maxWidth: cardW - 40
    });
    // lượt nghe + like
    text(
      ctx,
      `👤 ${shortPlays(track.plays)} nghe • ❤️ ${shortPlays(track.likes)}`,
      x + 20, y + 308,
      { font: "bold 16px JT-Bold", color: PALETTE.green }
    );
  }

  // ===== Footer điều hướng =====
  const footY = H - footerH + 18;
  button(ctx, 40, footY, 300, 52, "◀  PREV", PALETTE.gold);
  text(ctx, `📄 Trang ${page} / ${totalPages}`, W / 2, footY + 34, { font: "bold 28px JT-Bold", color: PALETTE.ink, align: "center" });
  button(ctx, W - 340, footY, 300, 52, "NEXT  ▶", PALETTE.green);
  text(
    ctx,
    `⌨️ Gõ ${global.config.prefix}scl <số> tải bài • gõ trần next / prev / out để điều hướng`,
    W / 2, footY + 92,
    { font: "19px JT", color: PALETTE.ink2, align: "center" }
  );

  return theme.save(canvas, "music_grid");
}

// ===== Thẻ ĐANG PHÁT =====
async function renderNowPlaying(track, sourceLabel) {
  const { ctx, canvas } = theme.newCanvas(theme.WIDTH, 700);
  const W = theme.WIDTH;
  const { PALETTE, panel, text } = theme;

  await theme.paintBackground(ctx, W, 700);

  text(ctx, "🎶", 44, 80, { font: "42px JT", color: PALETTE.accent });
  text(ctx, "ĐANG PHÁT", W / 2, 80, { font: "bold 46px JT-Bold", color: PALETTE.ink, align: "center" });

  const cover = await fetchThumb(track.thumbnail);
  const coverSize = 420;
  const cx = 80;
  const cy = 140;
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
    text(ctx, "🎵", cx + coverSize / 2, cy + coverSize / 2 + 20, { font: "80px JT", color: PALETTE.accent, align: "center" });
  }

  const infoX = cx + coverSize + 60;
  const infoW = W - infoX - 60;
  text(ctx, track.title, infoX, cy + 70, { font: "bold 40px JT-Bold", color: PALETTE.ink, maxWidth: infoW });
  text(ctx, `♫ ${track.artist}`, infoX, cy + 130, { font: "26px JT", color: PALETTE.ink2, maxWidth: infoW });
  text(ctx, `📡 ${sourceLabel || track.source}`, infoX, cy + 190, { font: "22px JT", color: PALETTE.accent2 });
  text(ctx, `⏱ ${formatDuration(track.duration)}`, infoX, cy + 240, { font: "22px JT", color: PALETTE.mute });
  if (track.plays) text(ctx, `👤 ${shortPlays(track.plays)} lượt nghe • ❤️ ${shortPlays(track.likes)}`, infoX, cy + 290, { font: "bold 22px JT-Bold", color: PALETTE.green });

  text(ctx, "➜ Đang tải file nhạc, vui lòng chờ...", W / 2, 660, { font: "20px JT", color: PALETTE.ink2, align: "center" });

  return theme.save(canvas, "music_now");
}

module.exports = { renderSearchGrid, renderNowPlaying };
