const fs = require("fs");
const music = require("./index");
const models = require("./models");
const logger = require("../../utils/logger");
const metrics = require("../metrics");

function usage(provider, reply) {
  return reply.card({
    theme: "music",
    title: `Nhạc • ${provider.label}`,
    subtitle: "Tìm kiếm và tải nhạc nhanh",
    sections: [{ title: "Cách dùng", lines: [
      `${global.config.prefix}${provider.name} <từ khóa> — tìm bài`,
      `${global.config.prefix}${provider.name} <số> — tải bài đã tìm`,
      ...(provider.name === "spt" ? [`${global.config.prefix}spt <link spotify> — lấy thông tin bài hát`] : [])
    ]}],
    footer: models.BRAND
  });
}

function friendlyError(error, reply) {
  if (error?.privacyBlocked) {
    return reply.error("Bot bị chặn gọi API này bởi chính sách bảo mật nội bộ.");
  }
  if (error?.needCredentials || error?.noResults || error?.notAvailable) {
    return reply.error(error.message);
  }
  return reply.error(`Lỗi khi xử lý nhạc: ${error.message || error}`);
}

async function sendTrack(reply, threadId, type, track, providerName, api, options = {}) {
  const provider = music.getProvider(providerName);
  await reply.working();
  await reply.text(`Đang tải 「${track.title}」${options.quality ? ` (${options.quality}kbps)` : ""} từ ${provider.label}...`, { plain: true });

  let filePath = null;
  try {
    const streamUrl = await provider.resolve(track, { quality: options.quality });
    filePath = await music.downloadToFile(streamUrl, "mp3");
    const voiceUrl = await require("../../utils/index").processAudio(filePath, threadId, type);
    await reply.card({
      theme: "music",
      title: track.title,
      subtitle: `${track.artist} • ${models.formatDuration(track.duration)} • ${options.quality || "128"}kbps`,
      avatar: track.thumbnail,
      rows: [{ icon: "music", label: "Nguồn phát", lines: [provider.label] }],
      footer: `${models.BRAND}\nTrả lời tiếp số thứ tự để tải bài khác`
    });
    await reply.voice({ voiceUrl });
    metrics.track("musicDownload", { command: providerName });
    await reply.done();
  } catch (error) {
    logger.log(`[music:${providerName}] ${error.message}`, "error");
    await reply.failed();
    await friendlyError(error, reply);
  } finally {
    if (filePath && fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch { /* bỏ qua */ }
    }
  }
}

function parseOptions(args) {
  const options = {};
  const rest = [];
  for (const arg of args) {
    if (/^(128|320)$/.test(arg)) options.quality = Number(arg);
    else if (/^(-q|--quality)$/i.test(arg)) options.qualityFlag = true;
    else rest.push(arg);
  }
  // dạng: zing <từ khóa> -q 320
  const qIdx = args.findIndex((a) => /^(-q|--quality)$/i.test(a));
  if (qIdx !== -1 && /^(128|320)$/.test(args[qIdx + 1])) options.quality = Number(args[qIdx + 1]);
  options.queryArgs = rest;
  return options;
}

async function runMusic(providerName, { api, event, args, reply }) {
  const { threadId, type, data } = event;
  const provider = music.getProvider(providerName);
  const key = music.pickKey(threadId, data.uidFrom);
  const options = parseOptions(args);

  // Chọn bài theo số thứ tự từ kết quả tìm kiếm gần nhất
  if (/^\d{1,2}$/.test(args[0] || "")) {
    const pending = music.getPending(key);
    if (!pending || pending.providerName !== providerName) {
      return reply.error(`Bạn chưa tìm kiếm trên ${provider.label} gần đây. Hãy dùng ${global.config.prefix}${provider.name} <từ khóa> trước.`);
    }
    const index = parseInt(args[0], 10) - 1;
    const track = pending.tracks[index];
    if (!track) {
      return reply.error(`Số thứ tự không hợp lệ (1 - ${pending.tracks.length}).`);
    }
    return sendTrack(reply, threadId, type, track, providerName, api, {
      quality: options.quality || pending.quality
    });
  }

  if (!options.queryArgs.length) {
    return usage(provider, reply);
  }

  // Spotify: nhận link bài hát
  if (providerName === "spt" && typeof provider.fromUrl === "function" && /open\.spotify\.com\/(track|album)\/[A-Za-z0-9]+/.test(args[0])) {
    try {
      const track = await provider.fromUrl(args[0]);
      music.clearPending(key);
      return sendTrack(reply, threadId, type, track, providerName, api);
    } catch (error) {
      return friendlyError(error, reply);
    }
  }

  const query = options.queryArgs.join(" ");
  let tracks;
  try {
    tracks = await music.search(providerName, query);
  } catch (error) {
    return friendlyError(error, reply);
  }

  music.setPending(key, providerName, tracks);
  metrics.track("musicSearch", { command: providerName });
  if (options.quality) {
    const entry = music.getPending(key);
    if (entry) entry.quality = options.quality;
  }
  return reply.card({
    theme: "music",
    title: query,
    subtitle: `Nguồn: ${provider.label} • ${tracks.length} kết quả${options.quality ? ` • ${options.quality}kbps` : ""}`,
    rows: [{
      icon: "list",
      label: "Danh sách bài hát",
      lines: tracks.map((track, index) => `${String(index + 1).padStart(2, " ")}. ${track.title} — ${track.artist} (${models.formatDuration(track.duration)})`)
    }],
    footer: `${models.BRAND}\nTrả lời số thứ tự để tải • thêm "320" hoặc "-q 320" để lấy chất lượng cao`
  });
}

function createMusicCommand(providerName, meta = {}) {
  return {
    config: {
      name: providerName,
      version: "2.0.0",
      role: 0,
      author: models.BRAND,
      description: `Tìm và tải nhạc từ ${providerName === "scl" ? "SoundCloud" : providerName === "spt" ? "Spotify" : providerName === "zing" ? "Zing MP3" : "NhacCuaTui"}`,
      category: "Nhạc",
      usage: `${providerName} <từ khóa | số thứ tự>`,
      cooldowns: 5,
      dependencies: meta.dependencies || {}
    },
    run: (context) => runMusic(providerName, context)
  };
}

module.exports = { createMusicCommand, runMusic };
