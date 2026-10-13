// Audit hiệu năng: đo load từng file + quét pattern làm chậm trong từng lệnh
// Chạy: node scripts/audit-perf.js
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const CMD_DIR = path.join(ROOT, "plugins", "commands");
const EVT_DIR = path.join(ROOT, "plugins", "events");

// Module nặng: load 1 lần nhưng làm chậm khởi động + chiếm RAM
const HEAVY = [
  "canvas", "jimp", "sharp", "@napi-rs/canvas", "skia-canvas",
  "fluent-ffmpeg", "ffmpeg-static", "axios", "ytdl-core", "puppeteer",
  "cheerio", "gifencoder", "gif-encoder", "wavefile", "mp3-cutter"
];

function scanRisks(src, file) {
  const risks = [];
  const lines = src.split("\n");

  // 1. require module nặng ở ĐẦU file (load lúc khởi động bot)
  for (const lib of HEAVY) {
    const re = new RegExp(`^const\\s+.*require\\(["']${lib.replace("/", "\\/")}`, "m");
    if (re.test(src)) risks.push(`require nặng: ${lib}`);
  }

  lines.forEach((line, idx) => {
    const no = idx + 1;
    // 2. sync fs trong thân lệnh
    if (/\b(readFileSync|writeFileSync|existsSync|mkdirSync|unlinkSync|statSync|readdirSync)\s*\(/.test(line)) {
      if (!/^\/\//.test(line.trim())) risks.push(`sync fs:${no}`);
    }
    // 3. render canvas trong run
    if (/renderVipCard|renderMenuGrid|renderNowPlaying|renderSearchGrid|createCanvas|renderVipFrame/.test(line)) {
      risks.push(`render canvas:${no}`);
    }
    // 4. http KHÔNG qua cache (music đã có cache; còn lại cứ gọi trực tiếp)
    if (/https?\.getJson\(|https?\.getBuffer\(|https?\.request\(|axios\.(get|post)\(/.test(line)) {
      risks.push(`http trực tiếp:${no}`);
    }
    // 5. setTimeout/setInterval không unref
    if (/setInterval\(/.test(line) && !/unref/.test(lines[idx + 1] || "")) {
      risks.push(`setInterval:${no}`);
    }
    // 6. execFile/ffmpeg đồng bộ trong lệnh
    if (/execSync|spawnSync/.test(line)) risks.push(`exec đồng bộ:${no}`);
  });

  // 7. reply.* KHÔNG plain (render thẻ canvas)
  const cardCalls = [...src.matchAll(/reply\.(text|error|success|info)\(/g)].length;
  if (cardCalls > 0) risks.push(`reply.card-style ×${cardCalls}`);
  return risks;
}

async function main() {
  console.log("=".repeat(72));
  console.log("AUDIT HIỆU NĂNG — thời gian load từng file lệnh");
  console.log("=".repeat(72));

  const results = [];

  const measure = (file) => {
    const full = path.join(CMD_DIR, file);
    const t0 = process.hrtime.bigint();
    try {
      delete require.cache[require.resolve(full)];
      require(full);
    } catch (err) {
      return { file, ms: -1, error: err.message, risks: [] };
    }
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    const src = fs.readFileSync(full, "utf8");
    return { file, ms, risks: scanRisks(src, full) };
  };

  const files = fs.readdirSync(CMD_DIR).filter((f) => f.endsWith(".js"));
  for (const f of files.sort()) {
    results.push(measure(f));
  }

  // lần 2: module đã cache — đo chi phí THỰC của lần đầu (chưa cache)
  console.log("\n--- LỆNH (load lạnh, chưa cache) ---");
  console.log("file".padEnd(22) + "ms".padStart(8) + "  rủi ro");
  for (const r of results.sort((a, b) => b.ms - a.ms)) {
    const ms = r.ms < 0 ? "LỖI" : r.ms.toFixed(0);
    console.log(
      r.file.padEnd(22) + String(ms).padStart(8) + "  " + r.risks.slice(0, 4).join(", ")
    );
    if (r.error) console.log(" ".repeat(31) + "LỖI: " + r.error);
  }

  // ===== core modules =====
  console.log("\n--- CORE MODULES ---");
  const coreFiles = [
    "core/message.js", "core/styled.js", "core/listen.js", "core/music/index.js",
    "core/music/command.js", "core/stickerCreate.js", "core/stickerConvert.js",
    "core/http/index.js", "core/metrics.js", "utils/index.js",
    "core/controller/controllerThreads.js", "core/canvas/vip.js", "core/canvas/menu.js"
  ];
  for (const f of coreFiles) {
    const full = path.join(ROOT, f);
    if (!fs.existsSync(full)) { console.log(f.padEnd(38) + "KHÔNG CÓ"); continue; }
    const t0 = process.hrtime.bigint();
    try { delete require.cache[require.resolve(full)]; require(full); } catch (e) { console.log(f, "LỖI", e.message); continue; }
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    console.log(f.padEnd(38) + ms.toFixed(0).padStart(6) + "ms");
  }

  // ===== hot path mỗi tin nhắn =====
  console.log("\n--- HOT PATH (mỗi tin nhắn, sync) ---");
  const t1 = process.hrtime.bigint();
  const { updateMessageCache, getMessageCache } = require(path.join(ROOT, "utils/index.js"));
  updateMessageCache({ threadId: "T1", type: 1, data: { ts: Date.now(), msgId: "1", cliMsgId: "c1", msgType: 1, uidFrom: "u1", idTo: "t1", dName: "n", content: "x" } });
  const cacheMs = Number(process.hrtime.bigint() - t1) / 1e6;
  console.log("updateMessageCache:      " + cacheMs.toFixed(3) + "ms (RAM, debounce ghi đĩa)");

  const t2 = process.hrtime.bigint();
  const mod = require(path.join(ROOT, "core/styled.js"));
  const styled = mod.frame("Tin nhắn mẫu có nhãn: giá trị", { kind: "error" });
  const styleMs = Number(process.hrtime.bigint() - t2) / 1e6;
  console.log("styled.frame:            " + styleMs.toFixed(3) + "ms");

  const t3 = process.hrtime.bigint();
  const http = require(path.join(ROOT, "core/http/index.js"));
  const guard = http.hostAllowed("https://api-v2.soundcloud.com/x", global.config || {});
  const guardMs = Number(process.hrtime.bigint() - t3) / 1e6;
  console.log("privacy guard check:     " + guardMs.toFixed(3) + "ms (allowed: " + guard.allowed + ")");

  // ===== tổng kết =====
  const totalCmd = results.reduce((a, r) => a + Math.max(0, r.ms), 0);
  const slow = results.filter((r) => r.ms > 50);
  const risky = results.filter((r) => r.risks.length > 0);
  console.log("\n" + "=".repeat(72));
  console.log("TỔNG KẾT");
  console.log("  Tổng load " + files.length + " lệnh:        " + totalCmd.toFixed(0) + "ms");
  console.log("  Lệnh load >50ms:         " + (slow.map((r) => r.file + " (" + r.ms.toFixed(0) + "ms)").join(", ") || "không có"));
  console.log("  Lệnh có rủi ro chậm:     " + (risky.map((r) => r.file).join(", ") || "không có"));
  console.log("=".repeat(72));
}

main();
