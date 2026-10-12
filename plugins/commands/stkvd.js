// /stkvd — gửi sticker ĐỘNG (video sticker) theo cateId + stickerId
//   /stkvd <cateId> <stickerId>
//   /stkvd find <từ khóa>   tìm sticker động rồi chọn
// Sticker động Zalo dùng type = 1 (animated) — tìm bằng searchSticker.
const stickerStore = require("../../core/stickerStore");

module.exports.config = {
  name: "stkvd",
  aliases: ["stkvideo", "stickervd"],
  version: "3.0.0",
  role: 0,
  author: "ᴶᴼᴴᴺ ᵀᴿᴬᴺ",
  description: "Gửi sticker động (video sticker) theo id",
  category: "Tiện ích",
  usage: "stkvd <cateId> <stickerId> | stkvd find <từ khóa>",
  cooldowns: 3,
  dependencies: {}
};

// Sticker động: Zalo phân loại qua type.
// type = ảnh tĩnh (0), type = 1 sticker động (animated/video sticker)
const ANIMATED_TYPE = 1;

module.exports.run = async function ({ api, event, args, reply }) {
  const { threadId, type } = event;

  // ===== TÌM STICKER ĐỘNG =====
  const sub = (args[0] || "").toLowerCase();
  if (["find", "search", "tim"].includes(sub)) {
    const keyword = args.slice(1).join(" ").trim();
    if (!keyword) return reply.error("Nhập từ khóa: /stkvd find <từ khóa>");
    let list;
    try {
      list = await api.searchSticker(keyword, 30);
    } catch (error) {
      console.error("stkvd find:", error.message);
      return reply.error(`Tìm sticker thất bại: ${error.message}`);
    }
    if (!Array.isArray(list) || !list.length) return reply.error(`Không tìm thấy sticker cho "${keyword}".`);

    // Chỉ giữ sticker động; nếu API không trả type thì giữ toàn bộ
    const animated = list.filter((s) => Number(s?.type) === ANIMATED_TYPE);
    const useList = animated.length ? animated : list;
    const shown = useList.slice(0, 10).map((s, i) =>
      `${i + 1}. id=${s.id} cate=${s.cateId} type=${s.type}${Number(s.type) === ANIMATED_TYPE ? " (động)" : ""}`
    ).join("\n");
    stickerStore.setSearch(`vd_${threadId}`, event.data.uidFrom, useList.slice(0, 10));
    return reply.info(shown, {
      title: `🎞️ STICKER ĐỘNG: ${keyword}`,
      subtitle: "Gõ /stkvd <số> để gửi",
      footer: "ᴶᴼᴴᴺ ᵀᴿᴬᴺ"
    });
  }

  // ===== CHỌN TỪ KẾT QUẢ TÌM =====
  if (/^\d{1,2}$/.test(args[0] || "")) {
    const list = stickerStore.getSearch(`vd_${threadId}`, event.data.uidFrom);
    const target = list?.[parseInt(args[0], 10) - 1];
    if (!target) return reply.error("Số không có trong kết quả. Gõ /stkvd find <từ khóa> trước.");
    try {
      await api.sendSticker({ id: Number(target.id), cateId: Number(target.cateId), type: Number(target.type) || ANIMATED_TYPE }, threadId, type);
    } catch (error) {
      return reply.error(`Gửi sticker động thất bại: ${error.message}`);
    }
    return;
  }

  // ===== GỬI TRỰC TIẾP =====
  const [a, b] = args;
  if (!a || !b) {
    return reply.error(
      `Dùng: /stkvd <cateId> <stickerId>\n` +
      `Hoặc: /stkvd find <từ khóa> để tìm id`
    );
  }
  if (!/^\d+$/.test(a) || !/^\d+$/.test(b)) {
    return reply.error("cateId và stickerId phải là các con số.");
  }

  try {
    await api.sendSticker({ id: Number(b), cateId: Number(a), type: ANIMATED_TYPE }, threadId, type);
  } catch (error) {
    console.error("stkvd:", error.message);
    return reply.error(`Gửi sticker động thất bại: ${error.message}`);
  }
};
