const fs = require("fs");
const path = require("path");
const http = require("../http");
const { createTrack } = require("./models");

const SOURCE = "SoundCloud";
const API_BASE = "https://api-v2.soundcloud.com";
const HOME_URL = "https://soundcloud.com/";
const CLIENT_ID_CACHE = path.join(__dirname, "..", "..", "data", "soundcloud_client_id.txt");
const CLIENT_ID_TTL = 24 * 60 * 60 * 1000;

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
  try {
    fs.mkdirSync(path.dirname(CLIENT_ID_CACHE), { recursive: true });
    fs.writeFileSync(CLIENT_ID_CACHE, `${clientId}|${Date.now()}`, "utf8");
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
    sourceUrl: item.permalink_url
  });
}

async function search(query, limit) {
  const data = await apiGet("/search/tracks", { q: query, limit: Math.max(limit, 10) });
  const collection = data?.collection || [];
  return collection.slice(0, limit).map(toTrack);
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
