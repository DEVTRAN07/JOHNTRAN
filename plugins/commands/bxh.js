const music = require("../../core/music");
const chartLib = require("../../core/music/extra");
const models = require("../../core/music/models");

module.exports.config = {
  name: "bxh",
  aliases: ["chart", "top", "zingchart"],
  version: "2.0.0",
  role: 0,
  author: models.BRAND,
  description: "Bảng xếp hạng bài hát Zing MP3 (trả lời số để tải)",
  category: "Nhạc",
  usage: "bxh",
  cooldowns: 5,
  dependencies: {}
};

module.exports.run = async ({ event, reply }) => {
  const { threadId, type, data } = event;
  const key = music.pickKey(threadId, data.uidFrom);

  await reply.working();

  try {
    const tracks = await chartLib.getChart("zing");
    music.setPending(key, "zing", tracks);

    await reply.card({
      theme: "music",
      title: "Bảng xếp hạng",
      subtitle: "Top bài hát đang hot nhất • Nguồn: Zing MP3",
      rows: [{
        icon: "chart",
        label: "Top 20",
        lines: tracks.map((track, index) => `${String(index + 1).padStart(2, " ")}. ${track.title} — ${track.artist} (${models.formatDuration(track.duration)})`)
      }],
      footer: `${models.BRAND}\nTrả lời số thứ tự để tải bài hát`
    });
    await reply.done();
  } catch (error) {
    await reply.failed();
    return reply.error(error.message);
  }
};
