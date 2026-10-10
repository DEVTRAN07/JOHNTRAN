const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { Reactions, ThreadType } = require("zalo-client");
const services = require("../../core/services");
const { processVideo, processAudio } = require("../../utils/index");

module.exports.config = {
    name: "autodown",
    version: "2.0.3",
    role: 2,
    author: "ShinTHL09, NLam182", // Phát triển từ Module gốc của pcoder, Kenne400k
    description: "Tự động tải media từ hơn 40 nền tảng phổ biến (Tiktok, Youtube, Facebook, Instagram, Capcut, Reddit, Twitter, Soundcloud, Spotify, Zingmp3, Telegram, Vimeo, Bilibili, Pinterest, v.v...)",
    category: "Tiện ích",
    usage: "autodown help",
    cooldowns: 5
};

module.exports.handleEvent = async function ({ api, event, Threads, isSelf }) {
    if (!event.data || !event.data.content) return;

    // Không tự tải link trong tin do chính bot gửi (tránh loop)
    if (isSelf) return;

    // Chỉ hoạt động trong nhóm — không chat riêng
    if (event.type !== ThreadType.Group) return;

    if ((event.data.msgType == "chat.recommended" && event.data.content.action == "recommened.link") || (event.data.msgType == "webchat" && String(event.data.content).match(/https?:\/\/[^\s]+/))) {
        var url = event.data.content.href || event.data.content;
    }

    const patterns = [
        /tiktok\.com/, /douyin\.com/, /capcut\.com/, /threads\.net/, /instagram\.com/, /facebook\.com/, /espn\.com/,
        /pinterest\.com/, /imdb\.com/, /imgur\.com/, /ifunny\.co/, /izlesene\.com/, /reddit\.com/, /youtube\.com/,
        /youtu\.be/, /twitter\.com/, /x\.com/, /vimeo\.com/, /snapchat\.com/, /bilibili\.com/, /dailymotion\.com/,
        /sharechat\.com/, /likee\.video/, /linkedin\.com/, /tumblr\.com/, /hipi\.co\.in/, /telegram\.org/,
        /getstickerpack\.com/, /bitchute\.com/, /febspot\.com/, /9gag\.com/, /ok\.ru/, /rumble\.com/, /streamable\.com/,
        /ted\.com/, /sohu\.com/, /xvideos\.com/, /xnxx\.com/, /xiaohongshu\.com/, /ixigua\.com/, /weibo\.com/,
        /miaopai\.com/, /meipai\.com/, /xiaoying\.tv/, /nationalvideo\.com/, /yingke\.com/, /sina\.com\.cn/,
        /vk\.com/, /vk\.ru/, /soundcloud\.com/, /mixcloud\.com/, /spotify\.com/, /zingmp3\.vn/, /bandcamp\.com/
    ];

    const matches = patterns.find(pattern => pattern.test(url));
    if (!matches) return;

    const { threadId, type } = event;

    // Chỉ nhóm đã bật autodown mới tự tải (mặc định tắt)
    const threadData = (await Threads.getData(threadId)).data || {};
    if (!threadData.auto_down) return;

    try {
        await api.addReaction(Reactions.LIKE, {
            data: { msgId: event.data.msgId, cliMsgId: event.data.cliMsgId },
            threadId,
            type
        });
    } catch {}

    let apiData;
    try {
        const baseUrl = services.requireService("media_downloader_url");
        const down = await axios.get(`${baseUrl}/media-downloader/atd2?url=${encodeURIComponent(url)}`, { timeout: 60000 });
        apiData = down.data;
    } catch (error) {
        if (error.notConfigured) {
            return api.sendMessage({ msg: `❌ ${error.message}`, ttl: 60000 }, threadId, type);
        }
        try {
            await api.addReaction(Reactions.NONE, {
                data: { msgId: event.data.msgId, cliMsgId: event.data.cliMsgId },
                    threadId,
                    type
            });
            await api.addReaction(Reactions.CRY, {
                data: { msgId: event.data.msgId, cliMsgId: event.data.cliMsgId },
                    threadId,
                    type
            });
        } catch {}
        return api.sendMessage({ msg: "❌ Lỗi khi tải xuống media", ttl: 60000 }, threadId, type);
    }

    if (!apiData || !Array.isArray(apiData.medias) || apiData.medias.length === 0) {
        try {
             await api.addReaction(Reactions.NONE, {
                data: { msgId: event.data.msgId, cliMsgId: event.data.cliMsgId },
                    threadId,
                    type
            });
            await api.addReaction(Reactions.WOW, {
                data: { msgId: event.data.msgId, cliMsgId: event.data.cliMsgId },
                    threadId,
                    type
            });
        } catch {}
        return api.sendMessage({ msg: "❓ Không tìm thấy media để tải xuống", ttl: 60000 }, threadId, type);
    }

    let videoToSend = null;
    let imagesToSend = [];
    let audioToSend = null;

    const videos = apiData.medias.filter(item => item.type === 'video');
    if (videos.length > 0) {
        videoToSend = videos.find(v => v.quality === 'hd_no_watermark') ||
                     videos.find(v => v.quality === 'no_watermark') ||
                     videos[0];
    }

    const images = apiData.medias.filter(item => item.type === 'image');
    if (images.length > 0) {
        imagesToSend = images.slice(0, 5);
    }

    const audios = apiData.medias.filter(item => item.type === 'audio');
    if (audios.length > 0) {
        audioToSend = audios[0];
    }

    let metaInfo = [];
    if (apiData.unique_id) metaInfo.push(`UID: ${apiData.unique_id}`);
    if (apiData.author) metaInfo.push(`Author: ${apiData.author}`);
    if (apiData.title) metaInfo.push(`Title: ${apiData.title}`);

    let messageBody = "🎦 AUTODOWN";
    if (metaInfo.length > 0) {
        messageBody += "\n" + metaInfo.join("\n");
    } else if (apiData.title) {
        messageBody += "\n" + apiData.title;
    }

    if (videoToSend) {
        try {
            const videoPath = await downloadMedia(videoToSend.url, 'video');
            const videoData = await processVideo(videoPath, threadId, type);
                
            await api.sendVideo({
                msg: messageBody,
                videoUrl: videoData.videoUrl,
                thumbnailUrl: videoData.thumbnailUrl,
                duration: videoData.metadata.duration,
                width: videoData.metadata.width,
                height: videoData.metadata.height,
                ttl: 300000
            }, threadId, type);

            try {
                await api.addReaction(Reactions.NONE, {
                    data: { msgId: event.data.msgId, cliMsgId: event.data.cliMsgId },
                        threadId,
                        type
                });
                await api.addReaction(Reactions.HEART, {
                    data: { msgId: event.data.msgId, cliMsgId: event.data.cliMsgId },
                        threadId,
                        type
                });
            } catch {}
            return;
        } catch (err) {
            console.error("Lỗi xử lý video:", err.message);
            try {
                await api.addReaction(Reactions.NONE, {
                    data: { msgId: event.data.msgId, cliMsgId: event.data.cliMsgId },
                        threadId,
                        type
                });
                await api.addReaction(Reactions.CRY, {
                    data: { msgId: event.data.msgId, cliMsgId: event.data.cliMsgId },
                        threadId,
                        type
                });
            } catch {}
        }
    }

    if (imagesToSend.length > 0) {
        try {
            let attachments = [];

            for (const image of imagesToSend) {
                const imagePath = await downloadMedia(image.url, 'image');
                attachments.push(imagePath);
            }

            await api.sendMessage({
                msg: `${messageBody}`,
                attachments,
                ttl: 300000
            }, threadId, type);

            if (audioToSend) {
                const VoicePath = await downloadMedia(audioToSend.url, 'audio');
                const voiceUrl = await processAudio(VoicePath, threadId, type);
                await api.sendVoice({ voiceUrl, ttl: 300000 }, threadId, type);
                audioToSend = null;
            }

            attachments.forEach(filePath => fs.unlinkSync(filePath));
            try {
                await api.addReaction(Reactions.NONE, {
                    data: { msgId: event.data.msgId, cliMsgId: event.data.cliMsgId },
                        threadId,
                        type
                });
                await api.addReaction(Reactions.HEART, {
                    data: { msgId: event.data.msgId, cliMsgId: event.data.cliMsgId },
                        threadId,
                        type
                });
                return;
            } catch {}
        } catch (err) {
            console.error("Lỗi xử lý hình ảnh:", err.message);
            try {
                await api.addReaction(Reactions.NONE, {
                    data: { msgId: event.data.msgId, cliMsgId: event.data.cliMsgId },
                        threadId,
                        type
                });
                await api.addReaction(Reactions.CRY, {
                    data: { msgId: event.data.msgId, cliMsgId: event.data.cliMsgId },
                        threadId,
                        type
                });
            } catch {}
            return;
        }
    }

    if (audioToSend) {
        try {
            const VoicePath = await downloadMedia(audioToSend.url, 'audio');
            const voiceUrl = await processAudio(VoicePath, threadId, type);
            const thumbnailPath = await downloadMedia(apiData.thumbnail, 'image');
            await api.sendMessage({
                msg: `${messageBody}\n\n🎵 Audio: `,
                attachments: thumbnailPath,
                ttl: 300000
            }, threadId, type);
            await api.sendVoice({ voiceUrl, ttl: 300000 }, threadId, type);
            fs.unlinkSync(thumbnailPath);
            try {
                await api.addReaction(Reactions.NONE, {
                    data: { msgId: event.data.msgId, cliMsgId: event.data.cliMsgId },
                        threadId,
                        type
                });
                await api.addReaction(Reactions.HEART, {
                    data: { msgId: event.data.msgId, cliMsgId: event.data.cliMsgId },
                        threadId,
                        type
                });
            } catch {}
            return;
        } catch (err) {
            console.error("Lỗi xử lý audio:", err.message);
            try {
                await api.addReaction(Reactions.NONE, {
                    data: { msgId: event.data.msgId, cliMsgId: event.data.cliMsgId },
                        threadId,
                        type
                });
                await api.addReaction(Reactions.CRY, {
                    data: { msgId: event.data.msgId, cliMsgId: event.data.cliMsgId },
                        threadId,
                        type
                });
            } catch {}
        }
    }

    return api.sendMessage({ msg: "📭 Không thể tải xuống media" }, threadId, type);
};

module.exports.run = async function ({ api, event, args, Threads }) {
    const { threadId, type } = event;

    if (type === ThreadType.User) {
        return api.sendMessage({ msg: "❌ Autodown chỉ hoạt động trong nhóm.", ttl: 60000 }, threadId, type);
    }

    const action = (args[0] || "help").toLowerCase();

    // Bật/tắt tự tải media cho nhóm này
    if (action === "on" || action === "off") {
        const thread = await Threads.getData(threadId);
        thread.data.auto_down = action === "on";
        await Threads.setData(threadId, thread.data);
        return api.sendMessage({
            msg: "📥 AUTODOWN\n" +
                `Trạng thái: ${action === "on" ? "ĐÃ BẬT ✅" : "ĐÃ TẮT ❌"}\n` +
                (action === "on"
                    ? "Gửi link hỗ trợ (Tiktok, Youtube, Facebook, Instagram...) vào nhóm là bot tự tải."
                    : "Bot sẽ không tự tải link trong nhóm này nữa."),
            ttl: 60000
        }, threadId, type);
    }

    // Trạng thái hiện tại của nhóm
    if (action === "status" || action === "stt") {
        const thread = (await Threads.getData(threadId)).data || {};
        return api.sendMessage({
            msg: `📥 Autodown nhóm này: ${thread.auto_down ? "ĐANG BẬT ✅" : "ĐANG TẮT ❌"}\nDùng: autodown on / autodown off`,
            ttl: 60000
        }, threadId, type);
    }

    return api.sendMessage({
        msg: '🔍 AUTODOWN HELPER\n\n' +
            'Tự động tải xuống media từ các link được chia sẻ trong nhóm.\n\n' +
            '📌 Các nền tảng được hỗ trợ:\n' +
            'Tiktok, Douyin, Capcut, Threads, Instagram, Facebook, Espn, Pinterest, IMDb, Imgur, Ifunny, Izlesene, Reddit, Youtube, Twitter/X, Vimeo, Snapchat, Bilibili, Dailymotion, Sharechat, Likee, Linkedin, Tumblr, Hipi, Telegram, Getstickerpack, Bitchute, Febspot, 9GAG, oke.ru, Rumble, Streamable, Ted, SohuTv, Xvideos, Xnxx, Xiaohongshu, Ixigua, Weibo, Miaopai, Meipai, Xiaoying, National Video, Yingke, Sina, VK (vkvideo), Soundcloud, Mixcloud, Spotify, Zingmp3, Bandcamp.\n\n' +
            '💡 Cách dùng: Chỉ cần gửi link http:// hoặc https:// vào nhóm, bot sẽ tự động tải nếu nền tảng được hỗ trợ.\n\n' +
            '🔰 Phản hồi bằng emoji:\n' +
            '👍 - Đang xử lý\n' +
            '❤️ - Tải thành công\n' +
            '😢 - Lỗi khi tải\n' +
            '😮 - Không tìm thấy media\n\n' +
            '⚙️ Admin bot: autodown on / autodown off / autodown status',
        ttl: 60000
    }, threadId, type);
};
async function downloadMedia(url, mediaType) {
    try {
        const tempDir = path.join(__dirname, 'temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        let filename;
        if (mediaType === 'video') {
            filename = `video_${Date.now()}.mp4`;
        } else if (mediaType === 'image') {
            filename = `image_${Date.now()}.jpg`;
        } else if (mediaType === 'audio') {
            filename = `audio_${Date.now()}.mp3`;
        } else {
            throw new Error('mediaType không hợp lệ');
        }

        const filePath = path.join(tempDir, filename);

        const response = await axios.get(url, {
            responseType: 'stream',
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        const writer = fs.createWriteStream(filePath);
        response.data.pipe(writer);

        return new Promise((resolve, reject) => {
            writer.on('finish', async () => {
                    resolve(filePath);
            });

            writer.on('error', reject);
        });

    } catch (err) {
        console.error('Lỗi downloadMedia:', err);
        return null;
    }
}