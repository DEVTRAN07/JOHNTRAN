const music = require("../../core/music");
const lyricLib = require("../../core/music/extra");
const models = require("../../core/music/models");

const MAX_LYRIC_LINES = 32;

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
    return showLyric(reply, pending.providerName, track);
  }

  // Có từ khóa → tìm trên Zing rồi lấy lyric bài đầu tiên
  try {
    const tracks = await music.search("zing", args.join(" "), 1);
    return showLyric(reply, "zing", tracks[0]);
  } catch (error) {
    await reply.failed();
    return reply.error(error.notAvailable ? error.message : `Lỗi khi tìm bài hát: ${error.message}`);
  }
};

async function showLyric(reply, providerName, track) {
  try {
    const lines = await lyricLib.getLyric(providerName, track.id);
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
