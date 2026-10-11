// ===== EVENT MỚI: REACT — thả icon/emoji cho mọi tin nhắn trong nhóm =====
// Khác với reaction trạng thái của lệnh (👍 → ✅): event này thả icon cho TIN
// THƯỜNG của thành viên, làm nhóm sống động hơn.
// Bật/tắt: /events react on|off (mặc định TẮT)
//
// Quy tắc tránh nhiễu:
//   - bỏ qua tin bot tự gửi, tin lệnh (có prefix), tin quá ngắn
//   - mỗi người 10 giây mới thả 1 lần
//   - chỉ thả trong nhóm
const { Reactions, ThreadType } = require("zalo-client");

// Bộ icon Zalo hay dùng (tránh icon tiêu cực như SHIT/DISLIKE)
const ICONS = [
  Reactions.HEART,      // ❤️
  Reactions.LIKE,       // 👍
  Reactions.HAHA,       // 😆
  Reactions.WOW,        // 😮
  Reactions.OK,         // 👌
  Reactions.THANKS,     // 🙏
  Reactions.ROSE,       // 🌹
  Reactions.KISS,       // 😘
  Reactions.COOL,       // 😎
  Reactions.BIG_SMILE,  // 😃
  Reactions.SUN,        // ☀️
  Reactions.PEACE,      // ✌️
  Reactions.HANDCLAP,   // 👏
  Reactions.PRAY        // 🙏
].filter(Boolean);

const COOLDOWN_MS = 10000; // 10s/người

module.exports.config = {
  name: "react",
  event_type: ["message"],
  version: "1.0.0",
  author: "ᴶᴼᴴᴺ ᵀᴿᴬᴺ",
  description: "Thả icon/emoji cho tin nhắn của thành viên",
  category: "Sự kiện",
  usage: "events react on|off",
  cooldowns: 0
};

module.exports.run = async function ({ api, event, Threads, isSelf }) {
  if (isSelf) return;
  if (event.type !== ThreadType.Group) return;

  const { data, threadId } = event;
  const content = String(data?.content || "").trim();
  if (content.length < 2) return;

  // Bỏ qua lệnh (bot đã tự thả reaction trạng thái cho lệnh rồi)
  const prefix = global.config.prefix;
  if (prefix && content.startsWith(prefix)) return;

  const thread = (await Threads.getData(threadId)).data || {};
  if (!thread.event_react) return;

  const uid = String(data.uidFrom || "");
  if (!uid) return;

  // Cooldown theo người — tránh spam icon
  const key = `reactCd_${uid}`;
  const now = Date.now();
  if (now - (Number(thread[key]) || 0) < COOLDOWN_MS) return;

  const icon = ICONS[Math.floor(Math.random() * ICONS.length)];
  if (!icon) return;

  try {
    await api.addReaction(icon, {
      data: { msgId: data.msgId, cliMsgId: data.cliMsgId },
      threadId,
      type: ThreadType.Group
    });
    thread[key] = now;
    await Threads.setData(threadId, thread);
  } catch {
    // Không thả được (tin cũ quá, Zalo không cho...) thì thôi
  }
};
