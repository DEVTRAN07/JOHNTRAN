const fs = require("fs");
const menuCard = require("../../core/canvas/menu");

const PAGE_SIZE = 9;

module.exports.config = {
    name: "menu",
    aliases: ["help", "menu2"],
    version: "3.0.0",
    role: 0,
    author: "ᴶᴼᴴᴺ ᵀᴿᴬᴺ",
    description: "Xem danh sách lệnh và info",
    category: "Tiện ích",
    usage: "[tên lệnh/all/next] [text/canvas]",
    cooldowns: 2,
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

    // Xem chi tiết 1 lệnh
    if (argType === "all" || (argType && !["next"].includes(argType) && !/^\d{1,2}$/.test(argType))) {
        return showCommandInfo(argType, senderId, prefix, api, threadId, type);
    }

    const commands = collectCommands(senderId);
    const totalPages = Math.max(1, Math.ceil(commands.length / PAGE_SIZE));
    let page = 1;
    if (argType === "next") page = 2;
    else if (/^\d{1,2}$/.test(argType)) page = parseInt(argType, 10);
    page = Math.min(Math.max(page, 1), totalPages);

    const threadData = (await Threads.getData(threadId)).data || {};
    if (threadData.menu_mode === "text") {
        return showTextMenu(commands, page, totalPages, prefix, api, threadId, type);
    }

    // Canvas menu
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
        await api.sendMessage({ msg: "", attachments: gridPath, ttl: 120000 }, threadId, type);
    } catch (error) {
        console.error("Lỗi render menu:", error.message);
        await showTextMenu(commands, page, totalPages, prefix, api, threadId, type);
    } finally {
        if (gridPath && fs.existsSync(gridPath)) {
            try { fs.unlinkSync(gridPath); } catch { /* bỏ qua */ }
        }
    }
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
        msg: `╭─「 ${global.config.name_bot} 」\n│ Trang ${page}/${totalPages} • ${commands.length} lệnh\n${sections}\n╰── ${prefix}menu <trang|next> để xem thêm`,
        ttl: 120000
    }, threadId, type);
}

async function showCommandInfo(argType, senderId, prefix, api, threadId, type) {
    const stringSimilarity = require("string-similarity");
    const command = global.client.commands.get(argType);

    if (!command) {
        const checker = stringSimilarity.findBestMatch(argType, Array.from(global.client.commands.keys()));
        if (checker.bestMatch.rating < 0.5) {
            return api.sendMessage({ msg: `❌ Không tìm thấy lệnh '${argType}'`, ttl: 30000 }, threadId, type);
        }
        const match = global.client.commands.get(checker.bestMatch.target);
        return api.sendMessage({
            msg: `🔍 Có phải bạn muốn dùng lệnh '${checker.bestMatch.target}'?\n\n` + formatCommandInfo(match.config, prefix),
            ttl: 60000
        }, threadId, type);
    }

    return api.sendMessage({
        msg: `╭─「 ${command.config.name.toUpperCase()} 」\n` + formatCommandInfo(command.config, prefix),
        ttl: 60000
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
