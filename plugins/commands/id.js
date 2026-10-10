module.exports.config = {
    name: "id",
    version: "2.0.0",
    role: 0,
    author: "ᴶᴼᴴᴺ ᵀᴿᴬᴺ",
    description: "Lấy userId của người dùng, hoặc ID của nhóm chat.",
    category: "Tiện ích",
    usage: "id | id [số điện thoại] | id box | id @user (có thể tag nhiều)",
    cooldowns: 2,
    dependencies: {}
};

const { ThreadType } = require("zalo-client");

module.exports.run = async ({ args, event, api, reply }) => {
    const { threadId, type, data } = event;

    if (args[0]?.toLowerCase() === "box") {
        if (type === ThreadType.Group) {
            try {
                const groupInfo = await api.getGroupInfo(threadId);
                const details = groupInfo.gridInfoMap?.[threadId];
                const groupName = details?.name || "Không rõ tên nhóm";
                return reply.card({
                    theme: "brand",
                    title: "Thông tin nhóm",
                    subtitle: groupName,
                    sections: [{ title: "Chi tiết", lines: [`ID nhóm: ${threadId}`] }]
                });
            } catch (err) {
                console.error("Lỗi khi lấy thông tin nhóm:", err);
                return reply.error("Không thể lấy thông tin nhóm hiện tại.");
            }
        } else {
            return reply.error("Lệnh này chỉ sử dụng trong nhóm.");
        }
    }

    const mentions = data.mentions;
    if (mentions && mentions.length > 0) {
        const nameList = await Promise.all(mentions.map(async m => {
            const uid = m.uid;
            try {
                const info = await api.getUserInfo(uid);
                const name = info?.changed_profiles?.[uid]?.displayName || "Không rõ tên";
                return `👤 ${name} — ${uid}`;
            } catch {
                return `👤 (Không lấy được tên) — ${uid}`;
            }
        }));
        return reply.card({
            theme: "brand",
            title: "Danh sách ID",
            subtitle: "Người dùng được tag",
            sections: [{ title: "Thành viên", lines: nameList }]
        });
    }

    if (args.length === 0) {
        try {
            const senderId = data.uidFrom;
            const info = await api.getUserInfo(senderId);
            const name = info?.changed_profiles?.[senderId]?.displayName || "Không rõ tên";
            return reply.card({
                theme: "brand",
                title: name,
                subtitle: "Thông tin tài khoản của bạn",
                sections: [{ title: "Chi tiết", lines: [`ID: ${senderId}`] }]
            });
        } catch (error) {
            console.error("Lỗi khi lấy ID người gửi:", error);
            return reply.error("Đã xảy ra lỗi khi lấy ID của bạn.");
        }
    }

    const phoneNumber = args[0];
    try {
        const userInfo = await api.findUser(phoneNumber);
        if (userInfo?.uid) {
            const targetId = userInfo.uid;
            await reply.card({
                theme: "success",
                title: "Đã tìm thấy người dùng",
                subtitle: `SĐT: ${phoneNumber}`,
                sections: [{ title: "Chi tiết", lines: [`ID: ${targetId}`] }]
            });
            return api.sendCard({
                userId: targetId,
                phoneNumber
            }, threadId, type);
        } else {
            return reply.error(`Không tìm thấy người dùng với số điện thoại "${phoneNumber}".`);
        }
    } catch (err) {
        console.error(`Lỗi khi tìm SĐT ${phoneNumber}:`, err);
        return reply.error("Có lỗi xảy ra khi tìm kiếm số điện thoại.");
    }
};
