const moment = require("moment-timezone");
const stringSimilarity = require('string-similarity');

module.exports.config = {
    name: "menu",
    aliases: ['help'],
    version: "2.0.0",
    role: 0,
    author: "ᴶᴼᴴᴺ ᵀᴿᴬᴺ",
    description: "Xem danh sách lệnh và info",
    category: "Tiện ích",
    usage: "[tên lệnh/all]",
    cooldowns: 2,
    dependencies: {
        "string-similarity": "",
        "moment-timezone": ""
    }
};

function getDayVN() {
    const days = {
        'Sunday': 'Chủ Nhật',
        'Monday': 'Thứ Hai',
        'Tuesday': 'Thứ Ba',
        'Wednesday': 'Thứ Tư',
        'Thursday': 'Thứ Năm',
        'Friday': 'Thứ Sáu',
        'Saturday': 'Thứ Bảy'
    };
    const thu = moment.tz('Asia/Ho_Chi_Minh').format('dddd');
    return days[thu] || thu;
}

function TextPr(permission) {
    return permission == 0 ? "Thành Viên" : permission == 1 ? "Support Bot" : permission == 2 ? "Admin Bot" : "Toàn Quyền";
}

function sortByLengthDesc(arr, key) {
    return arr.sort((a, b) => b[key].length - a[key].length);
}

module.exports.run = async function({ api, event, args, Threads, reply }) {
    const { threadId, type, data } = event;
    const senderId = data.uidFrom;
    const cmds = global.client.commands;
    const TIDdata = (global.data && global.data.threadData && global.data.threadData.get)
        ? global.data.threadData.get(threadId) || {}
        : {};
    const config = global.config;
    const admin = Array.isArray(config.admin_bot) ? config.admin_bot : [];
    const NameBot = config.name_bot;
    const currentPrefix = (typeof TIDdata.PREFIX === "string" && TIDdata.PREFIX.length > 0)
        ? TIDdata.PREFIX
        : config.prefix;
    const argType = args[0] ? args[0].toLowerCase() : "";
    const isPageNumber = /^\d{1,2}$/.test(argType);

    // Xem tất cả lệnh
    if (argType === "all") {
        const lines = Array.from(cmds.values()).map((cmd, idx) =>
            `${String(idx + 1).padStart(2, " ")}. ${cmd.config.name} — ${cmd.config.description}`
        );
        return reply.card({
            theme: "brand",
            title: "Tất cả lệnh",
            subtitle: `Tổng ${cmds.size} lệnh`,
            sections: [{ title: "Danh sách", lines }],
            footer: `${NameBot} • ${currentPrefix}help + tên lệnh để xem chi tiết`
        });
    }

    // Show specific command info or fuzzy search
    if (argType) {
        let command = Array.from(cmds.values()).find(cmd => cmd.config.name.toLowerCase() === argType);
        if (!command) {
            const commandNames = Array.from(cmds.keys());
            const checker = stringSimilarity.findBestMatch(argType, commandNames);
            if (checker.bestMatch.rating >= 0.5) {
                command = cmds.get(checker.bestMatch.target);
                return reply.card({
                    theme: "warn",
                    title: `Lệnh gần giống: ${checker.bestMatch.target}`,
                    subtitle: `Không tìm thấy lệnh '${argType}'. Có phải bạn muốn dùng lệnh này?`,
                    sections: [{ title: "Thông tin", lines: [
                        `Tên: ${command.config.name}`,
                        `Phiên bản: ${command.config.version || "1.0.0"}`,
                        `Quyền: ${TextPr(command.config.role)}`,
                        `Mô tả: ${command.config.description}`,
                        `Cách dùng: ${currentPrefix}${command.config.usage}`
                    ]}]
                });
            }
            return reply.error(`Không tìm thấy lệnh '${argType}' trong hệ thống.`);
        }
        const cmd = command.config;
        return reply.card({
            theme: "brand",
            title: cmd.name,
            subtitle: cmd.description,
            sections: [{ title: "Chi tiết lệnh", lines: [
                `Tên lệnh: ${cmd.name}`,
                `Phiên bản: ${cmd.version || "1.0.0"}`,
                `Quyền hạn: ${TextPr(cmd.role)}`,
                `Tác giả: ${cmd.author}`,
                `Nhóm: ${cmd.category}`,
                `Cách dùng: ${currentPrefix}${cmd.usage}`,
                `Cooldowns: ${cmd.cooldowns || 0}s`
            ]}],
            footer: NameBot
        });
    }

  // Nhóm lệnh theo category (các nhánh trên đã return hết nếu có arg đặc biệt)
  const commandsArray = Array.from(cmds.values()).map(cmd => cmd.config);
    const grouped = [];
    commandsArray.forEach(cmd => {
        const { category, name } = cmd;
        let group = grouped.find(g => g.cmdCategory === category);
        if (!group) {
            grouped.push({ cmdCategory: category, nameModule: [name] });
        } else {
            group.nameModule.push(name);
        }
    });
    sortByLengthDesc(grouped, "nameModule");

    const sections = [];
    grouped.forEach(cmd => {
        if (
            cmd.cmdCategory &&
            ['NO PREFIX'].includes(cmd.cmdCategory.toUpperCase()) &&
            !admin.includes(senderId)
        ) return;
        sections.push({
            title: `${cmd.cmdCategory || "Khác"} • ${cmd.nameModule.length} lệnh`,
            lines: [cmd.nameModule.join(", ")]
        });
    });

  const threadData = await Threads.getData(threadId);
  const threadInfo = threadData?.data || {};
  const prefixNow = threadInfo.prefix ? threadInfo.prefix : config.prefix;

  // Phân trang: mỗi trang 5 nhóm lệnh
  const PER_PAGE = 5;
  const totalPages = Math.max(1, Math.ceil(sections.length / PER_PAGE));
  const page = Math.min(Math.max(parseInt(args[0], 10) || 1, 1), totalPages);
  const pageSections = sections.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  return reply.card({
    theme: "brand",
    title: "Menu lệnh",
    subtitle: `${NameBot} • trang ${page}/${totalPages}`,
    rows: pageSections.map((section) => ({
      icon: "list",
      label: section.title,
      lines: section.lines
    })),
    footer: `${moment.tz("Asia/Ho_Chi_Minh").format("HH:mm:ss | DD/MM/YYYY")} • ${getDayVN()}\nTổng ${cmds.size} lệnh • ${admin.length} admin • Prefix: ${prefixNow}\n${page < totalPages ? `${prefixNow}menu ${page + 1} — xem trang sau • ` : ""}${prefixNow}help + tên lệnh xem chi tiết • ${prefixNow}help + all xem tất cả`
  });
};
