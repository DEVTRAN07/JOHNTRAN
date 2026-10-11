// Lấy thông tin người dùng từ TikTok / Facebook (chỉ dùng dữ liệu công khai)
const axios = require("axios");

const TIMEOUT = 20000;

function detectPlatform(input) {
  const value = String(input || "").toLowerCase();
  if (/(?:^|\.)(?:tiktok\.com|douyin\.com)/.test(value) || /^@?[a-z0-9._]{2,24}$/.test(value) && value.startsWith("@")) return "tiktok";
  if (/(?:^|\.)(?:facebook\.com|fb\.com|fb\.watch)/.test(value)) return "facebook";
  return null;
}

async function fetchTikTok(input) {
  const username = String(input).replace(/^https?:\/\/(www\.)?tiktok\.com\//i, "").replace(/^@/, "").split(/[/?]/)[0];
  if (!username) throw new Error("Username TikTok không hợp lệ");

  const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(`https://www.tiktok.com/@${username}`)}`;
  const { data } = await axios.get(oembedUrl, { timeout: TIMEOUT, headers: { "User-Agent": "Mozilla/5.0" } });
  if (!data?.author_name) throw new Error("Không tìm thấy người dùng TikTok này");

  // Thử lấy số liệu công khai từ trang profile
  let followers = "";
  let likes = "";
  let avatar = "";
  try {
    const profileUrl = `https://www.tiktok.com/@${username}`;
    const page = await axios.get(profileUrl, { timeout: TIMEOUT, headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" } });
    const html = page.data;
    const statsMatch = html.match(/"followerCount":(\d+)/);
    const likesMatch = html.match(/"heartCount":(\d+)/);
    const avatarMatch = html.match(/\\?"avatarLarger\\?":\\?"([^"\\]+)"/) || html.match(/"avatarLarger":"([^"]+)"/);
    if (statsMatch) followers = statsMatch[1];
    if (likesMatch) likes = likesMatch[1];
    if (avatarMatch) avatar = avatarMatch[1].replace(/\\u002F/g, "/");
  } catch { /* bỏ qua số liệu */ }

  return {
    platform: "TikTok",
    username: `@${username}`,
    displayName: data.author_name,
    avatar,
    followers,
    likes,
    profileUrl: `https://www.tiktok.com/@${username}`
  };
}

async function fetchFacebook(input) {
  const url = String(input).match(/^https?:\/\//i) ? input : `https://www.facebook.com/${input}`;
  const oembedUrl = `https://www.facebook.com/plugins/page/oembed.json/?href=${encodeURIComponent(url)}`;
  try {
    const { data } = await axios.get(oembedUrl, { timeout: TIMEOUT, headers: { "User-Agent": "Mozilla/5.0" } });
    if (data?.author_name || data?.title) {
      return {
        platform: "Facebook",
        username: data.author_url || url,
        displayName: data.author_name || data.title,
        avatar: "",
        followers: "",
        likes: "",
        profileUrl: data.author_url || url
      };
    }
  } catch { /* thử phương án khác */ }

  const pageMatch = String(input).match(/facebook\.com\/(?:profile\.php\?id=)?([A-Za-z0-9.]+)/i);
  const name = pageMatch ? pageMatch[1] : String(input).replace(/.*facebook\.com\//i, "");
  return {
    platform: "Facebook",
    username: name,
    displayName: name,
    avatar: "",
    followers: "",
    likes: "",
    profileUrl: url
  };
}

async function lookup(input) {
  const platform = detectPlatform(input);
  if (platform === "tiktok") return fetchTikTok(input);
  if (platform === "facebook") return fetchFacebook(input);
  const error = new Error("Hỗ trợ: link/username TikTok hoặc link Facebook (vd: /carduser https://www.tiktok.com/@abc)");
  error.notSupported = true;
  throw error;
}

module.exports = { lookup, detectPlatform };
