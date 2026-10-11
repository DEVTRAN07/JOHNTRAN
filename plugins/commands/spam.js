// Spam tin nhắn + tag người dùng (admin bot).
// Nội dung lấy từ folder assets/spam/*.txt (mỗi dòng 1 câu) — không ghi cứng trong code.
// Dùng: /spam <@tag|uid> [tin nhắn] [-t số lần] [-d giây] | /spam off | reload | list
const fs = require("fs");
const path = require("path");

const SPAM_DIR = path.join(__dirname, "..", "..", "assets", "spam");
const DEFAULT_TIMES = 20; // lần spam mặc định
const MAX_TIMES = 500;
const DEFAULT_DELAY_MS = 1500; // 1.5s/lần

let words = [];

function loadWords() {
  const loaded = [];
  try {
    if (fs.existsSync(SPAM_DIR)) {
      for (const file of fs.readdirSync(SPAM_DIR).filter((f) => f.endsWith(".txt"))) {
        const content = fs.readFileSync(path.join(SPAM_DIR, file), "utf8");
        for (const line of content.split(/\r?\n/)) {
          const text = line.trim();
          if (!text || text.startsWith("#")) continue; // bỏ dòng trống + chú thích
          loaded.push(text);
        }
      }
    }
  } catch (error) {
    console.error("Lỗi nạp ngôn từ spam:", error.message);
  }
  words = loaded;
  return words;
}

function randomWord() {
  if (!words.length) return null;
  return words[Math.floor(Math.random() * words.length)];
}

loadWords(); // nạp sẵn khi khởi động

module.exports.config = {
  name: "spam",
  aliases: ["sp", "chui", "tag"],
  version: "3.0.0",
  role: 2,
  author: "ᴶᴼᴴᴺ ᵀᴿᴬᴺ",
  description: "Spam tin nhắn có tag người dùng (admin bot)",
  category: "Hệ thống",
  usage: "spam <@tag|uid> [tin nhắn] [-t số lần] [-d giây] | spam off | reload | list",
  cooldowns: 5,
  dependencies: {}
};

const running = new Map(); // threadId -> job

function parseArgs(args) {
  const result = { targets: [], message: "", times: DEFAULT_TIMES, delay: DEFAULT_DELAY_MS };
  const rest = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const lower = arg.toLowerCase();
    if (lower === "-t" && args[i + 1] !== undefined) {
      // 0 = spam không giới hạn (dừng bằng /spam off)
      const t = parseInt(args[++i], 10);
      result.times = Number.isFinite(t) && t >= 0 ? Math.min(t, MAX_TIMES) : DEFAULT_TIMES;
      continue;
    }
    if (lower === "-d" && args[i + 1] !== undefined) {
      const d = parseFloat(args[++i]);
      result.delay = Math.min(Math.max(Number.isFinite(d) && d > 0 ? d : DEFAULT_DELAY_MS, 0.3), 30) * 1000;
      continue;
    }
    rest.push(arg);
  }

  result.targets = rest.filter((a) => /^\d{6,}$/.test(a));
  const textParts = rest.filter((a) => !/^\d{6,}$/.test(a));
  result.message = textParts.join(" ").trim();
  return result;
}

module.exports.run = async function ({ api, event, args }) {
  const { threadId, type, data } = event;
  const sub = (args[0] || "").toLowerCase();

  // ===== TẮT =====
  if (sub === "off" || sub === "stop") {
    const job = running.get(threadId);
    if (!job) {
      return api.sendMessage({ msg: "❌ Không có spam nào đang chạy.", ttl: 60000 }, threadId, type);
    }
    clearInterval(job.timer);
    running.delete(threadId);
    return api.sendMessage({ msg: `✅ Đã dừng spam (đã gửi ${job.count}/${job.timesText}).`, ttl: 60000 }, threadId, type);
  }

  // ===== NẠP LẠI NGÔN TỪ =====
  if (sub === "reload" || sub === "load") {
    const n = loadWords().length;
    return api.sendMessage({ msg: n ? `✅ Đã nạp ${n} câu spam từ assets/spam/.` : "❌ Không đọc được câu nào trong assets/spam/ — kiểm tra folder.", ttl: 60000 }, threadId, type);
  }

  // ===== XEM SỐ NGÔN TỪ =====
  if (sub === "list" || sub === "info" || sub === "stats") {
    return api.sendMessage({
      msg: `📦 Ngôn từ spam: ${words.length} câu (thư mục assets/spam/)` +
           (words.length ? `\nVí dụ: "${words[0]}"` : ""),
      ttl: 60000
    }, threadId, type);
  }

  // ===== Thu thập mục tiêu: tag trước, sau đó args =====
  const targets = [];
  if (data?.mentions && Object.keys(data.mentions).length > 0) {
    for (const uid of Object.keys(data.mentions)) targets.push(uid);
  }
  const opts = parseArgs(args);
  for (const t of opts.targets) if (!targets.includes(t)) targets.push(t);

  if (targets.length === 0) {
    return api.sendMessage({
      msg: `⚠️ Cách dùng:\n` +
           `${global.config.prefix}spam <@tag|uid> [tin nhắn] [-t số lần] [-d giây]\n` +
           `${global.config.prefix}spam off — dừng\n` +
           `${global.config.prefix}spam reload — nạp lại ngôn từ\n` +
           `${global.config.prefix}spam list — xem số ngôn từ\n\n` +
           "Không gõ tin nhắn = lấy câu ngẫu nhiên từ assets/spam/\n" +
           "Ví dụ: /spam @bạn (20 lần, câu ngẫu nhiên)\n" +
           "Ví dụ: /spam 12345678 Xin chào -t 5 -d 1\n" +
           "Ví dụ: /spam @bạn -t 0 (không giới hạn → /spam off để dừng)",
      ttl: 60000
    }, threadId, type);
  }

  if (running.has(threadId)) {
    return api.sendMessage({ msg: "⚠️ Spam đang chạy. Gõ /spam off để dừng.", ttl: 60000 }, threadId, type);
  }

  const timesText = opts.times === 0 ? "∞" : String(opts.times);
  const job = { count: 0, times: opts.times, timesText, timer: null };

  // Xây dựng tin nhắn có mention (Zalo yêu cầu pos/uid/len)
  const buildText = (message) => {
    let text = "";
    const mentions = [];
    for (const uid of targets) {
      const pos = text.length;
      const name = "@.";
      text += name;
      mentions.push({ pos, uid, len: name.length });
    }
    text += ` ${message}`;
    return { text, mentions };
  };

  job.timer = setInterval(async () => {
    if (opts.times !== 0 && job.count >= opts.times) {
      clearInterval(job.timer);
      running.delete(threadId);
      return api.sendMessage({ msg: `✅ Đã spam xong ${job.count} lần.`, ttl: 60000 }, threadId, type);
    }

    // Không gõ tay → lấy câu ngẫu nhiên từ folder; hết câu trong folder thì dùng câu mặc định
    const message = opts.message || randomWord() || "Hello";
    try {
      const { text, mentions } = buildText(message);
      await api.sendMessage({ msg: text, mentions, ttl: 60000 }, threadId, type);
      job.count++;
    } catch (error) {
      console.error("Lỗi gửi spam:", error.message);
      clearInterval(job.timer);
      running.delete(threadId);
      return api.sendMessage({ msg: "❌ Lỗi khi gửi tin nhắn.", ttl: 30000 }, threadId, type);
    }
  }, opts.delay);

  running.set(threadId, job);
  const usingFolder = !opts.message && words.length > 0;
  return api.sendMessage({
    msg: `▶️ Bắt đầu spam ${timesText} lần • mỗi ${opts.delay / 1000}s\n` +
         `👥 ${targets.length} người • ${usingFolder ? `câu ngẫu nhiên từ assets/spam/ (${words.length} câu)` : `nội dung: ${opts.message}`}\n` +
         `Dừng: ${global.config.prefix}spam off`,
    ttl: 60000
  }, threadId, type);
};
