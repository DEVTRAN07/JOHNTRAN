const http = require("../http");
const { createTrack } = require("./models");

const SOURCE = "Spotify";
const OEMBED_URL = "https://open.spotify.com/oembed";
const TOKEN_URL = "https://accounts.spotify.com/api/token";
const API_BASE = "https://api.spotify.com/v1";

let tokenCache = { value: null, expiresAt: 0 };

function hasCredentials() {
  const { spotify_client_id: id, spotify_client_secret: secret } = global.config?.music || {};
  return Boolean(id && secret);
}

async function getToken() {
  const { spotify_client_id: id, spotify_client_secret: secret } = global.config.music;
  if (tokenCache.value && tokenCache.expiresAt > Date.now() + 30000) return tokenCache.value;

  const basic = Buffer.from(`${id}:${secret}`).toString("base64");
  const { data } = await http.request(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: "grant_type=client_credentials"
  }).then((res) => ({ data: res.json() }));

  if (!data?.access_token) {
    const error = new Error("Spotify từ chối cấp token (kiểm tra client_id/client_secret)");
    error.notAvailable = true;
    throw error;
  }
  tokenCache = { value: data.access_token, expiresAt: Date.now() + (data.expires_in || 3600) * 1000 };
  return tokenCache.value;
}

async function searchByCredentials(query, limit) {
  const token = await getToken();
  const queryString = new URLSearchParams({ q: query, type: "track", limit: String(limit), market: "VN" });
  const { data } = await http.getJson(`${API_BASE}/search?${queryString.toString()}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const items = data?.tracks?.items || [];
  return items.map((item) =>
    createTrack({
      id: item.id,
      title: item.name,
      artist: (item.artists || []).map((artist) => artist.name).join(", "),
      duration: Math.round((item.duration_ms || 0) / 1000),
      thumbnail: item.album?.images?.[0]?.url,
      source: SOURCE,
      sourceUrl: item.external_urls?.spotify,
      previewUrl: item.preview_url || ""
    })
  );
}

async function resolve(track) {
  if (track.previewUrl) return track.previewUrl;
  const error = new Error("Spotify không cung cấp link nghe trực tiếp cho bài này (chỉ có preview 30s)");
  error.notAvailable = true;
  throw error;
}

async function search(query, limit) {
  if (hasCredentials()) {
    try {
      return await searchByCredentials(query, limit);
    } catch (error) {
      if (error.privacyBlocked) throw error;
    }
  }
  const error = new Error(
    "Tìm kiếm Spotify cần client_id/client_secret của bạn (đặt trong config.yml → music). " +
    "Bạn vẫn có thể gửi link bài hát Spotify để bot lấy thông tin."
  );
  error.needCredentials = true;
  throw error;
}

async function fromUrl(url) {
  const trackMatch = String(url).match(/open\.spotify\.com\/(?:intl-[a-z-]+\/)?track\/([A-Za-z0-9]+)/)
    || String(url).match(/spotify:track:([A-Za-z0-9]+)/);
  const trackId = trackMatch?.[1];

  let track = null;
  if (trackId) {
    // lấy thông tin + preview 30s chính chủ từ trang embed của Spotify (không cần token)
    try {
      const embed = await http.request(`https://open.spotify.com/embed/track/${trackId}`, { timeout: 15000 });
      const html = embed.text();
      const previewMatch = html.match(/\\?"audioPreview\\?":\{\\?"url\\?":\\?"(https:\/\/p\.scdn\.co\/mp3-preview\/[^"\\]+)/);
      const nameMatch = html.match(/\\?"name\\?":\\?"([^"\\]+)/);
      const artistMatch = html.match(/\\?"artists\\?":\[\{\\?"name\\?":\\?"([^"\\]+)/);
      if (nameMatch) {
        track = createTrack({
          id: trackId,
          title: nameMatch[1],
          artist: artistMatch?.[1] || SOURCE,
          duration: 0,
          thumbnail: `https://i.scdn.co/image/${trackId}`,
          source: SOURCE,
          sourceUrl: url,
          previewUrl: previewMatch?.[1] || ""
        });
      }
    } catch { /* bỏ qua, dùng oembed */ }
  }

  if (!track) {
    const { data } = await http.getJson(`${OEMBED_URL}?url=${encodeURIComponent(url)}`);
    if (!data?.title) {
      const error = new Error("Link Spotify không hợp lệ");
      error.notAvailable = true;
      throw error;
    }
    const [title, artist] = String(data.title).split(" - ");
    track = createTrack({
      id: trackId || url,
      title: title || data.title,
      artist: artist || data.provider_name || SOURCE,
      duration: 0,
      thumbnail: data.thumbnail_url,
      source: SOURCE,
      sourceUrl: url
    });
  }
  return track;
}

module.exports = { name: "spt", label: SOURCE, search, resolve, fromUrl };
