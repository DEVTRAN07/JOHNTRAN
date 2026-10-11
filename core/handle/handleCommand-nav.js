// Nhận diện thao tác ĐIỀU HƯỚNG để miễn cooldown (người dùng gõ liên tiếp).
// Gồm 2 loại:
//   1) Điều hướng menu:  /menu next|out|2...
//   2) Điều hướng nhạc:  /scl next|prev|out  (và mọi lệnh có kết quả phân trang)
const NAV_WORDS = ["next", "prev", "previous", "back", "prevpage", "nextpage", "out", "exit", "close"];
const MENU_NAMES = ["menu", "help", "menu2"];

function navActionOf(firstToken, secondToken) {
  const action = String(secondToken || "").toLowerCase();
  if (!NAV_WORDS.includes(action)) return null;
  // Menu điều hướng bằng mọi đối số; nhạc/khác chỉ điều hướng bằng next/prev/out
  if (MENU_NAMES.includes(firstToken)) return action;
  return action;
}

/**
 * @param {string} commandName  tên lệnh đã resolve (vd "menu", "scl")
 * @param {string} content      nguyên văn tin nhắn (vd "/menu next")
 * @param {string} prefix       prefix đang dùng (vd "/" hoặc "!")
 */
function isNavigation(commandName, content, prefix) {
  if (!content) return false;
  const text = String(content).trim().toLowerCase();
  if (!MENU_NAMES.includes(commandName)) return false; // menu mới phân trang nhờ tên lệnh

  const withoutPrefix = prefix && text.startsWith(prefix.toLowerCase()) ? text.slice(prefix.length).trim() : text;
  const parts = withoutPrefix.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return false;
  const action = parts[1];
  return NAV_WORDS.includes(action) || /^\d{1,2}$/.test(action);
}

/** Điều hướng của lệnh PHÂN TRANG nói chung (nhạc, danh sách...) — /scl next */
function isCommandNav(commandName, content, prefix) {
  if (!content || MENU_NAMES.includes(commandName)) return false;
  const text = String(content).trim().toLowerCase();
  const withoutPrefix = prefix && text.startsWith(prefix.toLowerCase()) ? text.slice(prefix.length).trim() : text;
  const parts = withoutPrefix.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return false;
  return NAV_WORDS.includes(parts[1]);
}

module.exports = { isNavigation, isCommandNav, isMenuNav: isNavigation, NAV_WORDS, MENU_NAMES };
