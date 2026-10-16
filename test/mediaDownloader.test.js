const assert = require("assert");
const {
  isTikTokUrl,
  isYouTubeUrl,
  isFacebookUrl,
  isInstagramUrl,
  isTwitterUrl,
  extractMetaMedia,
  findVideoUrls,
  parseDurationFromMeta,
  isAudioOnly,
  describe
} = require("../core/mediaDownloader");

// ===== URL detectors =====
assert.strictEqual(isTikTokUrl("https://www.tiktok.com/@user/video/123"), true);
assert.strictEqual(isTikTokUrl("https://vt.tiktok.com/abc"), true);
assert.strictEqual(isTikTokUrl("https://www.youtube.com/watch?v=123"), false);
assert.strictEqual(isTikTokUrl("not a url"), false);

assert.strictEqual(isYouTubeUrl("https://www.youtube.com/watch?v=dQw4w"), true);
assert.strictEqual(isYouTubeUrl("https://youtu.be/dQw4w"), true);
assert.strictEqual(isYouTubeUrl("https://youtube.com/shorts/abc"), true);
assert.strictEqual(isYouTubeUrl("https://www.tiktok.com/@user/video/123"), false);

assert.strictEqual(isFacebookUrl("https://www.facebook.com/reel/123"), true);
assert.strictEqual(isFacebookUrl("https://fb.watch/123"), true);
assert.strictEqual(isFacebookUrl("https://www.instagram.com/reel/abc"), false);

assert.strictEqual(isInstagramUrl("https://www.instagram.com/reel/abc"), true);
assert.strictEqual(isInstagramUrl("https://instagr.am/p/xyz"), true);
assert.strictEqual(isInstagramUrl("https://www.facebook.com/reel/123"), false);

assert.strictEqual(isTwitterUrl("https://twitter.com/user/status/123"), true);
assert.strictEqual(isTwitterUrl("https://x.com/user/status/123"), true);
assert.strictEqual(isTwitterUrl("https://www.instagram.com/reel/abc"), false);

// ===== extractMetaMedia =====
const html1 = `<html><head>
<meta property="og:title" content="Título video">
<meta property="og:video:secure_url" content="https://cdn.example.com/v.mp4">
<meta property="og:image" content="https://cdn.example.com/thumb.jpg">
<meta property="og:site_name" content="ExampleSite">
</head></html>`;
const m1 = extractMetaMedia(html1);
assert.strictEqual(m1.title, "Título video");
assert.strictEqual(m1.video, "https://cdn.example.com/v.mp4");
assert.strictEqual(m1.image, "https://cdn.example.com/thumb.jpg");
assert.strictEqual(m1.author, "ExampleSite");

const html2 = `<html><head><title>Plain Title</title></head></html>`;
const m2 = extractMetaMedia(html2);
assert.strictEqual(m2.title, "Plain Title");
assert.strictEqual(m2.video, "");
assert.strictEqual(m2.image, "");

// ===== findVideoUrls =====
const urls = findVideoUrls('https://cdn.example.com/video.mp4?token=abc and https://cdn.example.com/stream.m3u8');
assert.ok(urls.includes("https://cdn.example.com/video.mp4?token=abc"));
assert.ok(urls.includes("https://cdn.example.com/stream.m3u8"));
assert.strictEqual(findVideoUrls("không có url video nào").length, 0);

// JSON playable_url
const jsonHtml = `<script>window.__INITIAL_STATE__ = {"video":{"playable_url":"https://fb.com/x.mp4"}};</script>`;
assert.ok(findVideoUrls(jsonHtml).includes("https://fb.com/x.mp4"));

// ===== parseDurationFromMeta =====
assert.strictEqual(parseDurationFromMeta('duration="245"'), 245);
assert.strictEqual(parseDurationFromMeta('duration: 120'), 120);
assert.strictEqual(parseDurationFromMeta("không có duration"), 0);

// ===== isAudioOnly =====
assert.strictEqual(isAudioOnly(null), true);
assert.strictEqual(isAudioOnly({}), true);
assert.strictEqual(isAudioOnly({ image: "x.jpg" }), true);
assert.strictEqual(isAudioOnly({ videoUrl: "https://x.mp4" }), false);
assert.strictEqual(isAudioOnly({ videoUrl: "", image: "x.jpg" }), true);

// ===== describe =====
const desc = describe({ title: "TikTok video", author: "user123", duration: 125, platform: "tiktok", source: "tiktok_api" });
assert.ok(desc.some((d) => d.includes("Title: TikTok video")));
assert.ok(desc.some((d) => d.includes("Author: user123")));
assert.ok(desc.some((d) => d.includes("Thời lượng: 2:05")));
assert.ok(desc.some((d) => d.includes("Nguồn: tiktok")));
assert.ok(desc.some((d) => d.includes("Cách lấy: tiktok_api")));

console.log("✓ mediaDownloader tests passed");
