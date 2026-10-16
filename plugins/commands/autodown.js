const fs = require('fs');
const path = require('path');
const { Reactions, ThreadType } = require("zalo-client");
const ytdlp = require("../../core/mediaDownloader");
const { processVideo, processAudio } = require("../../utils/index");

module.exports.config = {
    name: "autodown",
    version: "3.0.0",
    role: 2,
    author: "ᴶᴼᴴᴺ ᵀᴿᴬᴺ",
    description: "Tự động tải media từ link chia sẻ trong nhóm (Tiktok, Youtube, Facebook, Instagram...)",
    category: "Tiện ích",
    usage: "autodown on | autodown off | autodown status",
    cooldowns: 5
};

// Regex tìm link http/https trong tin nhắn
const LINK_RE = /(https?:\/\/[^\s<>"']+)/i;

// Các nền tảng hỗ trợ (yt-dlp có thể tải): link lạ sẽ bị bỏ qua, không làm nhiễu nhóm
const SUPPORTED_PATTERNS = [
    /tiktok\.com/, /douyin\.com/, /vm\.tiktok\.com/, /vt\.tiktok\.com/,
    /youtube\.com/, /youtu\.be/, /m\.youtube\.com/, /music\.youtube\.com/,
    /facebook\.com/, /fb\.watch/, /fb\.com/,
    /instagram\.com/, /instagr\.am/,
    /twitter\.com/, /x\.com/, /t\.co/,
    /vimeo\.com/, /dailymotion\.com/, /bilibili\.com/, /reddit\.com/,
    /capcut\.com/, /threads\.net/, /pinterest\.com/, /pin\.it/,
    /imgur\.com/, /i\.imgur\.com/,
    /soundcloud\.com/, /mixcloud\.com/, /bandcamp\.com/,
    /spotify\.com/, /open\.spotify\.com/,
    /zingmp3\.vn/, /zing\.mp3\.vn/
];

function sanitizeError(msg) {
    return String(msg || "lỗi không xác định")
        .replace(/https?:\/\/\S+/g, "[link]")
        .slice(0, 200);
}

function findUrlInString(text) {
    const m = String(text).match(LINK_RE);
    return m ? m[1].replace(/[.,)\]]+$/, "") : null;
}

function extractUrl(content, depth = 0) {
    if (!content || depth > 4) return null;
    if (typeof content === "string") return findUrlInString(content);
    if (typeof content !== "object") return null;

    for (const key of ["href", "url", "link", "src", "value", "thumb"]) {
        const value = content[key];
        if (typeof value === "string") {
            const found = findUrlInString(value);
            if (found) return found;
        } else if (value && typeof value === "object") {
            const found = extractUrl(value, depth + 1);
            if (found) return found;
        }
    }
    for (const value of Object.values(content)) {
        if (typeof value === "string") {
            const found = findUrlInString(value);
            if (found) return found;
        } else if (value && typeof value === "object") {
            const found = extractUrl(value, depth + 1);
            if (found) return found;
        }
    }
    return null;
}

function tempDir() {
    const dir = path.join(__dirname, 'temp');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return dir;
}

function cleanupFile(filePath) {
    try { if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch { /* bỏ qua */ }
}

module.exports.handleEvent = async function ({ api, event, Threads, isSelf }) {
    if (!event.data) return;

    // Chỉ nhóm
    if (event.type !== ThreadType.Group) return;
    // Bỏ qua tin bot tự gửi (tránh vòng lặp)
    if (isSelf === true) return;
    // Bỏ qua lệnh (bắt đầu bằng prefix)
    const rawContent = String(event.data.content || "").trim();
    if (global.config.prefix && rawContent.startsWith(global.config.prefix)) return;

    const url = extractUrl(event.data.content);
    if (!url) return;

    // Bỏ qua nền tảng không hỗ trợ — im lặng, không báo lỗi làm nhiễu nhóm
    if (!SUPPORTED_PATTERNS.some((pattern) => pattern.test(url))) return;

    const { threadId, type } = event;

    // Chỉ nhóm đã bật autodown
    const threadData = (await Threads.getData(threadId)).data || {};
    if (!threadData.auto_down) return;

    const setReactions = async (reactions) => {
        for (const reaction of reactions) {
            try {
                await api.addReaction(Reactions.NONE, {
                    data: { msgId: event.data.msgId, cliMsgId: event.data.cliMsgId },
                    threadId, type
                });
                await api.addReaction(reaction, {
                    data: { msgId: event.data.msgId, cliMsgId: event.data.cliMsgId },
                    threadId, type
                });
            } catch { /* bỏ qua */ }
        }
    };

    try {
        await setReactions([Reactions.LIKE]);
    } catch { /* bỏ qua */ }

    try {
        const info = await ytdlp.getMediaInfo(url);
        if (!info) throw new Error("Không lấy được thông tin media");

        const messageBody = "🎦 AUTODOWN\n" + (ytdlp.describe ? ytdlp.describe(info).join("\n") : "");

        // Audio-only (nhạc, không có video) → gửi voice
        if (ytdlp.isAudioOnly && ytdlp.isAudioOnly(info)) {
            const audioPath = path.join(tempDir(), `audio_${Date.now()}.mp3`);
            try {
                await ytdlp.downloadAudio(url, audioPath);
                const voiceUrl = await processAudio(audioPath, threadId, type, api);
                await api.sendMessage({ msg: messageBody }, threadId, type);
                await api.sendVoice({ voiceUrl }, threadId, type);
                await setReactions([Reactions.HEART]);
            } finally {
                cleanupFile(audioPath);
            }
            return;
        }

        // Video
        const videoPath = path.join(tempDir(), `video_${Date.now()}.mp4`);
        try {
            await ytdlp.downloadVideo(url, videoPath);
            const videoData = await processVideo(videoPath, threadId, type, api);
            await api.sendVideo({
                msg: messageBody,
                videoUrl: videoData.videoUrl,
                thumbnailUrl: videoData.thumbnailUrl,
                duration: videoData.metadata.duration,
                width: videoData.metadata.width,
                height: videoData.metadata.height
            }, threadId, type);
            await setReactions([Reactions.HEART]);
        } finally {
            cleanupFile(videoPath);
        }
        return;

    } catch (error) {
        const hint = sanitizeError(error.message);
        await setReactions([Reactions.CRY]);
        return api.sendMessage({
            msg: `❌ Không tải được link này.\n${hint}\n\n💡 Admin: cấu hình cookie hoặc media_downloader_url trong config.yml nếu cần.`,
            plain: true
        }, threadId, type);
    }
};

module.exports.run = async function ({ api, event, args, Threads }) {
    const { threadId, type } = event;

    if (type === ThreadType.User) {
        return api.sendMessage({ msg: "❌ Autodown chỉ hoạt động trong nhóm.", plain: true }, threadId, type);
    }

    const action = (args[0] || "help").toLowerCase();

    if (action === "on" || action === "off") {
        const thread = await Threads.getData(threadId);
        thread.data.auto_down = action === "on";
        await Threads.setData(threadId, thread.data);
        return api.sendMessage({
            plain: true,
            msg: "📥 AUTODOWN\n" +
                `Trạng thái: ${action === "on" ? "ĐÃ BẬT ✅" : "ĐÃ TẮT ❌"}\n` +
                (action === "on"
                    ? "Gửi link hỗ trợ (Tiktok, Youtube, Facebook, Instagram...) vào nhóm là bot tự tải."
                    : "Bot sẽ không tự tải link trong nhóm này nữa.")
        }, threadId, type);
    }

    if (action === "status" || action === "stt") {
        const thread = (await Threads.getData(threadId)).data || {};
        return api.sendMessage({
            plain: true,
            msg: `📥 Autodown nhóm này: ${thread.auto_down ? "ĐANG BẬT ✅" : "ĐANG TẮT ❌"}\n` +
                 `Dùng: autodown on / autodown off`
        }, threadId, type);
    }

    return api.sendMessage({
        plain: true,
        msg: '🔍 AUTODOWN HELPER\n\n' +
            'Tự động tải xuống media từ link chia sẻ trong nhóm.\n\n' +
            '📌 Hỗ trợ: Tiktok, Youtube, Facebook, Instagram, Twitter/X, Vimeo, Dailymotion, Bilibili, Reddit, Capcut, Threads, Pinterest, Imgur, Soundcloud, Mixcloud, Spotify, Zingmp3, Bandcamp.\n\n' +
            '💡 Cách dùng: Chỉ cần gửi link http/https vào nhóm, bot sẽ tự tải (nếu nhóm đã bật autodown on).\n\n' +
            '🔰 Emoji: 👍 đang xử lý • ❤️ thành công • 😢 lỗi\n' +
            '⚙️ Admin: autodown on / autodown off / autodown status'
    }, threadId, type);
};
