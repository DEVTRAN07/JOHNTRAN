// /cardzalo — thẻ thông tin người dùng Zalo (ảnh canvas)
//   /cardzalo            → thẻ của chính mình
//   /cardzalo <uid>      → thẻ theo id
//   /cardzalo @nguoi_dung→ thẻ người được tag
const { renderVipCard } = require("../../core/canvas/vip");

module.exports.config = {
  name: "cardzalo",
  aliases: ["card", "zalo", "info"],
  version: "3.0.0",
  role: 0,
  author: "ᴶᴼᴴᴺ ᵀᴿᴬᴺ",
  description: "Thẻ thông tin người dùng Zalo bằng ảnh",
  category: "Tiện ích",
  usage: "cardzalo [uid | @tag]",
  cooldowns: 5,
  dependencies: {}
};

// Giới tính Zalo: 1 nam, 2 nữ
function genderText(gender) {
  const g = Number(gender);
  if (g === 1) return "Nam ♂";
  if (g === 2) return "Nữ ♀";
  return "Không rõ";
}

function dobText(dob, sdob) {
  if (sdob) return String(sdob);
  if (!dob) return "Không công khai";
  const d = new Date(Number(dob) * 1000);
  if (Number.isNaN(d.getTime())) return "Không công khai";
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

module.exports.run = async function ({ api, event, args, reply }) {
  const { data } = event;

  let targetId = null;
  if (args[0] && /^\d{6,}$/.test(args[0])) {
    targetId = args[0];
  } else if (data.mentions && Object.keys(data.mentions).length > 0) {
    targetId = String(Object.keys(data.mentions)[0]);
  } else {
    targetId = String(data.uidFrom);
  }

  let user;
  try {
    const info = await api.getUserInfo(targetId);
    user = info?.changed_profiles?.[targetId] || info?.unchanged_profiles?.[targetId];
  } catch (error) {
    console.error("Lỗi cardzalo:", error.message);
    return reply.error("Không lấy được thông tin người dùng.");
  }

  if (!user) return reply.error(`Không tìm thấy thông tin của ${targetId}.`);

  const avatar = user.avatar || "";
  const friendText = Number(user.isFr) === 1 ? "Bạn bè 💚" : "Chưa kết bạn";

  // Nền thẻ = ảnh đại diện (nếu có) cho đẹp và dễ nhận diện
  const cardPath = await renderVipCard({
    theme: "brand",
    icon: "🪪",
    title: String(user.displayName || user.zaloName || "Người dùng Zalo"),
    subtitle: `${friendText} • 🆔 ${targetId}`,
    background: avatar || undefined,
    rows: [
      { label: "Hồ sơ", lines: [`👤 ${user.zaloName || user.displayName || "—"}`, `⚧ ${genderText(user.gender)}`, `🎂 ${dobText(user.dob, user.sdob)}`] },
      { label: "Trạng thái", lines: [user.status ? `💬 ${user.status}` : "💬 Không có trạng thái"] }
    ],
    footer: "ᴶᴼᴴᴺ ᵀᴿᴬᴺ • CARD ZALO",
    ttl: 300000
  });

  const fs = require("fs");
  try {
    await api.sendMessage({ msg: "", attachments: cardPath, ttlKind: "card" }, event.threadId, event.type);
  } catch (error) {
    console.error("Lỗi gửi cardzalo:", error.message);
    // Hỏng ảnh → gửi text thay thế để không mất thông tin
    return reply.error(
      `Không gửi được ảnh (${error.message}).\n` +
      `Tên: ${user.displayName}\nUID: ${targetId}\nGiới tính: ${genderText(user.gender)}\nNgày sinh: ${dobText(user.dob, user.sdob)}`
    );
  } finally {
    if (fs.existsSync(cardPath)) {
      try { fs.unlinkSync(cardPath); } catch { /* bỏ qua */ }
    }
  }
};
