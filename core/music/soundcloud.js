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
const CLIENT_ID_NEGATIVE_TTL = 5 * 60 * 1000;
const CLIENT_ID_KEY = "soundcloud_client_id";

let cachedClientId = null;
let discovering = null;
let negativeUntil = 0;

function readCachedClientId() {
  try {
    const raw = fs.readFileSync(CLIENT_ID_CACHE, "utf8").trim();
    const [clientId, timestamp] = raw.split("|");
    if (clientId && timestamp && Date.now() - Number(timestamp) < CLIENT_ID_TTL) return clientId;
  } catch { /* bo qua */ }
  return null;
}

function writeCachedClientId(clientId) {
  try {
    fs.mkdirSync(path.dirname(CLIENT_ID_CACHE), { recursive: true });
    fs.writeFileSync(CLIENT_ID_CACHE, clientId + "|" + Date.now(), "utf8");
  } catch { /* bo qua */ }
  try {
    db.saveData("BotStats", "name", CLIENT_ID_KEY, { value: clientId });
  } catch { /* bo qua */ }
}

function scriptUrlsFromHtml(html) {
  const urls = [];
  const re = /src="(https:\/\/a-v2\.sndcdn\.com[^"]+\.js)"/g;
  let match;
  while ((match = re.exec(html)) !== null) {
    urls.push(match[1]);
  }
  return [...new Set(urls)];
}

function extractClientIdFromJs(js) {
  const patterns = [
    /client_id[=:"\s]{1,4}([A-Za-z0-9]{32})/,
    /"client_id"\s*:\s*"([A-Za-z0-9]{32})"/,
    /client_id:\s*"([A-Za-z0-9]{32})"/
  ];
  for (const pattern of patterns) {
    const m = js.match(pattern);
    if (m) return m[1];
  }
  return null;
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

  try {
    const row = db.getData("BotStats", "name", CLIENT_ID_KEY);
    const stored = row?.data?.value;
    if (stored) {
      cachedClientId = stored;
      return stored;
    }
  } catch { /* bo qua */ }

  if (discovering) return discovering;
  if (Date.now() < negativeUntil) {
    const error = new Error("Dich vu SoundCloud tam thoi khong kha dung (khong lay duoc client_id), vui long thu lai sau.");
    error.notAvailable = true;
    throw error;
  }

  discovering = (async () => {
    try {
      let home;
      try {
        home = await http.request(HOME_URL, { timeout: 20000 });
      } catch (error) {
        const err = new Error("Khong ket noi duoc trang chu SoundCloud de lay client_id.");
        err.notAvailable = true;
        throw err;
      }
      const html = home && home.body ? home.body.toString("utf8") : "";
      const scriptUrls = scriptUrlsFromHtml(html).slice(0, 20);
      for (const scriptUrl of scriptUrls) {
        try {
          const script = await http.request(scriptUrl, { timeout: 20000 });
          const js = script && script.body ? script.body.toString("utf8") : "";
          const clientId = extractClientIdFromJs(js);
          if (clientId) {
            cachedClientId = clientId;
            writeCachedClientId(clientId);
            negativeUntil = 0;
            return clientId;
          }
        } catch {
          continue;
        }
      }
      negativeUntil = Date.now() + CLIENT_ID_NEGATIVE_TTL;
      const error = new Error("Khong tim thay client_id cua SoundCloud (trang web da thay doi cau truc).");
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
  const { data } = await http.getJson(API_BASE + apiPath + "?" + query.toString(), {
    headers: { Accept: "application/json" }
  });
  return data;
}

function toTrack(item) {
  return createTrack({
    id: item.id,
    title: item.title,
    artist: item.user ? item.user.username : null,
    duration: Math.round((item.duration || item.full_duration || 0) / 1000),
    thumbnail: (item.artwork_url || "").replace("-large.", "-t500x500."),
    source: SOURCE,
    sourceUrl: item.permalink_url,
    plays: item.playback_count || 0,
    likes: item.likes_count || item.favoritings_count || 0,
    previewUrl: item.media && item.media.transcodings ? (item.media.transcodings.find((t) => t.format && t.format.protocol === "hls") || {}).url || "" : ""
  });
}

function popularity(item) {
  return (item.playback_count || 0) + (item.likes_count || item.favoritings_count || 0) * 3;
}

async function search(query, limit) {
  const wanted = Math.max(Number(limit) || 20, 20);
  const data = await apiGet("/search/tracks", { q: query, limit: Math.max(wanted, 40) });
  const collection = data ? data.collection : [];
  const tracks = collection
    .filter((item) => item && item.id && !(item.policy || "").includes("BLOCK"))
    .sort((a, b) => popularity(b) - popularity(a))
    .slice(0, wanted)
    .map(toTrack);
  return tracks;
}

async function resolve(track) {
  const clientId = await discoverClientId();
  const data = await apiGet("/tracks/" + encodeURIComponent(track.id));
  const transcodings = data && data.media && data.media.transcodings ? data.media.transcodings : [];
  const progressive = transcodings.find((item) => item && item.format && item.format.protocol === "progressive");
  if (!progressive) {
    const error = new Error("Bai hat nay khong co ban tai xuong (co the la Go+ hoac bi gioi han)");
    error.notAvailable = true;
    throw error;
  }
  let stream;
  try {
    stream = await http.getJson(progressive.url + "?client_id=" + clientId);
  } catch {
    const error = new Error("Khong lay duoc link stream tu SoundCloud (mang/loi API).");
    error.notAvailable = true;
    throw error;
  }
  if (!stream || !stream.data || !stream.data.url) {
    const error = new Error("Khong lay duoc link stream tu SoundCloud");
    error.notAvailable = true;
    throw error;
  }
  return stream.data.url;
}

module.exports = { name: "scl", label: SOURCE, search, resolve };
