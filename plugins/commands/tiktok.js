// /tiktok — Thông tin + tải media TikTok
// Tham khảo Kenne400k/filebotha-leak (modules/commands/tiktok.js): các chế độ
// video / music / info. Nhưng API apivip.nguyenlienmanh.com của repo đã chết
// nên phần info lấy qua curl_cffi (trang công khai) và video/music thử tikwm.
//
//   /tiktok <username>                    thẻ thông tin user
//   /tiktok info <username>               (giống trên)
//   /tiktok video <link>                  tải video
//   /tiktok music <link>                  tải nhạc
const fs = require("fs");
const os = require("os");
const path = require("path");
const http = require("../../core/http");
const card = require("../../core/canvas/profileCard");
const { fetchSocial } = require("../../core/socialFetch");

module.exports.config = {
  name: "tiktok",
  aliases: ["tt", "tik"],
  version: "2.0.0",
  role: 0,
  author: "ᴶᴼᴴᴺ ᵀᴿᴬᴺ",
  description: "Thông tin và tải media TikTok",
  category: "Tiện ích",
  usage: "tiktok <username> | tiktok video <link> | tiktok music <link>",
  cooldowns: 10,
  dependencies: {}
};

function shortNum(n) {
  const v = Number(n) || 0;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
  return String(v);
}

// Chấp nhận: user | @user | link profile | link video
function parseTarget(raw) {
  return String(raw || "").trim()
    .replace(/^@/, "")
    .replace(/^https?:\/\/(www\.|m\.)?tiktok\.com\/@?/, "")
    .replace(/^https?:\/\/vt\.tiktok\.com\/\w+\/?/, "")
    .replace(/\/+$/, "")
    .replace(/\/.*$/, "")
    .trim();
}

module.exports.run = async function ({ api, event, args, reply }) {
  const { threadId, type } = event;
  const sub = (args[0] || "").toLowerCase();
  const raw = args[1] || (sub === "info" ? "" : args[0]);

  // ===== VIDEO =====
  if (sub === "video" || sub === "v" || sub === "vd") {
    const link = raw;
    if (!link || !/^https?:\/\//i.test(link)) {
      return reply.error(`Cách dùng: ${global.config.prefix}tiktok video <link tiktok>`);
    }
    return downloadTikTok(api, threadId, type, link, "mp4", "🎬 TIKTOK VIDEO");
  }

  // ===== MUSIC =====
  if (sub === "music" || sub === "m" || sub === "audio" || sub === "a") {
    const link = raw;
    if (!link || !/^https?:\/\//i.test(link)) {
      return reply.error(`Cách dùng: ${global.config.prefix}tiktok music <link tiktok>`);
    }
    return downloadTikTok(api, threadId, type, link, "mp3", "🎵 TIKTOK MUSIC");
  }

  // ===== INFO (mặc định) =====
  const username = sub === "info" || sub === "i" ? args[1] : args[0];
  if (!username) {
    return reply.error(
      `Cách dùng:\n` +
      `${global.config.prefix}tiktok <username> — thẻ thông tin\n` +
      `${global.config.prefix}tiktok video <link> — tải video\n` +
      `${global.config.prefix}tiktok music <link> — tải nhạc`
    );
  }

  const target = parseTarget(username);
  if (!target || target.length < 2) return reply.error(`Không đọc được username từ: ${username}`);

  await api.sendMessage({ msg: "⏳ Đang lấy thông tin TikTok...", plain: true }, threadId, type);

  const { data: info, error, code } = await fetchSocial("tiktok", target);
  if (!info) return reply.error(error || `Không lấy được hồ sơ @${target}`);

  // ---- avatar ----
  let avatarBuffer = null;
  if (info.avatar) {
    try {
      const { buffer } = await http.getBuffer(info.avatar, { timeout: 20000 });
      avatarBuffer = buffer;
    } catch { /* thiếu ảnh vẫn tạo thẻ */ }
  }

  let cardPath = null;
  try {
    const alias = info._matched_alias;
    if (alias) {
      // TikTok trả 209002 cho tên gốc → dùng biến thể bỏ dấu chấm/gạch dưới
      await api.sendMessage({
        msg: `ℹ️ Không tìm thấy @${target} — đang hiển thị kết quả gần đúng nhất: @${alias}`,
        plain: true,
        ttl: 60000
      }, threadId, type);
    }
    cardPath = await card.render({
      name: String(info.nickname || info.username || target),
      avatarBuffer,
      rows: [
        ["» Followers", shortNum(info.followers)],
        ["» Lượt thích", shortNum(info.hearts)],
        ["» Số video", shortNum(info.videos)],
        ["» Đang follow", shortNum(info.following)],
        ["» Xác minh", info.verified ? "Có" : "Không"],
        ["» Username", `@${info.username || alias || target}`]
      ],
      link: info.bio ? String(info.bio).slice(0, 46) : `@${info.username || alias || target}`
    });
    await api.sendMessage({ msg: "", attachments: [cardPath], ttlKind: "card" }, threadId, type);
  } catch (error) {
    console.error("tiktok:", error.message);
    return reply.error(`Tạo thẻ thất bại: ${error.message}`);
  }
};

// Tải video/nhạc TikTok qua API công khai (tikwm)
async function downloadTikTok(api, threadId, type, link, ext, label) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "jt_tt_"));
  const filePath = path.join(tmpDir, `tt_${Date.now()}.${ext}`);
  try {
    await api.sendMessage({ msg: "⏳ Đang tải...", plain: true }, threadId, type);
    // TikTok API công khai hay bị chặn — nếu không lấy được thì báo rõ
    const axios = require("axios");
    const r = await axios.get("https://www.tikwm.com/api/", {
      params: { url: link, hd: 1 },
      timeout: 60000,
      headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" }
    });
    const data = r.data?.data;
    const mediaUrl = ext === "mp3" ? (data?.music || data?.music_info?.play) : (data?.play || data?.hdplay);
    if (!mediaUrl) {
      return api.sendMessage({
        plain: true,
        msg: `${label}\n❌ Không lấy được link media (API TikTok đang chặn).\n💡 Thử lại sau hoặc dùng link khác.`
      }, threadId, type);
    }
    const { buffer } = await getBuffer(mediaUrl, { timeout: 120000 });
    fs.writeFileSync(filePath, buffer);
    await api.sendMessage({ msg: `${label} — ${(buffer.length / 1048576).toFixed(1)}MB`, attachments: [filePath], ttlKind: "media" }, threadId, type);
  } catch (error) {
    console.error("tiktok download:", error.message);
    return api.sendMessage({ plain: true, msg: `${label}\n❌ Tải thất bại: ${error.message}` }, threadId, type);
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* bỏ qua */ }
  }
}
