const canvasLib = require("./canvas");
const { renderVipCard } = require("./canvas/vip");
const { Reactions } = require("zalo-client");
const cache = require("./cache");

const MIN_TTL = 60000; // Zalo chỉ tự xóa tin nhắn khi ttl >= 60s

function ttlConfig() {
  const ttl = global.config?.ttl || {};
  return {
    message: ttl.message || MIN_TTL,
    error: ttl.error || MIN_TTL,
    media: ttl.media || MIN_TTL,
    card: ttl.card || 120000
  };
}

function normalizeTtl(value, fallback = "message") {
  const config = ttlConfig();
  const base = config[fallback] || MIN_TTL;
  if (!Number.isFinite(Number(value)) || Number(value) <= 0) return base;
  return Math.max(Number(value), MIN_TTL);
}

class Reply {
  constructor(api, threadId, type, commandName, event = null) {
    this.api = api;
    this.threadId = threadId;
    this.type = type;
    this.commandName = commandName || "bot";
    this.event = event;
  }

  async text(msg, options = {}) {
    const ttl = normalizeTtl(options.ttl, "message");
    if (options.plain) {
      return this.api.sendMessage({ msg, ttl }, this.threadId, this.type);
    }
    return this._sendCard(null, ttl, { ...options, title: options.title || this.commandName.toUpperCase(), rows: options.rows || [{ lines: String(msg).split("\n").filter((l) => l.trim() !== "") }] });
  }

  async error(msg, options = {}) {
    return this._sendCard(null, normalizeTtl(options.ttl, "error"), {
      ...options,
      theme: "error",
      title: options.title || "Đã xảy ra lỗi",
      subtitle: options.subtitle || msg,
      rows: options.rows
    });
  }

  async success(msg, options = {}) {
    return this._sendCard(null, normalizeTtl(options.ttl, "message"), {
      ...options,
      theme: "success",
      title: options.title || "Hoàn thành",
      subtitle: options.subtitle || msg,
      rows: options.rows
    });
  }

  async card(spec = {}) {
    const ttl = normalizeTtl(spec.ttl, "card");
    return this._sendCard(spec, ttl, spec);
  }

  async media({ msg, attachments, ttl }) {
    return this.api.sendMessage({ msg, attachments, ttl: normalizeTtl(ttl, "media") }, this.threadId, this.type);
  }

  async voice({ voiceUrl, msg, ttl }) {
    if (msg) await this.text(msg, { plain: true });
    return this.api.sendVoice({ voiceUrl, ttl: normalizeTtl(ttl, "media") }, this.threadId, this.type);
  }

  async video({ videoUrl, thumbnailUrl, msg, duration, width, height, ttl }) {
    return this.api.sendVideo({
      videoUrl,
      thumbnailUrl,
      duration,
      width,
      height,
      msg,
      ttl: normalizeTtl(ttl, "media")
    }, this.threadId, this.type);
  }

  // ===== Reaction trạng thái: 🙏 (đang xử lý) → ✅ (xong) / 😢 (lỗi) =====
  async react(reaction) {
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
    } catch {
      filePath = null;
    }

    if (!filePath) {
      // fallback: renderer cơ bản
      try {
        const basicSpec = spec || {
          theme: options.theme,
          title: options.title,
          subtitle: options.subtitle || options.msg,
          sections: (options.rows || []).map((row) => ({ title: row.label, lines: row.lines }))
        };
        filePath = canvasLib.renderCardToFile(basicSpec);
      } catch {
        filePath = null;
      }
    }

    if (!filePath) {
      const plainMsg = options.subtitle || options.title || "";
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

    // Gửi TEXT + chuẩn hoá TTL. Muốn thẻ ảnh đẹp thì dùng reply.card() tường minh
    // (menu, nhạc, gpt, stats...) — tránh biến mọi thông báo trạng thái thành ảnh.
    if (content.plain) delete content.plain;
    content.ttl = normalizeTtl(content.ttl, content.attachments ? "media" : "message");
    return api.sendMessage(content, targetThreadId, targetType);
  });

  defineWrapped(wrapped, "sendVoice", async (payload, tid, ty) => {
    const content = typeof payload === "string" ? { voiceUrl: payload } : { ...payload };
    content.ttl = normalizeTtl(content.ttl, "media");
    return api.sendVoice(content, threadId || tid, type || ty);
  });

  defineWrapped(wrapped, "sendVideo", async (payload, tid, ty) => {
    const content = { ...payload };
    content.ttl = normalizeTtl(content.ttl, "media");
    return api.sendVideo(content, threadId || tid, type || ty);
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

module.exports = { Reply, wrapApi, normalizeTtl, ttlConfig, MIN_TTL };
