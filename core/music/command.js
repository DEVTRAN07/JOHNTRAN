const fs = require("fs");
const music = require("./index");
const models = require("./models");
const cards = require("../canvas/music");
const logger = require("../../utils/logger");
const recall = require("../recall");

let nextPageCursor = null; // "zing|2"

function send(api, threadId, type, msg, ttl = 300000) {
  return api.sendMessage({ msg, ttl }, threadId, type);
}

function usage(provider, reply) {
  return reply.card({
    theme: "music",
    title: `Nhạc • ${provider.label}`,
    subtitle: "Bài nhiều người nghe nhất lên đầu",
    rows: [{
      icon: "list",
      label: "Cách dùng",
      lines: [
        `${global.config.prefix}${provider.name} <từ khóa> — tìm bài`,
        `${global.config.prefix}${provider.name} <số> — tải bài đã tìm`,
        `${global.config.prefix}${provider.name} next | prev — chuyển trang`,
        `${global.config.prefix}${provider.name} out — đóng danh sách`
      ]
    }],
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

async function sendTrack(reply, threadId, type, track, providerName, api) {
  const provider = music.getProvider(providerName);
  await reply.working();

  let filePath = null;
  let cardPath = null;
  try {
    const streamUrl = await provider.resolve(track);
    filePath = await music.downloadToFile(streamUrl, "mp3");
    const voiceUrl = await require("../../utils/index").processAudio(filePath, threadId, type);

    // Thẻ NOW PLAYING
    try {
      cardPath = await cards.renderNowPlaying(track, provider.label.toUpperCase());
      await api.sendMessage({ msg: "", attachments: cardPath, ttlKind: "music" }, threadId, type);
    } catch { /* hỏng thẻ thì thôi */ }

    await api.sendVoice({ voiceUrl, ttlKind: "media" }, threadId, type);
    await reply.done();
  } catch (error) {
    logger.log(`[music:${providerName}] ${error.message}`, "error");
    await reply.failed();
    await friendlyError(error, reply);
  } finally {
    if (filePath && fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch { /* bỏ qua */ }
    }
    if (cardPath && fs.existsSync(cardPath)) {
      try { fs.unlinkSync(cardPath); } catch { /* bỏ qua */ }
    }
  }
}

function gridKey(key) {
  return `music_grid:${key}`;
}

async function showResults(api, threadId, type, provider, query, tracks, page, replaceKey = "music_grid") {
  const perPage = 8;
  const totalPages = Math.max(1, Math.ceil(tracks.length / perPage));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const slice = tracks.slice((safePage - 1) * perPage, safePage * perPage);

  let gridPath = null;
  try {
    gridPath = await cards.renderSearchGrid(query, slice, { page: safePage, totalPages, source: provider.label.toUpperCase() });
    await api.sendMessage({ msg: "", attachments: gridPath, ttlKind: "music", replace: replaceKey }, threadId, type);
    if (fs.existsSync(gridPath)) fs.unlinkSync(gridPath);
  } catch {
    // Fallback: thẻ text nếu canvas lỗi
    await send(api, threadId, type, `🎵 ${provider.label} — "${query}"\n` +
      slice.map((t, i) => `${i + 1}. ${t.title} — ${t.artist} (${models.formatDuration(t.duration)})`).join("\n"));
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

  // Chọn bài theo số thứ tự
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
    // Chọn được bài → xoá ngay lưới kết quả (đừng để nằm chiếm nhóm)
    await recall.recall(api, threadId, gridKey(key), type);
    return sendTrack(reply, threadId, type, track, providerName, api, options.quality);
  }

  // Điều hướng kết quả: next / prev / out
  const nav = (args[0] || "").toLowerCase();
  if (["next", "prev", "previous", "back", "out", "exit", "close"].includes(nav)) {
    const pending = music.getPending(key);
    if (!pending || pending.providerName !== providerName) {
      return reply.error(`Bạn chưa tìm nhạc trên ${provider.label}. Gõ ${global.config.prefix}${provider.name} <từ khóa> trước.`);
    }

    // Thoát: xoá danh sách đang chọn
    if (["out", "exit", "close"].includes(nav)) {
      music.clearPending(key);
      await recall.recall(api, threadId, gridKey(key), type);
      return reply.success(`Đã đóng danh sách nhạc "${pending.query || ""}". Gõ ${global.config.prefix}${provider.name} <từ khóa> để tìm lại.`);
    }

    const perPage = 8;
    const totalPages = Math.max(1, Math.ceil(pending.tracks.length / perPage));
    const current = pending.page || 1;
    const page = nav === "next"
      ? (current >= totalPages ? 1 : current + 1)
      : (current <= 1 ? totalPages : current - 1);

    music.setPending(key, providerName, pending.tracks, pending.query, page);
    return showResults(api, threadId, type, provider, pending.query, pending.tracks, page, gridKey(key));
  }

  if (!options.queryArgs.length) {
    return usage(provider, reply);
  }

  const query = options.queryArgs.join(" ");
  let tracks;
  try {
    tracks = await music.search(providerName, query);
  } catch (error) {
    return friendlyError(error, reply);
  }

  music.setPending(key, providerName, tracks, query, 1);
  if (options.quality) {
    const entry = music.getPending(key);
    if (entry) entry.quality = options.quality;
  }
  return showResults(api, threadId, type, provider, query, tracks, 1, gridKey(key));
}

function createMusicCommand(providerName, meta = {}) {
  let label = providerName;
  try { label = music.getProvider(providerName).label; } catch { /* provider chưa đăng ký */ }
  return {
    config: {
      name: providerName,
      version: "3.0.0",
      role: 0,
      author: models.BRAND,
      description: `Tìm và tải nhạc từ ${label}`,
      category: "Nhạc",
      usage: `${providerName} <từ khóa | số thứ tự | next>`,
      cooldowns: 5,
      dependencies: meta.dependencies || {}
    },
    run: (context) => runMusic(providerName, context)
  };
}

// Chọn bài bằng số trần (không cần prefix + tên lệnh)
async function select(providerName, number, context) {
  return runMusic(providerName, { ...context, args: [String(number)] });
}

module.exports = { createMusicCommand, runMusic, select };
