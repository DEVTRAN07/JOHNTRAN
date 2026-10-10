module.exports.config = {
    event_type: ["group_event"],
    name: "joinNoti",
    version: "2.0.0",
    author: "NLam182, ᴶᴼᴴᴺ ᵀᴿᴬᴺ",
    description: "Chào mừng thành viên mới vào nhóm bằng thẻ ảnh đẹp"
};

module.exports.run = async function({ api, event }) {
    const { ThreadType, GroupEventType } = require("zalo-client");
    const axios = require("axios");
    const fs = require("fs").promises;
    const path = require("path");
    const { renderVipCard } = require("../../core/canvas/vip");
    const tempPath = path.join(__dirname, 'temp');
    try { await fs.mkdir(tempPath, { recursive: true }); } catch (e) { console.error("Không thể tạo thư mục temp:", e); }

        if (event.type !== GroupEventType.JOIN) return;

        const { threadId, data } = event;
        if (!data || !data.updateMembers || data.updateMembers.length === 0) return;

        const authorId = data.sourceId;
        const newMembers = data.updateMembers;
        if (newMembers.map(m => m.id).includes(api.getOwnId())) return;

        const tempFilePaths = [];

        // ===== Thẻ ảnh chào mừng =====
        try {
            const groupInfo = await api.getGroupInfo(threadId);
            const details = groupInfo.gridInfoMap[threadId];
            const totalMember = details?.totalMember || newMembers.length;
            const groupName = details?.name || "nhóm này";

            // tải avatar thành viên mới làm ảnh trong thẻ
            let avatarPath = null;
            const firstAvatar = newMembers[0]?.avatar;
            if (firstAvatar) {
                try {
                    const res = await axios.get(firstAvatar, { responseType: "arraybuffer", timeout: 15000 });
                    avatarPath = path.join(tempPath, `welcome_${Date.now()}.jpg`);
                    await fs.writeFile(avatarPath, res.data);
                    tempFilePaths.push(avatarPath);
                } catch { /* bỏ qua */ }
            }

            const cardPath = await renderVipCard({
                theme: "success",
                chip: "WELCOME",
                title: newMembers.length > 1 ? `${newMembers.length} thành viên mới` : newMembers[0].dName,
                subtitle: `Đã tham gia ${groupName}`,
                avatar: avatarPath,
                rows: [
                    { icon: "user", label: "Thành viên", lines: newMembers.slice(0, 6).map((m) => `+ ${m.dName}`) },
                    { icon: "chart", label: "Nhóm", lines: [`Tổng thành viên: ${totalMember}`] }
                ],
                footer: `Thêm bởi: ${authorId} • ${global.config?.name_bot || ""}`
            });

            await api.sendMessage({
                msg: "",
                attachments: cardPath,
                ttl: 60000
            }, threadId, ThreadType.Group);
            try { await fs.unlink(cardPath); } catch { /* bỏ qua */ }
        } catch (error) {
            console.error("Lỗi render welcome card:", error.message);
        }

        try {
            const groupInfo = await api.getGroupInfo(threadId);
            const details = groupInfo.gridInfoMap[threadId];
            const totalMember = details?.totalMember || newMembers.length;

            const authorInfo = await api.getUserInfo(authorId);
            const groupName = details?.name || "nhóm này";
            const authorName = authorInfo.changed_profiles[authorId]?.displayName || "Link mời";
            const avatarUrls = newMembers.map(m => m.avatar).filter(Boolean);
            
            let memberLine;
            if (newMembers.length > 1) {
                const startNum = totalMember - newMembers.length + 1;
                const memberNumbers = Array.from({ length: newMembers.length }, (_, i) => startNum + i);
                memberLine = `✨ Các bạn là thành viên thứ ${memberNumbers.join(', ')} của nhóm (tổng ${totalMember} thành viên).`;
            } else {
                memberLine = `✨ Bạn là thành viên thứ ${totalMember} của nhóm (tổng ${totalMember} thành viên).`;
            }

            const mentions = [];
            const msgParts = [];
            let currentLength = 0;

            const part1 = "Chào mừng ";
            msgParts.push(part1);
            currentLength += part1.length;

            newMembers.forEach((member, index) => {
                const nameTag = `@${member.dName}`;
                mentions.push({ pos: currentLength, len: nameTag.length, uid: member.id });
                msgParts.push(nameTag);
                currentLength += nameTag.length;
                if (index < newMembers.length - 1) {
                    const separator = ", ";
                    msgParts.push(separator);
                    currentLength += separator.length;
                }
            });

            const part3 = ` đến với ${groupName}!\nChúc bạn một ngày vui vẻ.\n\n${memberLine}\n👤 Thêm bởi: `;
            msgParts.push(part3);
            currentLength += part3.length;

            const authorTag = `@${authorName}`;
            mentions.push({ pos: currentLength, len: authorTag.length, uid: authorId });
            msgParts.push(authorTag);

            const msg = msgParts.join("");
            const messagePayload = { msg, mentions, ttl: 60000 };

            if (avatarUrls.length > 0) {
                const downloadPromises = avatarUrls.slice(0, 5).map(async (url, index) => {
                    const tempFilePath = path.join(tempPath, `avatar_${Date.now()}_${index}.jpg`);
                    try {
                        const response = await axios.get(url, { responseType: 'arraybuffer' });
                        await fs.writeFile(tempFilePath, response.data);
                        tempFilePaths.push(tempFilePath);
                        return tempFilePath;
                    } catch (_) { return null; }
                });
                const resolvedAttachments = await Promise.all(downloadPromises);
                messagePayload.attachments = resolvedAttachments.filter(Boolean);
            }

            await api.sendMessage(messagePayload, threadId, ThreadType.Group);

        } catch (error) {
            console.error("Lỗi trong sự kiện chào mừng thành viên:", error);
            await api.sendMessage(`Chào mừng thành viên mới đã đến với nhóm!`, threadId, ThreadType.Group).catch(() => {});
        } finally {
            for (const filePath of tempFilePaths) {
                try { await fs.unlink(filePath); } catch (_) {}
            }
        }
};
