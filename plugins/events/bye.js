// ===== EVENT MỚI: BYE — tạm biệt thành viên rời nhóm =====
// Có người LEAVE / bị REMOVE / bị BLOCK → bot gửi thẻ tạm biệt (không tag).
// Bật/tắt: /events bye on|off
const { GroupEventType } = require("zalo-client");

module.exports.config = {
  name: "bye",
  event_type: ["group_event"],
  version: "1.0.0",
  author: "ᴶᴼᴴᴺ ᵀᴿᴬᴺ",
  description: "Thông báo khi thành viên rời nhóm",
  category: "Sự kiện",
  usage: "events bye on|off",
  cooldowns: 0
};

const LEAVE_TYPES = [GroupEventType.LEAVE, GroupEventType.REMOVE_MEMBER, GroupEventType.BLOCK_MEMBER, "leave", "remove_member", "block_member"];

function leftMembers(eventData) {
  const data = eventData || {};
  const keys = ["updateMembers", "leaveMembers", "members", "removeMembers"];
  for (const key of keys) {
    const value = data[key];
    if (Array.isArray(value)) return value.map((m) => String(m?.id || m)).filter(Boolean);
  }
  return [];
}

module.exports.run = async function ({ api, event, Threads, isSelf }) {
  if (isSelf) return;

  const eventData = event.data || {};
  const type = eventData.action || eventData.type || event.type;
  if (!LEAVE_TYPES.includes(type)) return;

  const { threadId } = event;
  const thread = (await Threads.getData(threadId)).data || {};
  if (!thread.event_bye) return;

  const members = leftMembers(eventData);
  if (!members.length) return;

  const { renderVipCard } = require("../../core/canvas/vip");
  const fs = require("fs");
  let cardPath = null;
  try {
    cardPath = await renderVipCard({
      theme: "warn",
      icon: "👋",
      title: "Tạm biệt",
      subtitle: `${members.length} thành viên vừa rời nhóm`,
      rows: [
        { label: "Thành viên", lines: [members.map(() => "👤").join(" ")] },
        { label: "Lưu ý", lines: ["🌼 Chúc bạn nhiều điều tốt đẹp ở bên ngoài"] }
      ],
      footer: "ᴶᴼᴴᴺ ᵀᴿᴬᴺ",
      ttl: 120000
    });
    await api.sendMessage({ msg: "", attachments: cardPath, ttlKind: "card" }, threadId, event.type);
  } catch (error) {
    console.error("Lỗi bye:", error.message);
  } finally {
    if (cardPath && fs.existsSync(cardPath)) fs.unlinkSync(cardPath);
  }
};
