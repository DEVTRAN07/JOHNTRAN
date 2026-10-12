const fs = require("fs");
const logger = require("../../utils/logger");
const menuCard = require("../../core/canvas/menu");

const PAGE_SIZE = 9; // khớp canvas 3 cột x 3 hàng
const NAV_WORDS = ["next", "prev", "previous", "back", "out", "exit", "close"];

module.exports.config = {
    name: "menu",
    aliases: ["help"],
    version: "3.1.0",
    role: 0,
    author: "ᴶᴼᴴᴺ ᵀᴿᴬᴺ",
    description: "Xem danh sách lệnh và info",
    category: "Tiện ích",
    usage: "[tên lệnh/all/next/prev/out] [text/canvas]",
    cooldowns: 1,
    dependencies: {
        "string-similarity": "",
        "moment-timezone": ""
    }
};

function getUptimeText() {
    const uptime = process.uptime();
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    return hours > 0 ? `${hours}h${minutes}m` : `${minutes}m`;
}

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

// ===== Điều hướng phân trang: "next"/"prev"/"out"/số — GHÉP CHUNG cho cả lệnh lẫn handleEvent =====
async function navigate({ api, event, Threads, action, senderId }) {
    const { threadId, type } = event;
    const prefix = global.config.prefix;
    const commands = collectCommands(senderId);
    const totalPages = Math.max(1, Math.ceil(commands.length / PAGE_SIZE));

    const threadData = (await Threads.getData(threadId)).data || {};

    // Đóng menu: thu hồi trang đang hiện + xoá trạng thái phân trang
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

    return renderPage({ api, event, Threads, commands, page, totalPages, threadData, senderId });
}

async function renderPage({ api, event, Threads, commands, page, totalPages, threadData, senderId }) {
    const { threadId, type, data } = event;
    const prefix = global.config.prefix;

    if (threadData.menu_mode === "text") {
        return showTextMenu(commands, page, totalPages, prefix, api, threadId, type);
    }

    const slice = commands.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    let gridPath = null;
    try {
        gridPath = await menuCard.renderMenuGrid({
            botName: global.config.name_bot,
            avatarUrl: data.avatar,
            prefix,
            page,
            totalPages,
            commands: { total: commands.length, page: slice },
            uptimeText: getUptimeText()
        });
        await api.sendMessage({ msg: "", attachments: gridPath }, threadId, type);
    } catch (error) {
        console.error("Lỗi render menu:", error.message);
        await showTextMenu(commands, page, totalPages, prefix, api, threadId, type);
    } finally {
        if (gridPath && fs.existsSync(gridPath)) {
            try { fs.unlinkSync(gridPath); } catch { /* bỏ qua */ }
        }
    }
}

// ===== Gõ "next"/"prev"/"out" KHÔNG CẦN PREFIX (nút trên ảnh chỉ là hình vẽ) =====
// Chỉ chạy khi menu đã mở (nhóm có menu_page) để khỏi phản hồi linh tinh trong hội thoại.
module.exports.handleEvent = async function ({ api, event, Threads, isSelf }) {
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

    // Chế độ text cho nhóm này
    if (argType === "text") {
        const thread = (await Threads.getData(threadId)).data || {};
        thread.menu_mode = "text";
        await Threads.setData(threadId, thread);
        return reply.success("Đã chuyển menu sang chế độ text.");
    }

    if (argType === "canvas") {
        const thread = (await Threads.getData(threadId)).data || {};
        thread.menu_mode = "canvas";
        await Threads.setData(threadId, thread);
        return reply.success("Đã chuyển menu sang chế độ canvas.");
    }

    // Điều hướng: next / prev / out / số trang
    if (NAV_WORDS.includes(argType) || /^\d{1,2}$/.test(argType)) {
        return navigate({ api, event, Threads, action: argType, senderId });
    }

    // Xem chi tiết 1 lệnh
    if (argType === "all" || (argType && !NAV_WORDS.includes(argType) && !/^\d{1,2}$/.test(argType))) {
        return showCommandInfo(argType, senderId, prefix, api, threadId, type);
    }

    // Không tham số → mở trang 1
    const commands = collectCommands(senderId);
    const totalPages = Math.max(1, Math.ceil(commands.length / PAGE_SIZE));
    const threadData = (await Threads.getData(threadId)).data || {};
    threadData.menu_page = 1;
    await Threads.setData(threadId, threadData);

    return renderPage({ api, event, Threads, commands, page: 1, totalPages, threadData, senderId });
};

function showTextMenu(commands, page, totalPages, prefix, api, threadId, type) {
    const slice = commands.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    const byCategory = {};
    for (const cmd of slice) {
        if (!byCategory[cmd.category]) byCategory[cmd.category] = [];
        byCategory[cmd.category].push(cmd.name);
    }
    const sections = Object.entries(byCategory)
        .map(([cat, names]) => `【 ${cat.toUpperCase()} 】\n${names.map((n) => `${prefix}${n}`).join(" • ")}`)
        .join("\n\n");
    return api.sendMessage({
        msg: `╭─「 ${global.config.name_bot} 」\n│ 🔖 Trang ${page}/${totalPages} • ${commands.length} lệnh\n${sections}\n╰── ${prefix}menu <trang|next|prev|out>`
    }, threadId, type);
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
