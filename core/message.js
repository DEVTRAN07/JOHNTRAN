const { Reactions } = require("zalo-client");
const cache = require("./cache");
const logger = require("../utils/logger");
const styledText = require("./styled");
const fs = require("fs");
const crypto = require("crypto");

// Tin nhắn KHÔNG còn tự xoá (đã bỏ toàn bộ hệ thống TTL theo yêu cầu).

// ===== CACHE ẢNH THẺ ĐÃ RENDER =====
// Render 1 thẻ canvas mất ~0.7s trên máy mạnh, 2-3s trên Render free tier.
// Thẻ lặp lại (menu, thông báo lỗi cùng nội dung, hướng dẫn...) giờ dùng lại
// ảnh đã render trong 5 phút — không render lại, không chờ CPU.
const CARD_TTL = 5 * 60 * 1000;
const CARD_MAX = 60;
const cardCache = new Map(); // hash → { path, at, cached }

function hashSpec(spec, ttl) {
  return crypto.createHash("md5").update(JSON.stringify({ ttl, ...(spec || {}) })).digest("hex");
}

async function renderCachedCard(spec, ttl) {
  const hash = hashSpec(spec, ttl);

  const hit = cardCache.get(hash);
  if (hit && Date.now() - hit.at < CARD_TTL && fs.existsSync(hit.path)) {
    hit.at = Date.now(); // LRU: dùng lại thì kéo dài tuổi
    return hit.path;
  }

  const { renderVipCard } = require("./canvas/vip"); // lazy — canvas nặng, chỉ cần khi gọi reply.card
  const filePath = await renderVipCard({ ttl, ...(spec || {}) });
  if (!filePath) return null;

  if (cardCache.size >= CARD_MAX) {
    // xoá thẻ cũ nhất khỏi cache (và xoá file tạm của nó)
    const oldestKey = [...cardCache.entries()].sort((a, b) => a[1].at - b[1].at)[0]?.[0];
    if (oldestKey) {
      const old = cardCache.get(oldestKey);
      try { if (old?.path) fs.unlinkSync(old.path); } catch { /* bỏ qua */ }
      cardCache.delete(oldestKey);
    }
  }
  cardCache.set(hash, { path: filePath, at: Date.now(), cached: true });
  return filePath;
}

class Reply {
  constructor(api, threadId, type, commandName, event = null) {
    this.api = api;
    this.threadId = threadId;
    this.type = type;
    this.commandName = commandName || "bot";
    this.event = event;
    this.reacted = false; // đã thả reaction cho tin này → handleCommand không thả lại
  }

  // ===== MẶC ĐỊNH: TEXT CÓ STYLE — phản hồi tức thì (0ms, 1 API call) =====
  // Zalo style text trực tiếp (bold/màu/cỡ chữ) nên vẫn đẹp như thẻ ảnh
  // nhưng KHÔNG render canvas, KHÔNG upload ảnh. Ảnh thẻ chỉ khi lệnh
  // chủ ý gọi reply.card().
  async text(msg, options = {}) {
    if (options.plain) {
      return this.api.sendMessage({ msg, styles: options.styles, ttl: options.ttl }, this.threadId, this.type);
    }
    const styled = styledText.plain(msg);
    return this.api.sendMessage({ ...styled, ttl: options.ttl }, this.threadId, this.type);
  }

  async error(msg, options = {}) {
    const styled = styledText.frame(msg, { kind: "error", title: options.title });
    return this.api.sendMessage({ ...styled, ttl: options.ttl }, this.threadId, this.type);
  }

  async success(msg, options = {}) {
    const styled = styledText.frame(msg, { kind: "success", title: options.title });
    return this.api.sendMessage({ ...styled, ttl: options.ttl }, this.threadId, this.type);
  }

  // Thẻ thông tin / hướng dẫn
  async info(msg, options = {}) {
    const styled = styledText.frame(msg, { kind: "info", title: options.title });
    return this.api.sendMessage({ ...styled, ttl: options.ttl }, this.threadId, this.type);
  }

  async warn(msg, options = {}) {
    const styled = styledText.frame(msg, { kind: "warn", title: options.title });
    return this.api.sendMessage({ ...styled, ttl: options.ttl }, this.threadId, this.type);
  }

  // ===== Ảnh THẺ (opt-in): chỉ dùng khi thật sự muốn ảnh đẹp =====
  async card(spec = {}) {
    const ttl = spec.ttl;
    const filePath = await renderCachedCard(spec, ttl);
    if (!filePath) {
      // render hỏng → gửi text thuần, không mất phản hồi
      const plainMsg = spec.subtitle || spec.title || String(spec.msg || "");
      return this.api.sendMessage({ msg: plainMsg, ttl }, this.threadId, this.type);
    }
    return this.api.sendMessage({ msg: "", attachments: filePath, ttl }, this.threadId, this.type);
  }

  async media({ msg, attachments, ttl }) {
    return this.api.sendMessage({ msg, attachments, ttl }, this.threadId, this.type);
  }

  async voice({ voiceUrl, msg, ttl }) {
    if (msg) await this.text(msg, { plain: true });
    return this.api.sendVoice({ voiceUrl, ttl }, this.threadId, this.type);
  }

  async video({ videoUrl, thumbnailUrl, msg, duration, width, height, ttl }) {
    return this.api.sendVideo({
      videoUrl,
      thumbnailUrl,
      duration,
      width,
      height,
      msg,
      ttl
    }, this.threadId, this.type);
  }

  // ===== Reaction trạng thái: 👀 (đang xử lý) → ✅ (xong) / 😢 (lỗi) =====
  async react(reaction) {
    this.reacted = true; // đánh dấu để handleCommand không tự thả thêm
    if (!this.event?.data?.msgId || !this.api?.addReaction) return false;
    try {
      await this.api.addReaction(reaction, {
        data: { msgId: this.event.data.msgId, cliMsgId: this.event.data.cliMsgId },
        threadId: this.threadId,
        type: this.type
      });
      return true;
    } catch {
      return false;
    }
  }

  working() { return this.react(Reactions.PRAY); }
  done() { return this.react(Reactions.OK); }
  failed() { return this.react(Reactions.CRY); }
}

// ZaloApi của zalo-client khai báo MỌI method bằng accessor get/set (lazy).
// Gán trực tiếp (wrapped.sendMessage = fn) sẽ rơi vào SETTER của api gốc,
// ghi đè method gốc bằng chính wrapper → wrapper gọi lại chính nó → đệ qu vô hạn.
// Bắt buộc defineProperty để tạo OWN property trên wrapped.
function defineWrapped(wrapped, name, fn) {
  Object.defineProperty(wrapped, name, {
    value: fn,
    writable: true,
    enumerable: true,
    configurable: true
  });
}

function wrapApi(api, threadId, type, commandName, event = null) {
  if (!api) return api;
  const reply = new Reply(api, threadId, type, commandName, event);

  const wrapped = Object.create(api);

  defineWrapped(wrapped, "sendMessage", async (message, tid, ty) => {
    const targetThreadId = threadId || tid;
    const targetType = type || ty;
    const content = typeof message === "string" ? { msg: message } : { ...message };
    if (content.plain) delete content.plain;
    return api.sendMessage(content, targetThreadId, targetType);
  });

  defineWrapped(wrapped, "sendVoice", async (payload, tid, ty) => {
    const content = typeof payload === "string" ? { voiceUrl: payload } : { ...payload };
    return api.sendVoice(content, threadId || tid, type || ty);
  });

  defineWrapped(wrapped, "sendVideo", async (payload, tid, ty) => {
    return api.sendVideo({ ...payload }, threadId || tid, type || ty);
  });

  // ===== Cache tầng API Zalo: giảm gọi API, phản hồi nhanh hơn =====
  defineWrapped(wrapped, "getGroupInfo", async (tid) => {
    const key = String(tid);
    return cache.caches.groupInfo.remember(key, () => api.getGroupInfo(tid));
  });

  defineWrapped(wrapped, "getUserInfo", async (uid) => {
    const key = String(uid);
    return cache.caches.userInfo.remember(key, () => api.getUserInfo(uid));
  });

  defineWrapped(wrapped, "invalidateCache", async (kind, key) => {
    if (kind === "group") cache.caches.groupInfo.delete(String(key));
    if (kind === "user") cache.caches.userInfo.delete(String(key));
  });

  Object.defineProperty(wrapped, "__reply", { value: reply, enumerable: false });
  return wrapped;
}

module.exports = { Reply, wrapApi };
