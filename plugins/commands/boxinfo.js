const { ThreadType } = require("zalo-client");
const axios = require("axios");
const fs = require("fs").promises;
const path = require("path");

module.exports.config = {
    name: "boxinfo",
  aliases: ["info","box"],

    version: "1.0.0",
    role: 0,
    author: "NLam182",
    description: "Hiển thị thông tin chi tiết của nhóm chat",
    category: "Tiện ích",
    usage: "<prefix>info",
    cooldowns: 2
};

module.exports.run = async function({ api, event }) {
    const { threadId, type } = event;

    if (type !== ThreadType.Group) {
        return api.sendMessage("Lệnh này chỉ có thể được sử dụng trong nhóm chat.", threadId, type);
    }

    const tempPath = path.join(__dirname, 'temp');
    try {
        await fs.mkdir(tempPath, { recursive: true });
    } catch (e) {
        console.error("Không thể tạo thư mục temp:", e);
    }

    let tempFilePath;

    try {
        const groupInfo = await api.getGroupInfo(threadId);
        const details = groupInfo.gridInfoMap[threadId];

        if (!details) {
            return api.sendMessage("Không thể lấy được thông tin của nhóm này.", threadId, type);
        }
        //console.log(JSON.stringify(details, null, 2));
        const creatorId = details.creatorId;
        const deputyIds = (details.adminIds || []).filter(id => id !== creatorId);

        const creatorInfo = await api.getUserInfo(creatorId);
        const creatorName = creatorInfo.changed_profiles[creatorId]?.displayName || "Không rõ";

        let deputyNames = "Không có";
        if (deputyIds.length > 0) {
            const deputyInfoPromises = deputyIds.map(id => api.getUserInfo(id));
            const deputyInfos = await Promise.all(deputyInfoPromises);
            deputyNames = deputyInfos.map((info, index) => {
                const profile = info.changed_profiles[deputyIds[index]];
                return profile?.displayName || "Không rõ";
            }).join(", ");
        }

        const msg = `📝 **Thông Tin Nhóm** 📝\n\n` +
                    `- Tên nhóm: ${details.name}\n` +
                    `- ID Nhóm: ${details.groupId}\n` +
                    `- Số lượng thành viên: ${details.totalMember}\n` +
                    `- Trưởng nhóm: ${creatorName}\n` +
                    `- Phó nhóm: ${deputyNames}`;

        const avtUrl = details.fullAvt;
        if (avtUrl) {
            try {
                const response = await axios.get(avtUrl, { responseType: 'arraybuffer' });
                tempFilePath = path.join(tempPath, `group_avatar_${Date.now()}.jpg`);
                await fs.writeFile(tempFilePath, response.data);
                await api.sendMessage({ msg, attachments: [tempFilePath] }, threadId, type);
            } catch (err) {
                console.warn("Không thể tải avatar nhóm:", err);
                await api.sendMessage(msg, threadId, type);
            }
        } else {
            await api.sendMessage(msg, threadId, type);
        }

    } catch (error) {
        console.error("Lỗi khi lấy thông tin nhóm:", error);
        await api.sendMessage("Đã xảy ra lỗi khi cố gắng lấy thông tin nhóm.", threadId, type);
    } finally {
        if (tempFilePath) {
            try {
                await fs.unlink(tempFilePath);
            } catch (_) {}
        }
    }
};
