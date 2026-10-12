// /stk — gửi sticker Zalo theo cateId + stickerId
//   /stk <cateId> <stickerId>      gửi sticker tĩnh
//   /stk find <từ khóa>            tìm sticker rồi chọn
//   /stk list <từ khóa>            danh sách id để dùng
// Aliases: sticker
const stickerStore = require("../../core/stickerStore");

module.exports.config = {
  name: "stk",
  aliases: ["sticker", "stick"],
  version: "3.0.0",
  role: 0,
  author: "ᴶᴼᴴᴺ ᵀᴿᴬᴺ",
  description: "Gửi sticker Zalo theo id hoặc tìm sticker",
  category: "Tiện ích",
  usage: "stk <cateId> <stickerId> | stk find <từ khóa>",
  cooldowns: 3,
  dependencies: {}
};

module.exports.run = async function ({ api, event, args, reply }) {
  const { threadId, type } = event;

  // ===== TÌM STICKER =====
  const sub = (args[0] || "").toLowerCase();
  if (["find", "search", "tim"].includes(sub)) {
    const keyword = args.slice(1).join(" ").trim();
    if (!keyword) return reply.error("Nhập từ khóa: /stk find <từ khóa>");
    let list;
    try {
      list = await api.searchSticker(keyword, 15);
    } catch (error) {
      console.error("stk find:", error.message);
      return reply.error(`Tìm sticker thất bại: ${error.message}`);
    }
    if (!Array.isArray(list) || !list.length) return reply.error(`Không tìm thấy sticker cho "${keyword}".`);
    const shown = list.slice(0, 10).map((s, i) =>
      `${i + 1}. id=${s.id} cate=${s.cateId} type=${s.type}`
    ).join("\n");
    stickerStore.setSearch(event.threadId, event.data.uidFrom, list.slice(0, 10));
    return reply.info(shown, {
      title: `🔎 STICKER: ${keyword}`,
      subtitle: `Gõ /stk <số> để gửi`,
      footer: "ᴶᴼᴴᴺ ᵀᴿᴬᴺ"
    });
  }

  // ===== CHỌN TỪ KẾT QUẢ TÌM =====
  if (/^\d{1,2}$/.test(args[0] || "")) {
    const list = stickerStore.getSearch(event.threadId, event.data.uidFrom);
    const index = parseInt(args[0], 10) - 1;
    const target = list?.[index];
    if (!target) return reply.error("Số không có trong kết quả. Gõ /stk find <từ khóa> trước.");
    try {
      await api.sendSticker({ id: target.id, cateId: target.cateId, type: target.type || 0 }, threadId, type);
    } catch (error) {
      return reply.error(`Gửi sticker thất bại: ${error.message}`);
    }
    return;
  }

  // ===== GỬI TRỰC TIẾP: /stk <cateId> <stickerId> =====
  const [a, b] = args;
  if (!a || !b) {
    return reply.error(
      `Dùng: /stk <cateId> <stickerId>\n` +
      `Hoặc: /stk find <từ khóa> để tìm id`
    );
  }
  if (!/^\d+$/.test(a) || !/^\d+$/.test(b)) {
    return reply.error("cateId và stickerId phải là các con số.");
  }

  try {
    await api.sendSticker({ id: Number(b), cateId: Number(a), type: 0 }, threadId, type);
  } catch (error) {
    console.error("stk:", error.message);
    return reply.error(`Gửi sticker thất bại: ${error.message}`);
  }
};
