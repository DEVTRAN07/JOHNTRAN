const { ThreadType, GroupEventType } = require("zalo-client");
const axios = require("axios");
const fs = require("fs").promises;
const path = require("path");

module.exports.config = {
    event_type: ["group_event"],
    name: "leaveNoti",
    version: "1.0.1",
    author: "NLam182",
    description: "Thông báo khi có thành viên rời hoặc bị xóa khỏi nhóm và xóa sau 15 giây"
};

module.exports.run = async function({ api, event }) {
    const { threadId, data, type } = event;

    if (![GroupEventType.LEAVE, GroupEventType.REMOVE_MEMBER].includes(type)) return;
    if (!data || !data.updateMembers || data.updateMembers.length === 0) return;

    const leftMembers = data.updateMembers;
    if (leftMembers.some(m => m.id === api.getOwnId())) return;

    const tempPath = path.join(__dirname, 'temp');
    try { await fs.mkdir(tempPath, { recursive: true }); } catch (_) {}
    const tempFilePaths = [];

    try {
        const groupInfo = await api.getGroupInfo(threadId);
        const groupName = groupInfo?.gridInfoMap?.[threadId]?.name || "nhóm";
        const totalMember = groupInfo?.gridInfoMap?.[threadId]?.totalMember || "không rõ";

        const namesWithUid = leftMembers.map(m => `${m.dName} (${m.id})`).join(", ");

        let msg;
        if (type === GroupEventType.LEAVE) {
            msg = `👋 Tạm biệt ${namesWithUid} đã rời khỏi ${groupName}.\n✨ Hiện tại nhóm còn lại ${totalMember} thành viên.`;
        } else if (type === GroupEventType.REMOVE_MEMBER) {
            const actorId = data.sourceId || data.actorId || data.creatorId;
            let actorName = "ai đó";
            try {
                const actorInfo = await api.getUserInfo(actorId);
                actorName = actorInfo.changed_profiles?.[actorId]?.displayName || "ai đó";
            } catch {}
            msg = `❌ ${namesWithUid} đã bị ${actorName} xóa khỏi ${groupName}.\n✨ Nhóm hiện còn ${totalMember} thành viên.`;
        }

        const avatarUrls = leftMembers.map(m => m.avatar).filter(url => url && !url.includes("default"));
        if (avatarUrls.length > 0) {
            const downloadPromises = avatarUrls.slice(0, 5).map(async (url, index) => {
                const tempFilePath = path.join(tempPath, `leave_avatar_${Date.now()}_${index}.jpg`);
                try {
                    const response = await axios.get(url, { responseType: 'arraybuffer' });
                    await fs.writeFile(tempFilePath, response.data);
                    tempFilePaths.push(tempFilePath);
                    return tempFilePath;
                } catch (err) {
                    console.error(`Không thể tải avatar từ ${url}:`, err.message);
                    return null;
                }
            });

            const resolvedAttachments = (await Promise.all(downloadPromises)).filter(Boolean);
            await api.sendMessage({ msg, attachments: resolvedAttachments, ttl: 60000 }, threadId, ThreadType.Group);
        } else {
            await api.sendMessage({msg, ttl: 60000 }, threadId, ThreadType.Group);
        }

    } catch (error) {
        console.error("Lỗi trong sự kiện rời nhóm:", error);
        const fallbackMsg = `👋 Tạm biệt ${leftMembers.map(m => `${m.dName} (${m.id})`).join(", ")} đã rời nhóm!`;
        await api.sendMessage(fallbackMsg, threadId, ThreadType.Group).catch(() => {});
    } finally {
        for (const filePath of tempFilePaths) {
            try { await fs.unlink(filePath); } catch (_) {}
        }
    }
};