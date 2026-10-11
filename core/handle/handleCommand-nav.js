// Nhận diện thao tác ĐIỀU HƯỚNG menu: /menu next, /menu out, /menu 2...
// Các thao tác này không bị cooldown chặn (người dùng gõ liên tiếp).
const NAV_WORDS = ["next", "out", "exit", "close", "trang"];
const MENU_NAMES = ["menu", "help", "help2", "helpall"];

function isMenuNav(commandName, content, prefix) {
  if (!content) return false;
  const text = String(content).trim().toLowerCase();
  if (!MENU_NAMES.includes(commandName)) return false;
  // Bỏ prefix ở đầu nếu có
  const withoutPrefix = prefix && text.startsWith(prefix.toLowerCase()) ? text.slice(prefix.length).trim() : text;
  const parts = withoutPrefix.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return false;
  const action = parts[1];
  return NAV_WORDS.includes(action) || /^\d{1,2}$/.test(action);
}

module.exports = { isMenuNav, NAV_WORDS, MENU_NAMES };
