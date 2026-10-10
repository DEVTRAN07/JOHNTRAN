const { ThreadType, GroupEventType } = require("zalo-client");
const path = require("path");
const fs = require("fs").promises;
const axios = require("axios");

module.exports.config = {
    name: "threadUpdateNoti",
    event_type: ["group_event", "message"],
    version: "1.1.1",
    author: "NLam182",
    description: "Thông báo chi tiết tất cả hoạt động cập nhật trong nhóm"
};

const recentTopicActions = new Map();

async function getUserName(api, userId) {
    if (!userId) return "Một ai đó";
    try {
        const userInfo = await api.getUserInfo(userId);
        return userInfo.changed_profiles[userId]?.displayName || "Người dùng";
    } catch {
        return "Người dùng";
    }
}

module.exports.run = async function({ api, event }) {
    const { threadId, data, type: eventTypeNumber } = event;
    if (eventTypeNumber == 0) return;
    const actorId = data.sourceId || data.actorId || data.creatorId;
    const botId = api.getOwnId();

    if (!api._threadCache) api._threadCache = {};
    const threadCache = api._threadCache[threadId] || {};
    const oldInfo = threadCache.groupInfo || {};

    if (actorId === botId || event.isSelf) return;

    let msg = "";
    let attachments = [];
    const tempFilePaths = [];
    const tempPath = path.join(__dirname, 'temp');

    try {
        await fs.mkdir(tempPath, { recursive: true });
        const actorName = await getUserName(api, actorId);

        switch (eventTypeNumber) {
            case 21:
            case 6:
                if (data.fullAvt) {
                    msg = `🖼️ ${actorName} đã thay đổi ảnh đại diện của nhóm.`;
                    const tempFilePath = path.join(tempPath, `update_avt_${Date.now()}.jpg`);
                    const response = await axios.get(data.fullAvt, { responseType: 'arraybuffer' });
                    await fs.writeFile(tempFilePath, response.data);
                    attachments.push(tempFilePath);
                    tempFilePaths.push(tempFilePath);
                } else if (data.groupName) {
                    msg = `📝 ${actorName} đã đổi tên nhóm thành: "${data.groupName}"`;
                }
                break;
            case GroupEventType.JOIN_REQUEST: {
                const requester = await getUserName(api, data.uids?.[0]);
                msg = `📥 ${requester} đã yêu cầu tham gia nhóm.`;
                break;
            }
            case GroupEventType.JOIN: {
                if (Array.isArray(data.uids) && data.uids.length > 0) {
                    const joiner = await getUserName(api, data.uids[0]);
                    msg = `✅ ${joiner} đã tham gia nhóm.`;
                }
                break;
            }
            case GroupEventType.BLOCK_MEMBER: {
                const blocked = await getUserName(api, data.uids?.[0]);
                msg = `🚫 ${blocked} đã bị cấm khỏi nhóm bởi ${actorName}.`;
                break;
            }
            case GroupEventType.UPDATE_SETTING: {
                msg = `⚙️ ${actorName} đã cập nhật cài đặt nhóm.`;
                break;
            }
            case GroupEventType.UPDATE: {
                if (data.fullAvt) {
                    msg = `🖼️ ${actorName} đã thay đổi ảnh đại diện của nhóm.`;
                    const tempFilePath = path.join(tempPath, `update_avt_${Date.now()}.jpg`);
                    const response = await axios.get(data.fullAvt, { responseType: 'arraybuffer' });
                    await fs.writeFile(tempFilePath, response.data);
                    attachments.push(tempFilePath);
                    tempFilePaths.push(tempFilePath);
                } else if (data.groupName) {
                    msg = `📝 ${actorName} đã đổi tên nhóm thành: "${data.groupName}"`;
                } else {
                    msg = `🔄 ${actorName} đã cập nhật thông tin nhóm.`;
                }
                break;
            }
            case GroupEventType.NEW_LINK: {
                const newLink = data.info?.group_link;
                const expiredTime = data.info?.link_expired_time
                    ? new Date(Number(data.info.link_expired_time)).toLocaleString("vi-VN")
                    : "Không rõ";
                const oldLink = oldInfo?.group_link;
                msg = `🔗 ${actorName} đã tạo một liên kết mời mới cho nhóm:\n` +
                    `• Liên kết: ${newLink}\n` +
                    (oldLink && oldLink !== newLink ? `• (Trước đó: ${oldLink})\n` : "") +
                    `• Hết hạn: ${expiredTime}`;
                threadCache.groupInfo = {
                    ...(threadCache.groupInfo || {}),
                    group_link: newLink,
                    link_expired_time: data.info?.link_expired_time
                };
                api._threadCache[threadId] = threadCache;
                break;
            }
            case GroupEventType.ADD_ADMIN: {
                const newAdminNames = (data.updateMembers || []).map(m => m.dName).join(", ");
                msg = `👑 ${actorName} đã bổ nhiệm ${newAdminNames} làm phó nhóm.`;
                break;
            }
            case GroupEventType.REMOVE_ADMIN: {
                const removedNames = (data.updateMembers || []).map(m => m.dName).join(", ");
                if (removedNames) {
                    msg = `👥 ${actorName} đã gỡ quyền phó nhóm của ${removedNames}.`;
                }
                break;
            }
            case GroupEventType.NEW_PIN_TOPIC: {
                const topic = data.groupTopic || data.topic;
                if (!topic?.id || !topic.params) break;
                const params = JSON.parse(topic.params);
                const senderName = params.senderName || "Một ai đó";
                const title = params.title || "một tin nhắn";
                const thumb = params.thumb;
                msg = `📌 ${actorName} đã ghim chủ tin nhắn của ${senderName} với nội dung: "${title}"`;
                if (thumb) {
                    try {
                        const filePath = path.join(tempPath, `pinned_thumb_${Date.now()}.jpg`);
                        const imageResp = await axios.get(thumb, { responseType: "arraybuffer" });
                        await fs.writeFile(filePath, imageResp.data);
                        attachments.push(filePath);
                        tempFilePaths.push(filePath);
                    } catch (err) {
                        console.error("[groupUpdateNoti] Không thể tải ảnh ghim:", err);
                    }
                }
                break;
            }
            case GroupEventType.UNPIN_TOPIC: {
                const topic = data.groupTopic || data.topic;
                if (!topic?.id || !topic.params) break;
                const params = JSON.parse(topic.params);
                const senderName = params.senderName || "Một ai đó";
                const title = params.title || "một tin nhắn";
                const thumb = params.thumb;
                msg = `📌 ${actorName} đã bỏ ghim tin nhắn của ${senderName} với nội dung: "${title}"`;
                if (thumb) {
                    try {
                        const filePath = path.join(tempPath, `pinned_thumb_${Date.now()}.jpg`);
                        const imageResp = await axios.get(thumb, { responseType: "arraybuffer" });
                        await fs.writeFile(filePath, imageResp.data);
                        attachments.push(filePath);
                        tempFilePaths.push(filePath);
                    } catch (err) {
                        console.error("[groupUpdateNoti] Không thể tải ảnh ghim:", err);
                    }
                }
                break;
            }
            // các event này chưa phân type nên bị trùng với event ghim tin nhắn
            /*case GroupEventType.REORDER_PIN_TOPIC: {
                 msg = `📌 ${actorName} đã sắp xếp lại các chủ đề đã ghim.`;
                 break;
             }
             case GroupEventType.UPDATE_BOARD: {
                 let title = "";
                 if (data.groupTopic?.params) {
                     try {
                         const params = JSON.parse(data.groupTopic.params);
                        title = params.title ? ` (chủ đề: ${params.title})` : "";
                     } catch {}
                 }
                 msg = `📋 ${actorName} đã cập nhật bảng nhóm${title}.`;
                 break;
             }
             case GroupEventType.REMOVE_BOARD: {
                 let title = "";
                 if (data.groupTopic?.params) {
                     try {
                         const params = JSON.parse(data.groupTopic.params);
                         title = params.title ? ` (chủ đề: ${params.title})` : "";
                     } catch {}
                 }
                 msg = `🗑️ ${actorName} đã xóa bảng nhóm${title}.`;
                 break;
             }
             case GroupEventType.UPDATE_TOPIC: {
                 msg = `📝 ${actorName} đã cập nhật chủ đề nhóm.`;
                 break;
             }
             case GroupEventType.UNPIN_TOPIC: {
                 msg = `📌 ${actorName} đã bỏ ghim chủ đề nhóm.`;
                 break;
             }
             case GroupEventType.REMOVE_TOPIC: {
                 msg = `❎ ${actorName} đã xóa chủ đề nhóm.`;
                 break;
             }*/
            case GroupEventType.ACCEPT_REMIND: {
                let targetName = actorName;
                let remindTitle = "";
                //Lấy tên từ updateMembers/uids như cũ
                if (Array.isArray(data.updateMembers) && data.updateMembers.length > 0) {
                    targetName = await getUserName(api, data.updateMembers[0]);
                } else if (data.uids && Array.isArray(data.uids) && data.uids.length > 0) {
                    targetName = await getUserName(api, data.uids[0]);
                }
                //Lấy title trực tiếp từ data.content.title nếu có
                if (data.content?.title) {
                    remindTitle = ` (${data.content.title})`;
                }
                msg = `⏰ ${targetName} đã chấp nhận nhắc nhở${remindTitle}.`;
                break;
            }
            case GroupEventType.REJECT_REMIND: {
                let targetName = actorName;
                let remindTitle = "";
                if (Array.isArray(data.updateMembers) && data.updateMembers.length > 0) {
                    targetName = await getUserName(api, data.updateMembers[0]);
                } else if (data.uids && Array.isArray(data.uids) && data.uids.length > 0) {
                    targetName = await getUserName(api, data.uids[0]);
                }
                if (data.content?.title) {
                    remindTitle = ` (${data.content.title})`;
                }
                msg = `⏰ ${targetName} đã từ chối nhắc nhở${remindTitle}.`;
                break;
            }
            case GroupEventType.REMIND_TOPIC: {
                msg = `🔔 ${actorName} đã nhắc nhở về chủ đề nhóm.`;
                break;
            }
            case GroupEventType.UNKNOWN: {
                msg = `❓ Có một sự kiện chưa được xử lý vừa xảy ra trong nhóm.`;
                break;
            }
        }

        if (msg?.trim()) {
            await api.sendMessage({ msg, attachments, ttl: 60000 }, threadId, ThreadType.Group);
        }

    } catch (err) {
        console.error(`[groupUpdateNoti] Lỗi xử lý:`, err);
    } finally {
        for (const file of tempFilePaths) {
            try { await fs.unlink(file); } catch (e) {
                console.error(`Không thể xóa file tạm ${file}:`, e);
            }
        }
    }
};
