const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { Reactions, ThreadType } = require("zalo-client");
const services = require("../../core/services");
const tiktokApi = require("../../core/tiktok");
const ytdlp = require("../../core/mediaDownloader");
const { processVideo, processAudio } = require("../../utils/index");

module.exports.config = {
    name: "autodown",
    version: "2.1.0",
    role: 2,
    author: "ShinTHL09, NLam182",
    description: "Tự động tải media từ hơn 40 nền tảng phổ biến (Tiktok, Youtube, Facebook, Instagram, Capcut, Reddit, Twitter, Soundcloud, Spotify, Zingmp3, v.v...)",
    category: "Tiện ích",
    usage: "autodown on | autodown off | autodown status",
    cooldowns: 5
};

// Chỉ cần 1 regex chung cho mọi nền tảng (tiktok, youtube, fb...) — khớp link trong tin nhắn
const LINK_RE = /(https?:\/\/[^\s<>"']+)/i;

// Các nền tảng được hỗ trợ — link lạ (vd example.com) sẽ bị bỏ qua, khỏi làm nhiễu nhóm
const SUPPORTED_PATTERNS = [
    /tiktok\.com/, /douyin\.com/, /capcut\.com/, /threads\.net/, /instagram\.com/, /facebook\.com/,
    /fb\.watch/, /youtube\.com/, /youtu\.be/, /espn\.com/, /pinterest\.com/, /pin\.it/, /imdb\.com/,
    /imgur\.com/, /ifunny\.co/, /izlesene\.com/, /reddit\.com/, /twitter\.com/, /x\.com/, /vimeo\.com/,
    /snapchat\.com/, /bilibili\.com/, /dailymotion\.com/, /sharechat\.com/, /likee\.video/,
    /linkedin\.com/, /tumblr\.com/, /hipi\.co\.in/, /telegram\.org/, /getstickerpack\.com/,
    /bitchute\.com/, /febspot\.com/, /9gag\.com/, /ok\.ru/, /rumble\.com/, /streamable\.com/, /ted\.com/,
    /sohu\.com/, /xvideos\.com/, /xnxx\.com/, /xiaohongshu\.com/, /ixigua\.com/, /weibo\.com/,
    /miaopai\.com/, /meipai\.com/, /xiaoying\.tv/, /nationalvideo\.com/, /yingke\.com/, /sina\.com\.cn/,
    /vk\.com/, /vk\.ru/, /soundcloud\.com/, /mixcloud\.com/, /spotify\.com/, /zingmp3\.vn/, /bandcamp\.com/
];

function sanitizeError(msg) {
  return String(msg || "lỗi không xác định").replace(/https?:\/\/\S+/g, "[link]").slice(0, 200);
}

// Gợi ý sửa lỗi theo loại link — Facebook/Instagram hay cần cookie đăng nhập
function errorHint(url, message) {
  const text = String(message || "");
  if (/youtube|youtu\.be/i.test(url) && /sign in|not a bot|cookies|login/i.test(text)) {
    return "\n\n💡 YouTube đang chặn IP này. Sửa 1 trong 2 cách:\n" +
           "1) Bot chạy trên máy bạn → config.yml: media.ytdlp_cookies_from_browser: chrome\n" +
           "2) Bot chạy trên Render → export cookies.txt từ trình duyệt rồi set media.ytdlp_cookies_file (hoặc env YTDLP_COOKIES_FILE)";
  }
  if (/facebook|fb\.watch/i.test(url) && /cannot parse|login|log in|cookie/i.test(text)) {
    return "\n\n💡 Facebook thường cần cookie: export cookies.txt từ trình duyệt rồi set media.ytdlp_cookies_file trong config.yml.";
  }
  if (/instagram/i.test(url) && /empty media|login|cookie|rate/i.test(text)) {
    return "\n\n💡 Instagram hay chặn/bắt đăng nhập — thử lại sau hoặc set media.ytdlp_cookies_file trong config.yml.";
  }
  if (/sign in|not a bot|inappropriate|confirm your age/i.test(text)) {
    return "\n\n💡 Site đang chặn bot — bot đã tự thử nhiều cách, nếu vẫn lỗi thì cấu hình cookie hoặc media_downloader_url trong config.yml.";
  }
  return "";
}

// Tách URL SẠCH khỏi tin nhắn — xử lý MỌI dạng Zalo gửi link:
//   "xem link này https://youtu.be/abc nha"  → "https://youtu.be/abc"
//   { href: "..." } / { url: "..." } / { link: "..." } (tin chia sẻ)
//   { action: "recommened.link", href: "..." } (link gợi ý)
//   object lồng object: { media: { src: { value: "..." } } }
function findUrlInString(text) {
  const m = String(text).match(LINK_RE);
  return m ? m[1].replace(/[.,)\]]+$/, "") : null; // bỏ dấu câu cuối câu
}

function extractUrl(content, depth = 0) {
  if (!content || depth > 4) return null;

  if (typeof content === "string") return findUrlInString(content);
  if (typeof content !== "object") return null;

  // Ưu tiên các key thường chứa link
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

  // Rồi quét mọi giá trị còn lại (kéo cả mảng)
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

// Tải file nhị phân về máy (ảnh gif/thumbnail/ảnh album)
async function downloadToFile(url, filename) {
  const filePath = path.join(tempDir(), filename);
  const response = await axios.get(url, {
    responseType: "stream",
    timeout: 60000,
    headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" }
  });
  const writer = fs.createWriteStream(filePath);
  response.data.pipe(writer);
  await new Promise((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
  if (!fs.existsSync(filePath) || fs.statSync(filePath).size === 0) {
    throw new Error("File tải về rỗng");
  }
  return filePath;
}

module.exports.handleEvent = async function ({ api, event, Threads, isSelf }) {
    if (!event.data) return;

    // Chỉ hoạt động trong nhóm — không chat riêng
    if (event.type !== ThreadType.Group) return;

    // Bỏ qua tin do chính bot gửi (tránh vòng lặp: bot trả link → lại tự tải)
    if (isSelf === true) return;

    // Bỏ qua tin là LỆNH (bắt đầu bằng prefix) — /menu không nên tự tải link trong đó
    const rawContent = String(event.data.content || "").trim();
    if (global.config.prefix && rawContent.startsWith(global.config.prefix)) return;

    // Zalo gửi link dạng text (webchat) HOẶC dạng object (tin chia sẻ, link gợi ý...)
    const url = extractUrl(event.data.content);
    if (!url) return;

    // Không hỗ trợ nền tảng này → im lặng (không làm nhiễu nhóm bằng tin báo lỗi)
    if (!SUPPORTED_PATTERNS.some((pattern) => pattern.test(url))) return;

    const { threadId, type } = event;

    // Chỉ nhóm đã bật autodown mới tự tải (mặc định tắt)
    const threadData = (await Threads.getData(threadId)).data || {};
    if (!threadData.auto_down) return;

    const setReactions = async (reactions) => {
        for (const reaction of reactions) {
            try {
                await api.addReaction(Reactions.NONE, {
                    data: { msgId: event.data.msgId, cliMsgId: event.data.cliMsgId },
                    threadId,
                    type
                });
                await api.addReaction(reaction, {
                    data: { msgId: event.data.msgId, cliMsgId: event.data.cliMsgId },
                    threadId,
                    type
                });
            } catch { /* bỏ qua */ }
        }
    };

    try {
        await setReactions([Reactions.LIKE]);
    } catch { /* bỏ qua */ }

    // ===== Cách 0: TikTok/Douyin qua API (IP thường bị TikTok chặn nên yt-dlp không qua được) =====
    if (tiktokApi.isTikTokUrl(url)) {
        try {
            return await downloadTikTok(url, api, threadId, type, setReactions);
        } catch (error) {
            console.log(`[autodown] TikTok API thất bại: ${error.message}`);
        }

        // Dự phòng: yt-dlp (máy chủ nào IP không bị chặn thì vẫn tải được)
        if (await ytdlp.ytDlpAvailable()) {
            try {
                return await downloadWithYtDlp(url, api, threadId, type, setReactions);
            } catch (error) {
                console.log(`[autodown] TikTok qua yt-dlp cũng thất bại: ${error.message}`);
            }
        }

        await setReactions([Reactions.CRY]);
        return api.sendMessage({
            msg: `❌ Không tải được video TikTok.\n${sanitizeError("API TikTok đang lỗi hoặc bị chặn")}\n\n` +
                 `💡 Admin: đặt API khác vào config.yml → services.tiktok_api_url.`
        }, threadId, type);
    }

    // ===== Cách 1: tải LOCAL bằng yt-dlp (link KHÔNG đi qua bên thứ 3) =====
    if (await ytdlp.ytDlpAvailable()) {
        try {
            return await downloadWithYtDlp(url, api, threadId, type, setReactions);
        } catch (error) {
            console.log(`[autodown] Tải local thất bại: ${error.message}`);
            // Không còn endpoint cấu hình sẵn → báo lỗi luôn
            if (!services.serviceUrl("media_downloader_url")) {
                await setReactions([Reactions.CRY]);
                return api.sendMessage({
                    msg: `❌ Không tải được link này.\n${sanitizeError(error.message)}${errorHint(url, error.message)}`
                }, threadId, type);
            }
        }
    }

    // ===== Cách 2: API endpoint do admin cấu hình (vd cho TikTok) =====
    let apiData;
    try {
        const baseUrl = services.requireService("media_downloader_url");
        const down = await axios.get(`${baseUrl}/media-downloader/atd2?url=${encodeURIComponent(url)}`, { timeout: 60000 });
        apiData = down.data;
    } catch (error) {
        if (error.notConfigured) {
            await setReactions([Reactions.CRY]);
            return api.sendMessage({ msg: `❌ ${error.message}` }, threadId, type);
        }
        await setReactions([Reactions.CRY]);
        return api.sendMessage({ msg: "❌ Lỗi khi tải xuống media" }, threadId, type);
    }

    if (!apiData || !Array.isArray(apiData.medias) || apiData.medias.length === 0) {
        await setReactions([Reactions.WOW]);
        return api.sendMessage({ msg: "❓ Không tìm thấy media để tải xuống" }, threadId, type);
    }

    await sendApiMedia(apiData, api, threadId, type, setReactions);
};

// ===== Gửi media lấy được từ API bên ngoài =====
async function sendApiMedia(apiData, api, threadId, type, setReactions) {
    const videos = apiData.medias.filter((item) => item.type === 'video');
    const images = apiData.medias.filter((item) => item.type === 'image').slice(0, 5);
    const audios = apiData.medias.filter((item) => item.type === 'audio');

    const videoToSend = videos.find((v) => v.quality === 'hd_no_watermark') ||
                        videos.find((v) => v.quality === 'no_watermark') || videos[0] || null;
    const audioToSend = audios[0] || null;

    const metaInfo = [];
    if (apiData.unique_id) metaInfo.push(`UID: ${apiData.unique_id}`);
    if (apiData.author) metaInfo.push(`Author: ${apiData.author}`);
    if (apiData.title) metaInfo.push(`Title: ${apiData.title}`);
    const messageBody = "🎦 AUTODOWN" + (metaInfo.length ? "\n" + metaInfo.join("\n") : "");

    try {
        // ===== Video =====
        if (videoToSend) {
            const videoPath = await downloadToFile(videoToSend.url, `video_${Date.now()}.mp4`);
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
            return;
        }

        // ===== Album ảnh =====
        if (images.length > 0) {
            const attachments = [];
            for (const image of images) {
                attachments.push(await downloadToFile(image.url, `image_${Date.now()}_${attachments.length}.jpg`));
            }
            await api.sendMessage({ msg: messageBody, attachments }, threadId, type);
            if (audioToSend) {
                const audioPath = await downloadToFile(audioToSend.url, `audio_${Date.now()}.mp3`);
                const voiceUrl = await processAudio(audioPath, threadId, type, api);
                await api.sendVoice({ voiceUrl }, threadId, type);
            }
            attachments.forEach((filePath) => { try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch { /* bỏ qua */ } });
            await setReactions([Reactions.HEART]);
            return;
        }

        // ===== Audio =====
        if (audioToSend) {
            const audioPath = await downloadToFile(audioToSend.url, `audio_${Date.now()}.mp3`);
            const voiceUrl = await processAudio(audioPath, threadId, type, api);
            await api.sendMessage({ msg: `${messageBody}\n\n🎵 Audio:` }, threadId, type);
            await api.sendVoice({ voiceUrl }, threadId, type);
            await setReactions([Reactions.HEART]);
            return;
        }
    } catch (err) {
        console.error("Lỗi xử lý media:", err.message);
        await setReactions([Reactions.CRY]);
        return api.sendMessage({ msg: "❌ Lỗi xử lý media (tải được nhưng gửi thất bại)." }, threadId, type);
    }

    return api.sendMessage({ msg: "📭 Không thể tải xuống media" }, threadId, type);
}

// ===== TikTok: lấy link qua API rồi tải trực tiếp — link KHÔNG đi qua API lạ của bên thứ 3 =====
async function downloadTikTok(url, api, threadId, type, setReactions) {
    const info = await tiktokApi.getVideoInfo(url);

    const videoPath = await downloadToFile(info.videoUrl, `tiktok_${Date.now()}.mp4`);
    const videoData = await processVideo(videoPath, threadId, type, api);
    await api.sendVideo({
        msg: "🎦 AUTODOWN\n" + `Title: ${info.title}\n` + `Author: ${info.author}`,
        videoUrl: videoData.videoUrl,
        thumbnailUrl: videoData.thumbnailUrl,
        duration: videoData.metadata.duration,
        width: videoData.metadata.width,
        height: videoData.metadata.height
    }, threadId, type);
    await setReactions([Reactions.HEART]);
    return;
}

// ===== Tải local bằng yt-dlp (mọi nền tảng) =====
async function downloadWithYtDlp(url, api, threadId, type, setReactions) {
    const info = await ytdlp.getMediaInfo(url);
    if (!info) throw new Error("Không lấy được thông tin media");

    const messageBody = "🎦 AUTODOWN\n" + ytdlp.describe(info).join("\n");

    // Nhạc (không có video) → gửi voice
    if (ytdlp.isAudioOnly(info)) {
        const audioPath = path.join(tempDir(), `audio_${Date.now()}.mp3`);
        await ytdlp.downloadAudio(url, audioPath);
        const voiceUrl = await processAudio(audioPath, threadId, type, api);
        await api.sendMessage({ msg: messageBody }, threadId, type);
        await api.sendVoice({ voiceUrl }, threadId, type);
        await setReactions([Reactions.HEART]);
        return;
    }

    // Video → tải + xử lý + gửi video
    const videoPath = path.join(tempDir(), `video_${Date.now()}.mp4`);
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
    return;
}

module.exports.run = async function ({ api, event, args, Threads }) {
    const { threadId, type } = event;

    if (type === ThreadType.User) {
        return api.sendMessage({ msg: "❌ Autodown chỉ hoạt động trong nhóm.", plain: true }, threadId, type);
    }

    const action = (args[0] || "help").toLowerCase();

    // Bật/tắt tự tải media cho nhóm này
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

    // Trạng thái hiện tại của nhóm
    if (action === "status" || action === "stt") {
        const thread = (await Threads.getData(threadId)).data || {};
        const tiktokOk = await tiktokApi.healthCheck().catch(() => false);
        return api.sendMessage({
            plain: true,
            msg: `📥 Autodown nhóm này: ${thread.auto_down ? "ĐANG BẬT ✅" : "ĐANG TẮT ❌"}\n` +
                 `Dùng: autodown on / autodown off\n` +
                 `Tiktok API: ${tiktokOk ? "hoạt động ✅" : "đang lỗi ❌ (Youtube/Facebook vẫn dùng yt-dlp)"}`
        }, threadId, type);
    }

    return api.sendMessage({
        plain: true,
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
            '⚙️ Admin bot: autodown on / autodown off / autodown status'
    }, threadId, type);
};
