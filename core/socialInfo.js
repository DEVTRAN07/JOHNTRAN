// ===== LẤY HỒ SƠ TIKTOK / FACEBOOK (Node.js thuần) =====
// TikTok/Facebook kiểm tra TLS fingerprint + header. Node fetch với đủ header
// trình duyệt lấy được user công khai; user bị anti-bot riêng (statusCode
// 209002) thì cần cookie đăng nhập.
//
// Cookie lấy từ: đăng nhập tiktok.com → F12 → Console → document.cookie
// Set vào: config.yml → media.tiktok_cookies  HOẶC  env TIKTOK_COOKIES
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

// Header đầy đủ như trình duyệt thật — Facebook CHẶN nếu thiếu
// Sec-Fetch-*/sec-ch-ua (trả 400). TikTok cần User-Agent + Accept-Language.
const HEADERS = {
  "User-Agent": UA,
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
  "Upgrade-Insecure-Requests": "1",
  "sec-ch-ua": '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"macOS"'
};

class SocialError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

// Parse chuỗi cookie "a=b; c=d" → object
function cookieDict(raw) {
  const out = {};
  for (const part of String(raw || "").split(";")) {
    const idx = part.indexOf("=");
    if (idx > 0) out[part.slice(0, idx).trim()] = part.slice(idx + 1).trim();
  }
  return out;
}

function loadCookies() {
  return cookieDict(global.config?.media?.tiktok_cookies || process.env.TIKTOK_COOKIES || "");
}

async function fetchPage(url) {
  const cookies = loadCookies();
  const headers = { ...HEADERS };
  if (Object.keys(cookies).length) {
    headers.Cookie = Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join("; ");
  }
  return fetch(url, { headers, redirect: "follow" });
}

function parseUniversal(text) {
  const m = String(text).match(/<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/);
  return m ? JSON.parse(m[1]) : null;
}

// Parse số liệu mạng xã hội: "121.435.424" | "12,5M" | "1.2K"
// Dấu chấm có thể là phân cách HÀNG NGHÌN (vi-VN) hoặc thập phân (12.5).
function num(value) {
  if (value === undefined || value === null) return 0;
  const raw = String(value).trim().toUpperCase().replace(/\s/g, "");
  const m = raw.match(/^([\d.,]+)([KMB]?)$/);
  if (!m) return Number(raw.replace(/[^\d]/g, "")) || 0;

  let digits = m[1];
  const suffix = m[2];
  const dots = (digits.match(/\./g) || []).length;

  if (dots > 1) {
    digits = digits.replace(/\./g, "");            // 121.435.424 → 121435424
  } else if (dots === 1) {
    const [, dec] = digits.split(".");
    // 1 chấm + đúng 3 chữ số phía sau + không có hậu tố K/M/B → phân cách hàng nghìn
    if (dec && dec.length === 3 && !suffix) digits = digits.replace(".", "");
  }
  digits = digits.replace(/,/g, ".");              // 12,5 → 12.5
  const float = parseFloat(digits) || 0;
  return Math.round(float * ({ K: 1e3, M: 1e6, B: 1e9 }[suffix] || 1));
}

// ===== TIKTOK =====
async function tiktok(username) {
  const res = await fetchPage(`https://www.tiktok.com/@${username}`);
  const text = await res.text();
  if (res.status !== 200) throw new SocialError("blocked", `TikTok trả HTTP ${res.status}`);

  const data = parseUniversal(text);
  if (data) {
    const detail = (data.__DEFAULT_SCOPE__ || {})["webapp.user-detail"] || {};
    const info = detail.userInfo || {};
    const user = info.user || {};
    const stats = info.stats || {};
    // statusCode: 0 OK | 10202/10221 không tồn tại | 209002 bị chặn
    const code = detail.statusCode;
    // CHÚ Ý: {} là truthy trong JS → phải check uniqueId, không chỉ !user
    // (user rỗng {} sẽ đi qua !user và trả về object rỗng)
    if (!user || !user.uniqueId) {
      if (code === 10202 || code === 10221) throw new SocialError("not_found", `@${username} không tồn tại`);
      throw new SocialError("blocked", `TikTok đang chặn @${username} (mã ${code ?? "không rõ"})`);
    }
    return {
      source: "tiktok",
      nickname: user.nickname,
      username: user.uniqueId,
      avatar: user.avatarLarger || user.avatarMedium || user.avatarThumb,
      followers: stats.followerCount,
      hearts: stats.heartCount,
      videos: stats.videoCount,
      following: stats.followingCount,
      bio: user.signature,
      verified: Boolean(user.verified || user.custom_verify),
      private: Boolean(user.privateAccount)
    };
  }

  // Fallback: regex trên HTML
  const grab = (p) => { const m = text.match(new RegExp(p, "i")); return m ? m[1] : null; };
  const out = {
    source: "tiktok",
    username,
    nickname: grab('"nickname":"([^"]{1,50})"'),
    avatar: grab('"avatarLarger":"([^"]+)"') || grab('"avatarMedium":"([^"]+)"'),
    followers: num(grab('"followerCount":(\\d+)')),
    hearts: num(grab('"heartCount":(\\d+)')),
    videos: num(grab('"videoCount":(\\d+)')),
    following: num(grab('"followingCount":(\\d+)')),
    bio: grab('"signature":"([^"]{0,200})"'),
    verified: grab('"verified":(true)') === "true",
    private: grab('"privateAccount":(true)') === "true"
  };
  if (!(out.followers || out.hearts || out.videos)) {
    throw new SocialError("blocked", `TikTok đang chặn @${username}`);
  }
  return out;
}

// ===== FACEBOOK =====
function cleanUrl(u) {
  return u ? String(u).replace(/\\\//g, "/").replace(/&amp;/g, "&") : null;
}

async function facebook(target) {
  const res = await fetchPage(`https://www.facebook.com/${encodeURIComponent(String(target))}`);
  const text = await res.text();
  if (res.status !== 200) throw new SocialError("blocked", `Facebook trả HTTP ${res.status}`);

  const grab = (p, group = 1) => { const m = text.match(new RegExp(p, "i")); return m ? m[group] : null; };

  let name = grab("<title>([^<]{1,80})</title>");
  if (name) {
    name = name.trim().replace(/\s*[|•-]\s*Facebook.*$/i, "").trim();
    name = name.replace(/&#064;/g, "@").replace(/&amp;/g, "&");
    if (name === "Facebook") name = null;
  }

  // followers + mô tả từ og:description (FB trả tiếng Việt hoặc tiếng Anh,
  // số có dấu chấm phân cách: "121.435.424 người theo dõi")
  let followers = 0, talkingAbout = 0, about = null;
  const ogd = grab('og:description" content="([^"]+)"');
  if (ogd) {
    const og = ogd.replace(/&#xb7;/g, "|").replace(/&amp;/g, "&");
    const fm = og.match(/([\d.,]+)\s*(?:followers|ng&#x1b0;&#x1edd;i theo d&#xf5;i|người theo dõi)/i);
    if (fm) followers = num(fm[1]);
    const tm = og.match(/([\d.,]+)\s*(?:talking|ng&#x1b0;&#x1edd;i n&#xf3;i)/i);
    if (tm) talkingAbout = num(tm[1]);
    // Phần KHÔNG RỖNG cuối cùng (chuỗi hay kết thúc bằng ".")
    const tail = og.split(".").reverse().find((p) => p.trim());
    if (tail && !/(followers|theo dõi|talking|nói về)/i.test(tail)) about = tail.trim().slice(0, 120);
  }

  // giới tính: "gender":"male" (có thể UPPERCASE)
  const g = grab('"gender":"([A-Za-z]+)"');
  const gender = g ? (g.toLowerCase().startsWith("m") ? "Nam" : g.toLowerCase().startsWith("f") ? "Nữ" : g) : null;

  const birthday = grab('"birthday":"([^"]{4,24})"')
    || grab("(January|February|March|April|May|June|July|August|September|October|November|December) \\d{1,2}, \\d{4}")
    || grab("\\d{1,2} tháng \\d{1,2}, \\d{4}");

  const location = grab('"location":\\{"name":"([^"]{1,60})"}')
    || grab('"current_city":\\{"name":"([^"]{1,60})"}')
    || grab('"hometown":\\{"name":"([^"]{1,60})"}');

  const avatar = cleanUrl(grab('"profilePicLarge":"([^"]+)"')
    || grab('"profilePicMedium":"([^"]+)"')
    || grab('"profile_picture":\\{"uri":"([^"]+)"')
    || grab('og:image" content="([^"]+)"'));

  const out = {
    source: "facebook",
    username: String(target),
    name: name || grab('"name":"([^"]{1,80})"'),
    fb_id: grab('"userID":"?(\\d+)"?') || grab('"entityID":"?(\\d+)"?') || grab('"entity_id":\\s*"?(\\d+)"?'),
    avatar,
    gender,
    followers: followers || num(grab('"follower_count":(\\d+)')),
    talking_about: talkingAbout,
    about,
    birthday,
    location,
    verified: grab('"is_verified":(true)') === "true" || grab('"verified":(true)') === "true",
    link: `https://www.facebook.com/${target}`
  };

  if (!out.name || out.name === "Facebook") {
    throw new SocialError("private", "Hồ sơ riêng tư hoặc bị hạn chế");
  }
  return out;
}

module.exports = { tiktok, facebook, SocialError, num };
