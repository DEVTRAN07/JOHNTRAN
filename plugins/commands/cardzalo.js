// /cardzalo — thẻ hồ sơ người dùng Zalo (ảnh canvas, kiểu mới)
//   /cardzalo            → thẻ của chính mình
//   /cardzalo <uid>      → thẻ theo UID
//   /cardzalo @nguoi_dung→ thẻ người được tag
const profile = require("../../core/canvas/profile");

module.exports.config = {
  name: "cardzalo",
  aliases: ["card", "zalo"],
  version: "3.1.0",
  role: 0,
  author: "ᴶᴼᴴᴺ ᵀᴿᴬᴺ",
  description: "Thẻ hồ sơ người dùng Zalo",
  category: "Tiện ích",
  usage: "cardzalo [uid | @tag]",
  cooldowns: 5,
  dependencies: {}
};

function genderText(g) {
  const n = Number(g);
  if (n === 1) return "Nam ♂";
  if (n === 2) return "Nữ ♀";
  return "Không công khai";
}

function dobText(dob, sdob) {
  if (sdob) return String(sdob);
  if (!dob) return "Không công khai";
  const d = new Date(Number(dob) * 1000);
  if (Number.isNaN(d.getTime())) return "Không công khai";
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

module.exports.run = async function ({ api, event, args, reply }) {
  const { threadId, type, data } = event;

  let uid = null;
  if (args[0] && /^\d{6,}$/.test(args[0])) uid = args[0];
  else if (data.mentions && Object.keys(data.mentions).length > 0) uid = String(Object.keys(data.mentions)[0]);
  else uid = String(data.uidFrom);

  let user;
  try {
    const info = await api.getUserInfo(uid);
    user = info?.changed_profiles?.[uid] || info?.unchanged_profiles?.[uid];
  } catch (error) {
    console.error("cardzalo:", error.message);
    return reply.error(`Không đọc được hồ sơ Zalo của ${uid}.`);
  }

  if (!user) return reply.error(`Không tìm thấy hồ sơ ${uid}.`);

  const rows = [
    { icon: "👤", label: "Tên Zalo", value: user.zaloName || user.displayName || "—" },
    { icon: "⚧", label: "Giới tính", value: genderText(user.gender) },
    { icon: "🎂", label: "Ngày sinh", value: dobText(user.dob, user.sdob) },
    { icon: "💬", label: "Trạng thái", value: user.status || "Không có" },
    { icon: "🆔", label: "UID", value: uid }
  ];

  const cardPath = await profile.renderProfile({
    skin: "zalo",
    title: String(user.displayName || user.zaloName || "Người dùng Zalo"),
    handle: `@${user.username || user.zaloName || uid}`,
    subtitle: Number(user.isFr) === 1 ? "Bạn bè 💚" : "Chưa kết bạn",
    avatar: user.avatar || undefined,
    rows,
    footer: "CARD ZALO"
  });

  try {
    await api.sendMessage({ msg: "", attachments: cardPath, ttlKind: "card" }, threadId, type);
  } catch (error) {
    console.error("cardzalo gửi ảnh:", error.message);
    return reply.error(
      `Không gửi được ảnh (${error.message}).\n` +
      `Tên: ${user.displayName}\nUID: ${uid}\nGiới tính: ${genderText(user.gender)}\nNgày sinh: ${dobText(user.dob, user.sdob)}`
    );
  } finally {
    profile.cleanup(cardPath);
  }
};
