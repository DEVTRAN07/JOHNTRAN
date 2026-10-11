// ===== EVENT MỚI: WELCOME — chào thành viên mới vào nhóm =====
// Có thành viên JOIN → bot gửi thẻ chào mừng (canvas theme chung) + mention
// tất cả người mới + reaction chào. Bật/tắt: /events welcome on|off
const { Reactions, GroupEventType } = require("zalo-client");

module.exports.config = {
  name: "welcome",
  event_type: ["group_event"],
  version: "1.0.0",
  author: "ᴶᴼᴴᴺ ᵀᴿᴬᴺ",
  description: "Chào thành viên mới bằng thẻ canvas",
  category: "Sự kiện",
  usage: "events welcome on|off",
  cooldowns: 0
};

// Zalo gửi danh sách thành viên mới ở nhiều key tuỳ loại event
function newMembers(eventData) {
  const data = eventData || {};
  const keys = ["updateMembers", "joinMembers", "members", "newMembers"];
  for (const key of keys) {
    const value = data[key];
    if (Array.isArray(value)) return value.map((m) => String(m?.id || m)).filter(Boolean);
  }
  return [];
}

module.exports.run = async function ({ api, event, Threads, isSelf }) {
  if (isSelf) return;

  const eventData = event.data || {};
  // Chỉ xử lý thành viên MỚI (JOIN / được thêm vào nhóm)
  const type = eventData.action || eventData.type || event.type;
  if (type !== GroupEventType.JOIN && type !== "join") return;

  const { threadId } = event;
  const thread = (await Threads.getData(threadId)).data || {};
  if (!thread.event_welcome) return;

  const members = newMembers(eventData).filter((uid) => uid !== api.getOwnId?.());
  if (!members.length) return;

  // Mention tất cả thành viên mới
  let pos = 0;
  const mentions = members.map((uid) => {
    const item = { pos, uid, len: 2 };
    pos += 3; // "@. " cho mỗi người
    return item;
  });
  const names = members.map(() => "@.").join(" ");

  const { renderVipCard } = require("../../core/canvas/vip");
  const fs = require("fs");
  let cardPath = null;
  try {
    cardPath = await renderVipCard({
      theme: "brand",
      icon: "👋",
      title: "Chào mừng thành viên mới",
      subtitle: `${members.length} thành viên vừa gia nhình nhóm`,
      rows: [
        { label: "Thành viên", lines: [names, "🎉 Chào mừng bạn đến với nhóm!"] },
        { label: "Bước tiếp theo", lines: [`📜 Xem lệnh: ${global.config.prefix}menu`, "💬 Giới thiệu bản thân với mọi người nhé"] }
      ],
      footer: "ᴶᴼᴴᴺ ᵀᴿᴬᴺ",
      ttl: 300000
    });
    await api.sendMessage({ msg: "", attachments: cardPath, mentions, ttlKind: "card" }, threadId, event.type);
  } catch (error) {
    console.error("Lỗi welcome:", error.message);
  } finally {
    if (cardPath && fs.existsSync(cardPath)) fs.unlinkSync(cardPath);
  }

  try {
    await api.addReaction(Reactions.LIKE, {
      data: { msgId: eventData.msgId, cliMsgId: eventData.cliMsgId },
      threadId,
      type: event.type
    });
  } catch { /* bỏ qua */ }
};
