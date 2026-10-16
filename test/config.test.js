const assert = require("assert");
const { redact, safeView, REDACTED } = require("../core/config/index");

// ===== redact masks secret keys =====
const config = {
  prefix: "/",
  admin_bot: ["123"],
  services: {
    media_downloader_url: "https://secret.example.com",
    tiktok_api_url: "https://toksecret.example.com",
    phatnguoi_url: "https://api.checkphatnguoi.vn/phatnguoi"
  },
  media: { tiktok_cookies: "cookie_gi_mat", facebook_cookies: "cookie_fb" },
  panel: { token: "panel_secret_token" }
};

const view = JSON.parse(safeView(config));
// Các key KHÔNG chứa từ khóa secret (key/secret/token/password/cookie/imei/credential) thì KHÔNG bị mask
assert.strictEqual(view.services.media_downloader_url, "https://secret.example.com");
assert.strictEqual(view.services.tiktok_api_url, "https://toksecret.example.com");
assert.strictEqual(view.services.phatnguoi_url, "https://api.checkphatnguoi.vn/phatnguoi");
// Các key chứa từ khóa secret thì bị mask
assert.strictEqual(view.media.tiktok_cookies, REDACTED);
assert.strictEqual(view.media.facebook_cookies, REDACTED);
assert.strictEqual(view.panel.token, REDACTED);
assert.strictEqual(view.prefix, "/");
assert.strictEqual(Array.isArray(view.admin_bot), true);
// mảng string bị mask toàn bộ theo thiết kế (redactValue dòng 49)
assert.strictEqual(view.admin_bot[0], REDACTED);

// redact object directly
const redacted = redact({ api_key: "secret123", normal: "visible", nested: { secret_token: "abc" } });
assert.strictEqual(redacted.api_key, REDACTED);
assert.strictEqual(redacted.normal, "visible");
assert.strictEqual(redacted.nested.secret_token, REDACTED);

console.log("✓ config tests passed");
