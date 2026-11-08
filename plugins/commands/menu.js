const fs = require("fs");
const logger = require("../../utils/logger");
const { fetchProfile } = require("../../core/zaloProfile");
const botVersion = require("../../package.json").version;

const PAGE_SIZE = 12; // tối đa 3 cột x 4 hàng
const NAV_WORDS = ["next", "prev", "previous", "back", "out", "exit", "close"];

module.exports.config = {
    name: "menu",
    aliases: ["help"],
    version: "4.0.0",
    role: 0,
    author: "ᴶᴼᴴᴺ ᵀᴿᴬᴺ",
    description: "Xem danh sách lệnh và info",
    category: "Tiện ích",
    usage: "[tên lệnh/all/next/prev/out]",
    cooldowns: 1,
    dependencies: {
        "string-similarity": "",
        "moment-timezone": ""
    }
};

function collectCommands(userId) {
    const isAdmin = global.users?.admin?.includes(userId);
    const isSupport = global.users?.support?.includes(userId);
    return Array.from(global.client.commands.values())
        .filter((cmd) => {
            const role = cmd.config.role || 0;
            if (role === 2) return isAdmin;
            if (role === 1) return isAdmin || isSupport;
            return true;
        })
        .map((cmd) => ({
            name: cmd.config.name.toLowerCase(),
            usage: cmd.config.usage || cmd.config.name,
            category: cmd.config.category || "Khác"
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
}

function groupCommands(commands) {
    const categoryOrder = ["info", "public", "music", "game", "tools", "test", "anti", "manager", "admin", "mybot", "hidden"];
    const groups = new Map();
    for (const command of commands) {
        const category = command.category || "Khác";
        if (!groups.has(category)) groups.set(category, []);
        groups.get(category).push(command);
    }
    return Array.from(groups, ([name, groupedCommands]) => ({ name, commands: groupedCommands }))
        .sort((a, b) => {
            const orderA = categoryOrder.indexOf(a.name.toLowerCase());
            const orderB = categoryOrder.indexOf(b.name.toLowerCase());
            if (orderA !== -1 || orderB !== -1) {
                return (orderA === -1 ? categoryOrder.length : orderA) - (orderB === -1 ? categoryOrder.length : orderB);
            }
            return a.name.localeCompare(b.name);
        });
}

// ===== Điều hướng phân trang: "next"/"prev"/"out"/số — GHÉP CHUNG cho cả lệnh lẫn handleEvent =====
async function navigate({ api, event, Threads, action, senderId }) {
    const { threadId, type } = event;
    const prefix = global.config.prefix;
    const commands = collectCommands(senderId);
    const categories = groupCommands(commands);
    const totalPages = Math.max(1, Math.ceil(categories.length / PAGE_SIZE));

    const threadData = (await Threads.getData(threadId)).data || {};

    // Đóng menu: chỉ xoá trạng thái phân trang
    if (action === "out" || action === "exit" || action === "close") {
        delete threadData.menu_page;
        await Threads.setData(threadId, threadData);
        return api.sendMessage({
            msg: "✅ Đã đóng menu. Gõ /menu để mở lại.",
            }, threadId, type);
    }

    const current = Number(threadData.menu_page) || 1;
    let page = current;

    if (action === "next") {
        page = current >= totalPages ? 1 : current + 1;   // hết trang → về trang 1
    } else if (action === "prev" || action === "previous" || action === "back") {
        page = current <= 1 ? totalPages : current - 1;    // đầu danh sách → về trang cuối
    } else if (/^\d{1,2}$/.test(action)) {
        page = parseInt(action, 10);
    }

    page = Math.min(Math.max(page, 1), totalPages);
    threadData.menu_page = page;
    await Threads.setData(threadId, threadData);

    return renderPage({ api, event, Threads, commands, categories, page, totalPages, threadData, senderId });
}

async function renderPage({ api, event, Threads, commands, categories, page, totalPages, threadData, senderId }) {
    const { threadId, type } = event;
    const prefix = global.config.prefix;
    let requester = { name: String(senderId), avatar: "" };
    try {
        const { user } = await fetchProfile(api, senderId);
        if (user) {
            requester = {
                name: String(user.displayName || user.zaloName || senderId),
                avatar: String(user.avatar || "")
            };
        }
    } catch (error) {
        logger.log(`Không lấy được hồ sơ người dùng menu ${senderId}: ${error.message}`, "warn");
    }
    const mentionText = `@${requester.name}`;
    const mentions = [{ uid: String(senderId), pos: 0, len: mentionText.length }];

    // ===== MENU CHỈ CANVAS (ảnh) =====
    // Cache theo trang và nhóm lệnh để menu mở lại nhanh.
    const slice = categories.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    const cacheKey = JSON.stringify({
        requesterId: String(senderId),
        requesterName: requester.name,
        requesterAvatar: requester.avatar,
        botVersion,
        prefix,
        page,
        totalPages,
        minute: Math.floor(Date.now() / 60000),
        categories: slice.map((category) => `${category.name}:${category.commands.map((command) => command.name).join(",")}`)
    });

    let gridPath = menuCache.get(cacheKey);
    if (!gridPath || !fs.existsSync(gridPath)) {
        try {
            const menuCard = require("../../core/canvas/menu");
            gridPath = await menuCard.renderMenuGrid({
                requesterName: requester.name,
                requesterAvatarUrl: requester.avatar,
                botVersion,
                prefix,
                page,
                totalPages,
                categories: slice,
                totalCommands: commands.length
            });
            menuCache.set(cacheKey, gridPath);
        } catch (error) {
            console.error("Lỗi render menu:", error.message);
            // Báo lỗi ra chat để biết ngay (console.log trên Render khó xem)
            try {
                const stack = String(error.stack || "")
                    .split("\n")
                    .filter((l) => l.includes("core/canvas") || l.includes("menu"))
                    .slice(0, 3)
                    .join("\n");
                await api.sendMessage({
                    plain: true,
                    msg: `⚠️ Không render được ảnh menu: ${error.message}\n${stack}\n(Dạng text hiển thị tạm)`
                }, threadId, type);
            } catch { /* bỏ qua */ }
            return showTextMenu(categories, page, totalPages, prefix, commands.length, mentionText, mentions, api, threadId, type);
        }
    }

    // Ảnh cache: GỬI TRƯỚC rồi mới hẹn xoá (zalo-client cần file tồn tại lúc đọc)
    await api.sendMessage({ msg: mentionText, mentions, attachments: gridPath }, threadId, type);
    scheduleMenuCacheCleanup();
}

// ===== CACHE ẢNH MENU ĐÃ RENDER =====
// Render lại ảnh tốn ~1-2s trên Render free tier. Ảnh cùng nội dung giữ lại
// 10 phút — lật next/prev hoặc mở lại menu là gửi ngay từ đĩa.
const MENU_CACHE_TTL = 10 * 60 * 1000;
const MENU_CACHE_MAX = 20;
const menuCacheMap = new Map(); // key → { path, at }
let menuCleanupTimer = null;

const menuCache = {
    get: (key) => menuCacheMap.get(key)?.path,
    set: (key, path) => {
        if (menuCacheMap.size >= MENU_CACHE_MAX) {
            const oldest = [...menuCacheMap.entries()].sort((a, b) => a[1].at - b[1].at)[0];
            if (oldest) {
                try { if (fs.existsSync(oldest[1].path)) fs.unlinkSync(oldest[1].path); } catch { /* bỏ qua */ }
                menuCacheMap.delete(oldest[0]);
            }
        }
        menuCacheMap.set(key, { path, at: Date.now() });
    }
};

function scheduleMenuCacheCleanup() {
    if (menuCleanupTimer) return;
    menuCleanupTimer = setTimeout(() => {
        menuCleanupTimer = null;
        const now = Date.now();
        for (const [key, entry] of [...menuCacheMap.entries()]) {
            if (now - entry.at > MENU_CACHE_TTL) {
                try { if (fs.existsSync(entry.path)) fs.unlinkSync(entry.path); } catch { /* bỏ qua */ }
                menuCacheMap.delete(key);
            }
        }
    }, MENU_CACHE_TTL).unref?.();
}

// ===== Gõ "next"/"prev"/"out" KHÔNG CẦN PREFIX =====
// Điều hướng trần nay do core/listen.js xử lý TRỰC TIẾP (chắc chắn chạy hơn
// là đi qua handleEvent) nên handleEvent của menu đã tắt để khỏi trả lời 2 lần.
module.exports.handleEvent = async function () {
    // Điều hướng trần (next/prev/out) do core/listen.js xử lý TRỰC TIẾP —
    // bỏ qua ở đây để khỏi trả lời 2 lần cùng một tin.
    return;
};

// eslint-disable-next-line no-unused-vars
module.exports._unusedHandleEvent = async function ({ api, event, Threads, isSelf }) {
    const { threadId, type } = event;          // ← thiếu dòng này gây ReferenceError
    if (isSelf) return;
    if (type !== 1) return; // chỉ nhóm
    const content = String(event?.data?.content || "").trim().toLowerCase();
    if (!content) return;
    // Không phải dạng điều hướng (nhiều từ, dính link, tag...) → bỏ qua
    if (!NAV_WORDS.includes(content) && !/^\d{1,2}$/.test(content)) return;

    const threadData = (await Threads.getData(threadId)).data || {};

    // MENU ĐANG MỞ → menu được ưu tiên (vừa mở menu thì người dùng muốn lật trang)
    if (threadData.menu_page) {
        logger.log(`[menu] nhóm ${threadId} điều hướng "${content}" (người ${event.data.uidFrom})`, "info");
        return navigate({ api, event, Threads, action: content, senderId: event.data.uidFrom });
    }

    logger.log(`[menu] nhóm ${threadId} gõ "${content}" nhưng CHƯA mở menu (thiếu menu_page)`, "warn");

    // Menu chưa mở: nếu đang có kết quả NHẠC thì nhường cho nhạc (listen.js xử lý)
    try {
      const music = require("../../core/music");
      if (music.getPending && music.getPending(music.pickKey(threadId, event.data.uidFrom))) return;
    } catch { /* không nạy được music thì thôi */ }

    // Không có gì đang mở → nhắc 1 câu ngắn (không tự mở để khỏi nhiễu nhóm)
    return api.sendMessage({
        msg: `📋 Gõ ${global.config.prefix}menu trước đã, rồi gõ next / prev / out để điều hướng.`,
        }, threadId, type);
};

module.exports.run = async function ({ api, event, args, Threads, reply }) {
    const { threadId, type, data } = event;
    const senderId = data.uidFrom;
    const prefix = global.config.prefix;
    const argType = (args[0] || "").toLowerCase();

    // Điều hướng: next / prev / out / số trang
    if (NAV_WORDS.includes(argType) || /^\d{1,2}$/.test(argType)) {
        return navigate({ api, event, Threads, action: argType, senderId });
    }

    if (argType === "all") {
        return showAllCommands(senderId, prefix, api, threadId, type);
    }

    // Xem chi tiết 1 lệnh
    if (argType && !NAV_WORDS.includes(argType) && !/^\d{1,2}$/.test(argType)) {
        return showCommandInfo(argType, senderId, prefix, api, threadId, type);
    }

    // Không tham số → mở trang 1
    const commands = collectCommands(senderId);
    const categories = groupCommands(commands);
    const totalPages = Math.max(1, Math.ceil(categories.length / PAGE_SIZE));
    const threadData = (await Threads.getData(threadId)).data || {};
    threadData.menu_page = 1;
    await Threads.setData(threadId, threadData);

    return renderPage({ api, event, Threads, commands, categories, page: 1, totalPages, threadData, senderId });
};

function showTextMenu(categories, page, totalPages, prefix, totalCommands, mentionText, mentions, api, threadId, type) {
    const slice = categories.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    const sections = slice
        .map(({ name, commands }) => `【 ${name.toUpperCase()} 】\n${commands.map((cmd) => `${prefix}${cmd.name}`).join(" • ")}`)
        .join("\n\n");
    return api.sendMessage({
        msg: `${mentionText}\n╭─「 ${global.config.name_bot} 」\n│ 🔖 Trang ${page}/${totalPages} • ${totalCommands} lệnh\n${sections}\n╰── ${prefix}menu <trang|next|prev|out>`,
        mentions
    }, threadId, type);
}

function showAllCommands(senderId, prefix, api, threadId, type) {
    const categories = groupCommands(collectCommands(senderId));
    const sections = categories
        .map(({ name, commands }) => `【 ${name.toUpperCase()} 】\n${commands.map((command) => `${prefix}${command.name}`).join(" • ")}`)
        .join("\n\n");
    return api.sendMessage({ msg: `📋 Tất cả lệnh\n\n${sections}` }, threadId, type);
}

async function showCommandInfo(argType, senderId, prefix, api, threadId, type) {
    const stringSimilarity = require("string-similarity");
    const command = global.client.commands.get(argType);

    if (!command) {
        const checker = stringSimilarity.findBestMatch(argType, Array.from(global.client.commands.keys()));
        if (checker.bestMatch.rating < 0.5) {
            return api.sendMessage({ msg: `❌ Không tìm thấy lệnh '${argType}'`, }, threadId, type);
        }
        const match = global.client.commands.get(checker.bestMatch.target);
        return api.sendMessage({
            msg: `🔍 Có phải bạn muốn dùng lệnh '${checker.bestMatch.target}'?\n\n` + formatCommandInfo(match.config, prefix),
            }, threadId, type);
    }

    return api.sendMessage({
        msg: `╭─「 ${command.config.name.toUpperCase()} 」\n` + formatCommandInfo(command.config, prefix),
        }, threadId, type);
}

function formatCommandInfo(config, prefix) {
    const roleText = config.role === 2 ? "Admin Bot" : config.role === 1 ? "Support Bot" : "Thành viên";
    return [
        `│ 📛 Tên: ${config.name}`,
        `│ 📖 Mô tả: ${config.description}`,
        `│ 🏷️ Nhóm: ${config.category}`,
        `│ 👤 Quyền: ${roleText}`,
        `│ 💡 Cách dùng: ${prefix}${config.usage}`,
        `│ ⏱️ Cooldown: ${config.cooldowns || 0}s`,
        `╰──────────◆`
    ].join("\n");
}
