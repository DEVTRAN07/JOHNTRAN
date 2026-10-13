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
  const { PALETTE, panel, button, text, label, foil, randomAccent } = theme;

  // ===== HÀNG NGANG: mỗi bài 1 dải rộng — ảnh bìa TRÁI, thông tin PHẢI =====
  const perPage = 7;
  const shown = tracks.slice(0, perPage);
  const cover = S(96);            // ảnh bìa vuông
  const rowH = cover + S(24);     // cao mỗi hàng
  const gapY = S(10);
  const headerH = S(96);
  const footerH = S(126);
  const H = headerH + shown.length * rowH + Math.max(0, shown.length - 1) * gapY + footerH;

  const { ctx, canvas } = theme.newCanvas(W, H);
  await theme.paintBackground(ctx, W, H);

  // ===== Header =====
  label(ctx, `TÌM NHẠC • ${source || "SOUNDCLOUD"}`, W / 2, S(34), { align: "center", size: 13 });
  text(ctx, theme.truncate(ctx, query, W - S(130)), W / 2, S(68), {
    size: 28, family: "JT-Display-Bold", color: PALETTE.ink, align: "center", maxWidth: W - S(130)
  });
  foil(ctx, W / 2 - S(70), S(80), S(140));
  text(
    ctx,
    `🎵 ${shown.length} bài  •  📡 ${source || "SoundCloud"}  •  🔥 nghe nhiều nhất`,
    W / 2, S(74),
    { size: 16, family: "JT-Mono", color: PALETTE.ink2, align: "center" }
  );

  // Nạp ảnh bìa
  const covers = [];
  for (const track of shown) covers.push(await fetchThumb(track.thumbnail));

  // ===== Danh sách hàng ngang =====
  shown.forEach((track, index) => {
    const x = S(25);
    const y = headerH + index * (rowH + gapY);
    const rowW = W - S(50);
    panel(ctx, x, y, rowW, rowH, S(14));

    // ảnh bìa bên TRÁI
    const coverX = x + S(12);
    const coverY = y + S(12);
    if (covers[index]) {
      ctx.save();
      theme.roundRect(ctx, coverX, coverY, cover, cover, S(10));
      ctx.clip();
      ctx.drawImage(covers[index], coverX, coverY, cover, cover);
      ctx.restore();
    } else {
      ctx.fillStyle = "rgba(56, 189, 248, .12)";
      theme.roundRect(ctx, coverX, coverY, cover, cover, S(10));
      ctx.fill();
      text(ctx, "🎵", coverX + cover / 2, coverY + cover / 2 + S(12), { size: 30, color: PALETTE.accent, align: "center" });
    }

    // số thứ tự nổi trên ảnh bìa
    ctx.fillStyle = "rgba(7, 10, 20, .85)";
    theme.roundRect(ctx, coverX + S(6), coverY + S(6), S(34), S(26), S(8));
    ctx.fill();
    text(ctx, String(index + 1), coverX + S(23), coverY + S(24), { size: 16, family: "JT-Bold", color: PALETTE.accent, align: "center" });

    // thông tin bên PHẢI
    const infoX = coverX + cover + S(16);
    const infoW = rowW - (infoX - x) - S(14);
    const centerY = y + rowH / 2;

    text(ctx, theme.truncate(ctx, track.title, infoW), infoX, y + S(28), {
      size: 21, family: "JT-Round-Bold", color: PALETTE.ink, maxWidth: infoW
    });
    text(ctx, `♫ ${theme.truncate(ctx, track.artist, infoW - S(80))} • ${formatDuration(track.duration)}`, infoX, y + S(62), {
      size: 15, family: "JT-Mono", color: PALETTE.ink2, maxWidth: infoW
    });

    // lượt nghe / like hàng ngang + nút phát nhìn như chip
    const chipY = y + S(78);
    text(ctx, `👤 ${shortPlays(track.plays)}`, infoX, chipY, { size: 14, family: "JT-Bold", color: PALETTE.green });
    text(ctx, `❤️ ${shortPlays(track.likes)}`, infoX + S(72), chipY, { size: 14, family: "JT-Bold", color: PALETTE.red });
    // nút PLAY bên phải
    const btnW = S(72), btnH = S(34);
    button(ctx, x + rowW - btnW - S(12), centerY - btnH / 2, btnW, btnH, "▶ PHÁT", PALETTE.accent);
  });

  // ===== Footer điều hướng: dòng "Trang x/y" + 3 nút =====
  const footY = H - footerH + S(4);
  const btnW = (W - S(50) - S(20)) / 3;
  const navColors = randomAccent();
  text(ctx, `Trang ${page}/${totalPages}`, W / 2, footY + S(24), { size: 20, family: "JT-Bold", color: PALETTE.ink, align: "center" });
  const btnY = footY + S(38);
  button(ctx, S(25), btnY, btnW, S(42), "◀ PREV", navColors.prev);
  button(ctx, S(25) + btnW + S(10), btnY, btnW - S(10), S(42), "✕ OUT", navColors.out);
  button(ctx, S(25) + btnW * 2 + S(20), btnY, btnW, S(42), "NEXT ▶", navColors.next);

  text(
    ctx,
    `» ${global.config.prefix}scl <số> để tải bài  •  gõ trần next / prev / out`,
    W / 2, footY + S(92),
    { size: 14, family: "JT-Mono", color: PALETTE.ink2, align: "center" }
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
