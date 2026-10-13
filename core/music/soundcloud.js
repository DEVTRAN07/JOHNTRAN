const fs = require("fs");
const path = require("path");
const http = require("../http");
const { createTrack } = require("./models");
const db = require("../../utils/db");

const SOURCE = "SoundCloud";
const API_BASE = "https://api-v2.soundcloud.com";
const HOME_URL = "https://soundcloud.com/";
const CLIENT_ID_CACHE = path.join(__dirname, "..", "..", "data", "soundcloud_client_id.txt");
const CLIENT_ID_TTL = 24 * 60 * 60 * 1000;
const CLIENT_ID_KEY = "soundcloud_client_id"; // khoá bền vững trên Supabase

let cachedClientId = null;
let discovering = null;

function readCachedClientId() {
  try {
    const raw = fs.readFileSync(CLIENT_ID_CACHE, "utf8").trim();
    const [clientId, timestamp] = raw.split("|");
    if (clientId && timestamp && Date.now() - Number(timestamp) < CLIENT_ID_TTL) return clientId;
  } catch { /* bỏ qua */ }
  return null;
}

function writeCachedClientId(clientId) {
  // Ghi cả 2 nơi: file local (nhanh) + Supabase (sống sót qua mọi lần
  // restart/deploy trên Render — data/ trong container là tạm).
  try {
    fs.mkdirSync(path.dirname(CLIENT_ID_CACHE), { recursive: true });
    fs.writeFileSync(CLIENT_ID_CACHE, `${clientId}|${Date.now()}`, "utf8");
  } catch { /* bỏ qua */ }
  try {
    db.saveData("Config", "key", CLIENT_ID_KEY, { value: clientId });
  } catch { /* bỏ qua */ }
}

async function discoverClientId() {
  const configured = global.config?.music?.soundcloud_client_id;
  if (configured) return configured;
  if (cachedClientId) return cachedClientId;

  const cached = readCachedClientId();
  if (cached) {
    cachedClientId = cached;
    return cached;
  }

  // Supabase: chỉ cần discovery 1 lần DUY NHẤT, mọi lần khởi động sau đều
  // đọc từ DB (Render reset file data/ mỗi deploy → trước đây mất ~1.5s mỗi lần)
  try {
    const row = db.getData("Config", "key", CLIENT_ID_KEY);
    const stored = row?.data?.value;
    if (stored) {
      cachedClientId = stored;
      return stored;
    }
  } catch { /* bỏ qua */ }

  if (discovering) return discovering;
  discovering = (async () => {
    try {
      const home = await http.request(HOME_URL, { timeout: 20000 });
      const scriptUrls = [...home.body.toString("utf8").matchAll(/src="(https:\/\/a-v2\.sndcdn\.com[^"]+\.js)"/g)].map((m) => m[1]);
      for (const scriptUrl of scriptUrls.slice(0, 12)) {
        const script = await http.request(scriptUrl, { timeout: 20000 });
        const match = script.body.toString("utf8").match(/client_id[=:"'\s]{1,4}([A-Za-z0-9]{32})/);
        if (match) {
          cachedClientId = match[1];
          writeCachedClientId(match[1]);
          return match[1];
        }
      }
      const error = new Error("Không tìm thấy client_id của SoundCloud");
      error.notAvailable = true;
      throw error;
    } finally {
      discovering = null;
    }
  })();
  return discovering;
}

async function apiGet(apiPath, params = {}) {
  const clientId = await discoverClientId();
  const query = new URLSearchParams({ ...params, client_id: clientId });
  const { data } = await http.getJson(`${API_BASE}${apiPath}?${query.toString()}`, {
    headers: { Accept: "application/json" }
  });
  return data;
}

function toTrack(item) {
  return createTrack({
    id: item.id,
    title: item.title,
    artist: item.user?.username,
    duration: Math.round((item.duration || item.full_duration || 0) / 1000),
    thumbnail: (item.artwork_url || "").replace("-large.", "-t500x500."),
    source: SOURCE,
    sourceUrl: item.permalink_url,
    plays: item.playback_count || 0,
    likes: item.likes_count || item.favoritings_count || 0,
    // preview 30s: bài Go+/chặn vẫn nghe được đoạn đầu
    previewUrl: item.media?.transcodings?.find((t) => t.format?.protocol === "hls")?.url || ""
  });
}

// Điểm phổ biến: lượt nghe + like (like nặng hơn vì chứng tỏ bài hay)
function popularity(item) {
  return (item.playback_count || 0) + (item.likes_count || item.favoritings_count || 0) * 3;
}

// Tìm nhạc: lấy NHIỀU rồi xếp bài nhiều người nghe/thích nhất lên đầu
// (SoundCloud không sort được phía server nên sort phía bot).
async function search(query, limit) {
  const wanted = Math.max(Number(limit) || 20, 20);
  const data = await apiGet("/search/tracks", { q: query, limit: Math.max(wanted, 40) });
  const collection = data?.collection || [];
  const tracks = collection
    .filter((item) => item && item.id && !(item.policy || "").includes("BLOCK"))
    .sort((a, b) => popularity(b) - popularity(a))
    .slice(0, wanted)
    .map(toTrack);
  return tracks;
}

async function resolve(track) {
  const data = await apiGet(`/tracks/${encodeURIComponent(track.id)}`);
  const transcodings = data?.media?.transcodings || [];
  const progressive = transcodings.find((item) => item.format?.protocol === "progressive");
  if (!progressive) {
    const error = new Error("Bài hát này không có bản tải xuống (có thể là Go+ hoặc bị giới hạn)");
    error.notAvailable = true;
    throw error;
  }
  const clientId = await discoverClientId();
  const stream = await http.getJson(`${progressive.url}?client_id=${clientId}`);
  if (!stream?.data?.url) {
    const error = new Error("Không lấy được link stream từ SoundCloud");
    error.notAvailable = true;
    throw error;
  }
  return stream.data.url;
}

module.exports = { name: "scl", label: SOURCE, search, resolve };
