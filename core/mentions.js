// ===== @mention: rút uid người được tag từ mọi dạng dữ liệu Zalo =====
// Zalo gửi mentions ở nhiều shape khác nhau tùy loại tin:
//   - mảng [{ uid, pos, len, type }]
//   - object { "123": {...}, "456": {...} } (một số phiên bản)
//   - trong data.mentions hoặc data.quote.mentions
// Helper này chuẩn hoá về mảng uid (string, bỏ trùng, bỏ "0").
function extractMentions(data) {
  const uids = [];
  const push = (uid) => {
    const id = String(uid || "").trim();
    if (id && id !== "0" && /^\d{5,}$/.test(id) && !uids.includes(id)) uids.push(id);
  };

  const source = data?.mentions || data?.quote?.mentions;
  if (!source) return uids;

  if (Array.isArray(source)) {
    for (const m of source) push(m?.uid);
  } else if (typeof source === "object") {
    for (const [key, value] of Object.entries(source)) push(value?.uid || key);
  }
  return uids;
}

// Lấy uid đầu tiên được tag (null nếu không có)
function firstMention(data) {
  return extractMentions(data)[0] || null;
}

module.exports = { extractMentions, firstMention };
