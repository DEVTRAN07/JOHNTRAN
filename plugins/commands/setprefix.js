module.exports.config = {
    name: "setprefix",
    aliases: ["prefix"],
    version: "2.0.0",
    role: 1,
    author: "ᴶᴼᴴᴺ ᵀᴿᴬᴺ",
    description: "Đặt lại prefix của nhóm",
    category: "Nhóm",
    usage: "[prefix/reset]",
    cooldowns: 2,
    dependencies: {}
};

module.exports.handleEvent = async function({ api, event, Threads, reply }) {
    const { threadId, type } = event;
    try {
        const { prefix } = global.config;
        var threadSetting = (await Threads.getData(event.threadId)).data || {};
        let prefixThread = threadSetting.prefix || prefix;
        const lowerBody = String(event.data.content || "").toLowerCase();

        if (
            lowerBody === "prefix" ||
            lowerBody === "prefix bot là gì" ||
            lowerBody === "quên prefix r" ||
            lowerBody === "dùng sao"
        ) {
            reply.card({
                theme: "brand",
                title: "Prefix của bot",
                subtitle: `Nhóm: ${prefixThread} • Hệ thống: ${prefix}`,
                footer: global.config.name_bot
            });
        }
    } catch (e) {
        // bỏ qua lỗi không quan trọng
    }
};

module.exports.run = async ({ api, event, args, Threads, reply }) => {
    if (typeof args[0] === "undefined") return reply.error("Vui lòng nhập prefix mới để thay đổi prefix của nhóm");
    const prefix = args[0].trim();
    if (!prefix) return reply.error("Vui lòng nhập prefix mới để thay đổi prefix của nhóm");
    if (prefix === "reset") {
        const data = (await Threads.getData(event.threadId)).data || {};
        data.prefix = global.config.prefix;
        await Threads.setData(event.threadId, data);
        return reply.success(`Đã reset prefix về mặc định: ${global.config.prefix}`);
    } else {
        const data = (await Threads.getData(String(event.threadId))).data || {};
        data.prefix = prefix;
        await Threads.setData(event.threadId, data);
        return reply.success(`Đã thay đổi prefix của nhóm thành: ${prefix}`);
    }
};
