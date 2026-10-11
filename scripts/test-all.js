/**
 * Test chi tiết từng chức năng của bot.
 * Kiểm tra: import, config hợp lệ, API trả về, TTL, privacy...
 * Chạy: node scripts/test-all.js
 */
process.env.JT_DB_FILE = process.env.JT_DB_FILE || require("path").join(require("os").tmpdir(), "jt_testall_store.json");

const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");

if (fs.existsSync(process.env.JT_DB_FILE)) fs.unlinkSync(process.env.JT_DB_FILE);

global.config = require(path.join(ROOT, "core/config")).load();
global.users = { admin: ["418669971689260834"], support: [] };
global.client = { commands: new Map(), events: new Map(), cooldowns: new Map() };

const results = [];
const sent = [];
const reactions = [];
let cardCount = 0;

const api = {
  sendMessage: async (m, tid, ty) => {
    if (m?.attachments) {
      cardCount++;
      sent.push({ op: "msg+img", img: true, ttl: m.ttl || 0 });
      if (String(m.attachments).startsWith("/var/folders") && fs.existsSync(m.attachments)) fs.unlinkSync(m.attachments);
    } else {
      sent.push({ op: "msg", text: String(m?.msg || "").slice(0, 50), ttl: m?.ttl || 0 });
    }
    return { msgId: "mid" };
  },
  sendVoice: async (v, tid, ty) => { sent.push({ op: "voice", ttl: v.ttl || 0 }); return {}; },
  sendVideo: async (v, tid, ty) => { sent.push({ op: "video", ttl: v.ttl || 0 }); return {}; },
  sendSticker: async (v, tid, ty) => { sent.push({ op: "sticker", hit: !!v.cateId }); return {}; },
  sendCard: async (v, tid, ty) => { sent.push({ op: "contact" }); return {}; },
  addReaction: async (r) => { reactions.push(r); return {}; },
  removeReaction: async () => ({}),
  getUserInfo: async (uid) => ({ changed_profiles: { [uid]: { displayName: "TestUser", avatar: "https://s120-26-ava-talk.zadn.vn/8/abc.jpg", gender: 1, sdob: "2000-01-01", status: "hello" } } }),
  getGroupInfo: async () => ({ gridInfoMap: { G1: { name: "TEST BOT", totalMember: 5, creatorId: "admin", adminIds: [] } } }),
  getAllGroups: async () => ({ gridVerMap: { G1: "1" } }),
  findUser: async () => ({ uid: "123" }),
  getStickers: async () => ([{ id: "1", name: "mặc định" }]),
  uploadAttachment: async () => [{ fileUrl: "https://x.test/a", normalUrl: "https://x.test/n.jpg" }]
};
global.api = api;

const groupEvent = { threadId: "G1", type: 1, isSelf: false, data: { uidFrom: "418669971689260834", msgId: "m1", cliMsgId: "c1", content: "", msgType: "webchat", dName: "TestUser" } };

function reset() { sent.length = 0; reactions.length = 0; cardCount = 0; }
function record(name, ok, detail) { results.push({ name, ok, detail }); }

async function runCmd(name, args = [], eventOverride = {}) {
  const cmd = global.client.commands.get(name);
  if (!cmd) return { ok: false, detail: "lệnh không tồn tại" };
  const ev = { ...groupEvent, data: { ...groupEvent.data, ...eventOverride.data }, ...eventOverride };
  const wrapped = require(path.join(ROOT, "core/message")).wrapApi(api, ev.threadId, ev.type, name, ev);
  try {
    await cmd.run({ api: wrapped, event: ev, args, Threads: require(path.join(ROOT, "core/controller/controllerThreads")), reply: wrapped.__reply, Users: require(path.join(ROOT, "core/controller/controllerUsers")) });
    return { ok: sent.length > 0 || reactions.length > 0 || cardCount > 0, detail: `${sent.length} phản hồi` };
  } catch (e) {
    return { ok: false, detail: e.message.slice(0, 60) };
  }
}

(async () => {
  logger_silent = true;
  // 1. Nạp plugin
  await require(path.join(ROOT, "core/loader/loaderCommand"))();
  await require(path.join(ROOT, "core/loader/loaderEvent"))();
  record("Nạp commands", global.client.commands.size > 0, global.client.commands.size + " lệnh");
  record("Nạp events", global.client.events.size > 0, global.client.events.size + " event");

  // 2. Privacy allowlist
  const http = require(path.join(ROOT, "core/http"));
  for (const [host, label] of [
    ["s120-26-ava-talk.zadn.vn", "avatar Zalo"],
    ["zingmp3.vn", "Zing MP3"],
    ["graph.nhaccuatui.com", "NhacCuaTui"],
    ["api-v2.soundcloud.com", "SoundCloud"],
    ["api.checkphatnguoi.vn", "phát nguội"],
    ["api.elevenlabs.io", "ElevenLabs"]
  ]) {
    const r = http.hostAllowed("https://" + host + "/x", global.config);
    record(`Privacy: ${label}`, r.allowed, r.allowed ? "OK" : r.reason);
  }

  // 3. Config sections
  for (const [section, keys] of [["services", 10], ["ai", 6], ["music", 5], ["ttl", 4], ["panel", 4]]) {
    const obj = global.config[section] || {};
    record(`Config: ${section}`, Object.keys(obj).length >= 1, Object.keys(obj).length + " khoa");
  }

  // 4. Chạy từng lệnh (không tham số — phản hồi gợi ý/lỗi)
  const cmds = [...global.client.commands.keys()].sort();
  for (const name of cmds) {
    reset();
    const r = await runCmd(name, []);
    record(`Lệnh /${name}`, r.ok, r.detail);
  }

  // 5. Lệnh có tham số
  const withArgs = [
    ["menu", ["menu", "2"]],
    ["menu", ["next"]],
    ["menu", ["out"]],
    ["menu", ["uptime"]],
    ["setprefix", ["!"]],
    ["setprefix", ["reset"]],
    ["useprefix", []],
    ["carduser", []],
    ["cardinfo", []],
    ["getavt", []],
    ["getavt", ["12345678"]],
    ["bantho", []],
    ["id", ["box"]],
    ["id", ["12345678"]],
    ["stats", []],
    ["anti", ["link", "on"]],
    ["autokick", ["add", "xam"]],
    ["autokick", ["list"]],
    ["autodown", ["https://www.tiktok.com/@tiktok/video/7106658111903941934"]],
    ["gpt", ["hello"]],
    ["lyric", ["Nơi Này Có Anh"]],
    ["bxh", []],
    ["say", []],
    ["say", ["list"]],
    ["spam", ["off"]],
    ["spamsticker", ["off"]],
    ["phatnguoi", ["30A12345"]],
    ["upt", []],
    ["cdm", ["google.com"]],
    ["noi", []]
  ];
  for (const [name, args] of withArgs) {
    reset();
    const r = await runCmd(name, args);
    record(`Args /${name} ${args.join(" ")}`.trim(), r.ok, r.detail);
  }

  // 6. Event modules với context (checkEvent)
  for (const [name, mod] of global.client.events) {
    reset();
    const ev = { ...groupEvent, data: { ...groupEvent.data, content: "prefix" } };
    const wrapped = require(path.join(ROOT, "core/message")).wrapApi(api, ev.threadId, ev.type, name, ev);
    try {
      await mod.run({ api: wrapped, event: ev, eventType: "message", isSelf: false, reply: wrapped.__reply, Threads: require(path.join(ROOT, "core/controller/controllerThreads")), Users: {} });
      record(`Event ${name}`, sent.length > 0 || reactions.length > 0, `${sent.length} phản hồi`);
    } catch (e) {
      record(`Event ${name}`, false, e.message.slice(0, 60));
    }
  }

  // 7. handleEvent của commands (setprefix)
  reset();
  const setprefix = global.client.commands.get("setprefix");
  const ev = { ...groupEvent, data: { ...groupEvent.data, content: "prefix" } };
  try {
    await setprefix.handleEvent({ api: wrap(ev, "setprefix").api, event: ev, Threads: require(path.join(ROOT, "core/controller/controllerThreads")), reply: wrap(ev, "setprefix").reply });
    record("handleEvent setprefix (gõ 'prefix')", sent.length > 0, `${sent.length} phản hồi`);
  } catch (e) {
    record("handleEvent setprefix (gõ 'prefix')", false, e.message.slice(0, 80));
  }

  // 8. TTL kiểm tra
  reset();
  await runCmd("uptime", []);
  const withTtl = sent.filter(s => s.ttl > 0).length;
  record("TTL có trên phản hồi", withTtl > 0, `${withTtl}/${sent.length} tin có ttl`);

  // In kết quả
  const pass = results.filter(r => r.ok).length;
  console.log(`\n${"=".repeat(60)}`);
  for (const r of results) console.log(`${r.ok ? "✓" : "✗"} ${r.name}${r.detail ? "  — " + r.detail : ""}`);
  console.log(`${"=".repeat(60)}`);
  console.log(`KẾT QUẢ: ${pass}/${results.length} PASS\n`);
  const failed = results.filter(r => !r.ok);
  if (failed.length) {
    console.log("LỖI:");
    for (const f of failed) console.log(`  ✗ ${f.name}: ${f.detail}`);
  }
  process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error("CRASH:", e); process.exit(1); });

function wrap(ev, name) {
  const m = require(path.join(ROOT, "core/message"));
  const w = m.wrapApi(api, ev.threadId, ev.type, name, ev);
  return { api: w, reply: w.__reply };
}
