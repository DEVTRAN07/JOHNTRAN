const music = require("../../core/music");
const models = require("../../core/music/models");
const http = require("../../core/http");

const MAX_LYRIC_LINES = 32;
const LRCLIB_API = "https://lrclib.net/api/search";

module.exports.config = {
  name: "lyric",
  aliases: ["loibaihat", "lrc"],
  version: "2.0.0",
  role: 0,
  author: models.BRAND,
  description: "Xem lời bài hát",
  category: "Nhạc",
  usage: "lyric [từ khóa] (không nhập = lấy bài bạn tìm gần nhất)",
  cooldowns: 5,
  dependencies: {}
};

module.exports.run = async ({ args, event, reply }) => {
  const { threadId, data } = event;
  const key = music.pickKey(threadId, data.uidFrom);

  await reply.working();

  // Không nhập gì → lấy bài gần nhất trong danh sách tìm kiếm
  if (!args[0]) {
    const pending = music.getPending(key);
    if (!pending) {
      await reply.failed();
      return reply.error("Bạn chưa tìm bài nào gần đây. Dùng: /lyric <từ khóa>");
    }
    const track = pending.tracks[0];
    return showLyric(reply, track);
  }

  try {
    const tracks = await music.search("scl", args.join(" "), 1);
    return showLyric(reply, tracks[0]);
  } catch (error) {
    await reply.failed();
    return reply.error(error.notAvailable ? error.message : `Lỗi khi tìm bài hát: ${error.message}`);
  }
};

async function findLyrics(track) {
  const title = String(track?.title || "").trim();
  const artist = String(track?.artist || "").trim();
  if (!title) throw new Error("Không xác định được tên bài hát để tìm lời.");

  const params = new URLSearchParams({ track_name: title });
  if (artist) params.set("artist_name", artist);
  const { status, data } = await http.getJson(`${LRCLIB_API}?${params}`, {
    timeout: 15000,
    retries: 1,
    headers: { "User-Agent": "JOHNTRAN/1.1.0 (lyrics lookup)" }
  });
  if (status >= 400) throw new Error(`LRCLIB trả về HTTP ${status}`);

  const match = Array.isArray(data) && data.find((item) => item?.plainLyrics || item?.syncedLyrics);
  const lyrics = match?.plainLyrics || match?.syncedLyrics;
  if (!lyrics) throw new Error(`Không tìm thấy lời bài hát "${title}" trên LRCLIB.`);
  return lyrics
    .split(/\r?\n/)
    .map((line) => line.replace(/^\[\d{2}:\d{2}(?:\.\d{2,3})?\]\s*/, "").trim())
    .filter(Boolean);
}

async function showLyric(reply, track) {
  try {
    const lines = await findLyrics(track);
    const shown = lines.slice(0, MAX_LYRIC_LINES);
    await reply.card({
      theme: "ai",
      title: track.title,
      subtitle: track.artist,
      avatar: track.thumbnail,
      rows: [{ icon: "list", label: "Lời bài hát", lines: shown }],
      footer: lines.length > shown.length
        ? `${models.BRAND}\n...và ${lines.length - shown.length} dòng nữa`
        : models.BRAND
    });
    await reply.done();
  } catch (error) {
    await reply.failed();
    return reply.error(error.message);
  }
}

module.exports._test = { findLyrics };
