// Spam tin nhắn + tag người dùng (admin bot)
module.exports.config = {
  name: "spam",
  aliases: ["sp", "chui", "tag"],
  version: "2.0.0",
  role: 2,
  author: "ᴶᴼᴴᴺ ᵀᴿᴬᴺ",
  description: "Spam tin nhắn có tag người dùng (admin bot)",
  category: "Hệ thống",
  usage: "spam <@tag|uid...> [-t <số lần>] [-d <giây>] [tin nhắn...] | spam off",
  cooldowns: 5,
  dependencies: {}
};

const running = new Map(); // threadId -> job

function parseArgs(args) {
  const result = { targets: [], message: "", times: 5, delay: 2, defaultMessage: "Hello" };
  const rest = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const lower = arg.toLowerCase();
    if (lower === "-t" && args[i + 1]) { result.times = Math.min(parseInt(args[++i], 10) || 5, 200); continue; }
    if (lower === "-d" && args[i + 1]) { result.delay = Math.max(parseFloat(args[++i]) || 2, 300) * 1000; continue; }
    rest.push(arg);
  }

  result.targets = rest.filter((a) => /^\d{6,}$/.test(a));
  const textParts = rest.filter((a) => !/^\d{6,}$/.test(a));
  result.message = textParts.join(" ").trim() || result.defaultMessage;
  result.times = Math.max(1, result.times);
  return result;
}

module.exports.run = async function ({ api, event, args }) {
  const { threadId, type, data } = event;
  const sub = (args[0] || "").toLowerCase();

  if (sub === "off" || sub === "stop") {
    const job = running.get(threadId);
    if (!job) {
      return api.sendMessage({ msg: "❌ Không có spam nào đang chạy.", ttl: 60000 }, threadId, type);
    }
    clearInterval(job.timer);
    running.delete(threadId);
    return api.sendMessage({ msg: `✅ Đã dừng spam (đã gửi ${job.count}/${job.times}).`, ttl: 60000 }, threadId, type);
  }

  // Thu thập mục tiêu: tag trước, sau đó args
  const targets = [];
  if (data.mentions && Object.keys(data.mentions).length > 0) {
    for (const uid of Object.keys(data.mentions)) targets.push(uid);
  }
  const opts = parseArgs(args);
  for (const t of opts.targets) if (!targets.includes(t)) targets.push(t);

  if (targets.length === 0) {
    return api.sendMessage({
      msg: `⚠️ Cách dùng:\n${global.config.prefix}spam <@tag|uid> [tin nhắn] [-t số lần] [-d giây]\n` +
           `${global.config.prefix}spam off — dừng\n\n` +
           "Ví dụ: /spam @bạn hello -t 5 -d 2\n" +
           "Ví dụ: /spam 12345678 Xin chào -t 3",
      ttl: 60000
    }, threadId, type);
  }

  if (running.has(threadId)) {
    return api.sendMessage({ msg: "⚠️ Spam đang chạy. Gõ /spam off để dừng.", ttl: 60000 }, threadId, type);
  }

  // Xây dựng tin nhắn có mention (Zalo yêu cầu pos/uid/len)
  const job = { count: 0, times: opts.times, timer: null };

  const buildText = () => {
    let text = "";
    const mentions = [];
    for (const uid of targets) {
      const pos = text.length;
      const name = "@.";
      text += name;
      mentions.push({ pos, uid, len: name.length });
    }
    text += ` ${opts.message}`;
    return { text, mentions };
  };

  job.timer = setInterval(async () => {
    if (job.count >= job.times) {
      clearInterval(job.timer);
      running.delete(threadId);
      return api.sendMessage({ msg: `✅ Đã spam xong ${job.count} lần.`, ttl: 60000 }, threadId, type);
    }
    try {
      const { text, mentions } = buildText();
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
  return api.sendMessage({
    msg: `▶️ Bắt đầu spam: ${opts.message}\n👥 ${targets.length} người • ${opts.times} lần • mỗi ${opts.delay / 1000}s\nDừng: ${global.config.prefix}spam off`,
    ttl: 60000
  }, threadId, type);
};
