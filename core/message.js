const { renderVipCard } = require("./canvas/vip");
const { Reactions } = require("zalo-client");
const cache = require("./cache");
const logger = require("../utils/logger");

// TTL (tự xoá tin) nay chỉ là tuỳ chọn THÔ: lệnh nào muốn tin tự xoá thì
// truyền ttl (ms, Zalo chỉ nhận >= 60000), không truyền thì tin nằm lại.
// Không còn hệ thống ttlKind/config nữa — tránh rườm rà.

class Reply {
  constructor(api, threadId, type, commandName, event = null) {
    this.api = api;
    this.threadId = threadId;
    this.type = type;
    this.commandName = commandName || "bot";
    this.event = event;
    this.reacted = false; // đã thả reaction cho tin này → handleCommand không thả lại
  }

  async text(msg, options = {}) {
    const ttl = options.ttl;
    if (options.plain) {
      return this.api.sendMessage({ msg, ttl }, this.threadId, this.type);
    }
    return this._sendCard(null, ttl, { ...options, title: options.title || this.commandName.toUpperCase(), rows: options.rows || [{ lines: String(msg).split("\n").filter((l) => l.trim() !== "") }] });
  }

  async error(msg, options = {}) {
    return this._sendCard(null, options.ttl, {
      ...options,
      theme: "error",
      title: options.title || "Đã xảy ra lỗi",
      subtitle: options.subtitle || msg,
      rows: options.rows
    });
  }

  async success(msg, options = {}) {
    return this._sendCard(null, options.ttl, {
      ...options,
      theme: "success",
      title: options.title || "Hoàn thành",
      subtitle: options.subtitle || msg,
      rows: options.rows
    });
  }

  // Thẻ thông tin / hướng dẫn (TTL dài hơn tin thường vì người ta cần đọc kỹ)
  async info(msg, options = {}) {
    return this._sendCard(null, options.ttl, {
      ...options,
      theme: options.theme || "info",
      title: options.title || "Thông tin",
      subtitle: options.subtitle || msg,
      rows: options.rows
    });
  }

  async card(spec = {}) {
    const ttl = spec.ttl;
    return this._sendCard(spec, ttl, spec);
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

  async _sendCard(spec, ttl, options) {
    let filePath = null;
    try {
      filePath = await renderVipCard({ ttl, ...(spec || {}) });
    } catch (error) {
      logger.log(`Lỗi render thẻ: ${error.message}`, "warn");
      filePath = null;
    }

    // Không render được ảnh → gửi TEXT thuần (không dùng 2 kiểu ảnh khác nhau)
    if (!filePath) {
      const plainMsg = options.subtitle || options.title || String(options.msg || "");
      return this.api.sendMessage({ msg: plainMsg, ttl }, this.threadId, this.type);
    }

    const cleanup = () => {
      try { require("fs").unlinkSync(filePath); } catch { /* bỏ qua */ }
    };
    try {
      return await this.api.sendMessage({ msg: "", attachments: filePath, ttl }, this.threadId, this.type);
    } finally {
      cleanup();
    }
  }
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
    delete content.ttlKind;   // không còn cơ chế ttl theo loại tin
    delete content.replace;    // không còn thu hồi tin cũ
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
