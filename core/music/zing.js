const { ZingMp3 } = require("zingmp3-api-full");
const { createTrack } = require("./models");

const SOURCE = "Zing MP3";

function toTrack(item) {
  return createTrack({
    id: item.encodeId,
    title: item.title,
    artist: item.artistsNames,
    duration: item.duration,
    thumbnail: item.thumbnail,
    source: SOURCE,
    sourceUrl: item.link ? `https://zingmp3.vn${item.link}` : ""
  });
}

async function search(query, limit) {
  const response = await ZingMp3.search(query);
  const songs = response?.data?.songs || response?.data?.items || [];
  return songs.slice(0, limit).map(toTrack);
}

async function getLyric(trackId) {
  const response = await ZingMp3.getLyric(trackId);
  const sentences = response?.data?.sentences || [];
  return sentences
    .map((sentence) => (sentence.words || []).map((word) => word.data).join(" "))
    .filter(Boolean)
    .join("\n");
}

async function resolve(track, options = {}) {
  const wantQuality = Number(options.quality) === 320 ? "320" : "128";
  const detail = await ZingMp3.getSong(track.id);
  const streams = detail?.data || {};
  const url = wantQuality === "320" ? (streams["320"] || streams["128"]) : streams["128"];
  if (!url || url === "VIP") {
    if (wantQuality === "320" && streams["128"]) return streams["128"];
    const error = new Error("Bài hát này không có link phát hợp lệ (có thể cần VIP)");
    error.notAvailable = true;
    throw error;
  }
  return url;
}

async function getChart() {
  const response = await ZingMp3.getTop100();
  const sections = response?.data || [];
  const playlist = sections[0]?.items?.[0];
  if (!playlist?.encodeId) return [];
  const detail = await ZingMp3.getDetailPlaylist(playlist.encodeId);
  const songs = detail?.data?.song?.items || detail?.data?.items || [];
  return songs.slice(0, 20).map((item) => toTrack({ ...item, duration: item.duration || 0 }));
}

module.exports = { name: "zing", label: SOURCE, search, resolve, getLyric, getChart };
