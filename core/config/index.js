const fs = require("fs");
const path = require("path");
const YAML = require("yaml");

const CONFIG_PATH = path.join(__dirname, "..", "..", "config.yml");

const SECRET_KEYS = ["key", "keys", "secret", "token", "password", "cookie", "imei", "credential"];
const REDACTED = "***";

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function deepFreeze(object) {
  for (const key of Object.getOwnPropertyNames(object)) {
    const value = object[key];
    if (value && typeof value === "object") deepFreeze(value);
  }
  return Object.freeze(object);
}

function redactValue(key, value) {
  const lowerKey = String(key).toLowerCase();
  if (SECRET_KEYS.some((word) => lowerKey.includes(word))) return REDACTED;
  if (typeof value === "string") {
    return value
      .replace(/([?&](?:st|e|sig|sign|token|key|apiKey|api_key|secret|password)=)[^&]*/gi, "$1" + REDACTED)
      .replace(/(Bearer\s+)[A-Za-z0-9._-]+/gi, "$1" + REDACTED);
  }
  if (Array.isArray(value)) return value.map((item) => (typeof item === "string" ? REDACTED : item));
  if (isPlainObject(value)) return redact(value);
  return value;
}

function redact(object) {
  if (!isPlainObject(object)) return object;
  const output = {};
  for (const [key, value] of Object.entries(object)) {
    output[key] = redactValue(key, value);
  }
  return output;
}

function parseEnvValue(rawValue) {
  if (rawValue === "true") return true;
  if (rawValue === "false") return false;
  if (rawValue === "") return "";
  if (rawValue.includes(",")) return rawValue.split(",").map((item) => item.trim()).filter(Boolean);
  if (!Number.isNaN(Number(rawValue))) return Number(rawValue);
  return rawValue;
}

function setNestedValue(target, pathSegments, value) {
  let current = target;
  for (let i = 0; i < pathSegments.length - 1; i++) {
    const segment = pathSegments[i];
    if (!isPlainObject(current[segment])) current[segment] = {};
    current = current[segment];
  }
  current[pathSegments[pathSegments.length - 1]] = value;
}

function applyEnvOverrides(config) {
  // JT_MUSIC__MAX_RESULTS=5 → music.max_results
  // JT_SERVICES__MEDIA_DOWNLOADER_URL=... → services.media_downloader_url
  // JT_PREFIX=/ → prefix
  // JT_AI__GEMINI_KEYS=k1,k2 → ai.gemini_keys (mảng)
  const applied = [];
  for (const [envKey, rawValue] of Object.entries(process.env)) {
    const match = envKey.match(/^JT_([A-Z0-9_]+)$/);
    if (!match) continue;
    const pathSegments = match[1].toLowerCase().split("__");
    setNestedValue(config, pathSegments, parseEnvValue(rawValue));
    applied.push(envKey);
  }
  return applied;
}

const DEFAULTS = {
  prefix: "/",
  name_bot: "JohnTran Bot",
  account_file: "account.json",
  login_qrcode: true,
  qrcode_path: "qr.png",
  save_cookie: true,
  allow_private_command: true,
  admin_bot: [],
  support_bot: [],
  check_update: true,
  hot_reload: true,
  logging_level: "info",
  // Thiết bị đăng nhập (userAgent) — để trống thì bot tự đo theo OS
  device: {
    user_agent: ""
  },
  // TTL mặc định (ms) áp dụng cho mọi lệnh — Zalo chỉ nhận ttl >= 60000ms
  ttl: {
    message: 60000,
    error: 60000,
    media: 60000,
    card: 120000
  },
  // Web panel quản lý bot + bot con
  panel: {
    enabled: false,
    host: "0.0.0.0",
    port: 3000,
    token: ""
  },
  zalo_client_config: {},
  privacy: {
    allow_all_hosts: false,
    allowed_hosts: [
      // Nhạc (first-party)
      "zingmp3.vn",
      "zmdcdn.me",
      "graph.nhaccuatui.com",
      "nct.vn",
      "soundcloud.com",
      "sndcdn.com",
      "api-v2.soundcloud.com",
      "api.spotify.com",
      "accounts.spotify.com",
      "open.spotify.com",
      "scdn.co",
      // AI (first-party Google)
      "generativelanguage.googleapis.com",
      "translate.google.com",
      "files.catbox.moe",
      "catbox.moe",
      "tikwm.com",
      "tiktokcdn.com",
      "tiktokcdn-us.com",
      // CDN/media cần cho các tính năng có sẵn
      "imgur.com",
      "i.imgur.com",
      "postimg.cc",
      "i.postimg.cc",
      "pinimg.com",
      "i.pinimg.com",
      "drive.google.com",
      "whois.inet.vn",
      "dpaste.com",
      "graph.facebook.com",
      "facebook.com",
      "tiktokcdn.com",
      "tiktokcdn-us.com",
      "tiktokcdn-us.com.edgesuite.net",
      "fbcdn.net",
      "googleusercontent.com",
      "zalo.ai",
      "zadn.vn",
      "zdn.vn"
    ]
  },
  services: {
    media_downloader_url: "",
    ai_proxy_url: "",
    tiktok_api_url: "",
    facebook_api_url: "",
    image_generator_url: ""
  },
  ai: {
    gemini_keys: [],
    gemini_model: "gemini-2.5-flash",
    tts_enabled: false,
    max_history: 8,
    max_prompt_length: 340
  },
  music: {
    max_results: 5,
    cache_ttl: 300000,
    soundcloud_client_id: "",
    spotify_client_id: "",
    spotify_client_secret: ""
  }
};

function mergeDefaults(config) {
  for (const [key, value] of Object.entries(DEFAULTS)) {
    if (config[key] === undefined) {
      config[key] = value;
    } else if (isPlainObject(value) && isPlainObject(config[key])) {
      for (const [subKey, subValue] of Object.entries(value)) {
        if (config[key][subKey] === undefined) config[key][subKey] = subValue;
      }
    }
  }
  return config;
}

function validate(config) {
  const errors = [];
  if (typeof config.prefix !== "string" || !config.prefix) errors.push("prefix phải là chuỗi không rỗng");
  if (!Array.isArray(config.admin_bot)) errors.push("admin_bot phải là mảng");
  if (config.privacy && typeof config.privacy.allow_all_hosts !== "boolean") {
    errors.push("privacy.allow_all_hosts phải là boolean");
  }
  if (config.ai && !Array.isArray(config.ai.gemini_keys)) errors.push("ai.gemini_keys phải là mảng");
  if (config.music && (!Number.isFinite(config.music.max_results) || config.music.max_results < 1)) {
    errors.push("music.max_results phải là số >= 1");
  }
  if (config.ttl) {
    for (const [key, value] of Object.entries(config.ttl)) {
      if (!Number.isFinite(value) || value < 60000) {
        errors.push(`ttl.${key} phải là số ms >= 60000 (Zalo không xóa tin nhắn sớm hơn 60s)`);
      }
    }
  }
  if (config.panel && config.panel.enabled && !Number.isFinite(config.panel.port)) {
    errors.push("panel.port phải là số khi panel.enabled = true");
  }
  return errors;
}

function load() {
  let config = {};
  try {
    config = YAML.parse(fs.readFileSync(CONFIG_PATH, "utf8")) || {};
  } catch (error) {
    throw new Error(`Không thể đọc config.yml: ${error.message}`);
  }

  config = mergeDefaults(config);
  applyEnvOverrides(config);

  const errors = validate(config);
  if (errors.length > 0) {
    throw new Error(`Config không hợp lệ:\n- ${errors.join("\n- ")}`);
  }

  config.admin_bot = (config.admin_bot || []).map(String);
  config.support_bot = (config.support_bot || []).map(String);
  if (!Array.isArray(config.ai?.gemini_keys)) config.ai.gemini_keys = [];
  config.ai.gemini_keys = config.ai.gemini_keys.map(String).filter(Boolean);

  return deepFreeze(config);
}

function safeView(config) {
  return JSON.stringify(redact(JSON.parse(JSON.stringify(config))), null, 2);
}

module.exports = { load, redact, safeView, REDACTED };
