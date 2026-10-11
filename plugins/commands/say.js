// TTS ElevenLabs — API key lấy từ config.yml (ai.elevenlabs_key) hoặc env JT_AI__ELEVENLABS_KEY
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { processAudio } = require("../../utils/index");

const VOICES = {
  nam: { id: "pNInz6obpgDQGcFmaJgB", name: "Adam (Nam trẻ)" },
  nu: { id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel (Nữ trẻ)" },
  tranc: { id: "EXAVITQu4vr4xnSDxMaL", name: "Bella (Nữ nhẹ)" },
  tre: { id: "JBFqnCBsd6RMkjVDRZzb", name: "George (Nam trầm)" }
};

function apiKey() {
  return (global.config?.ai?.elevenlabs_key || process.env.JT_AI__ELEVENLABS_KEY || "").trim();
}

module.exports.config = {
  name: "say",
  version: "2.0.0",
  role: 0,
  author: "ᴶᴼᴴᴺ ᵀᴿᴬᴺ",
  description: "Đọc văn bản thành giọng nói (ElevenLabs)",
  category: "Tiện ích",
  usage: "say <văn bản> | say set <mã giọng> | say list",
  cooldowns: 5,
  dependencies: {},
    requires: [
        { key: "ai.elevenlabs_key", label: "Key ElevenLabs (ai.elevenlabs_key)", optional: false }
    ]
};

module.exports.run = async function ({ api, event, args, Threads }) {
  const { threadId, type, data } = event;
  const uid = data.uidFrom;

  if (!apiKey()) {
    return api.sendMessage({ msg: "❌ Chưa cấu hình API key ElevenLabs (config.yml → ai.elevenlabs_key).", ttl: 60000 }, threadId, type);
  }

  if (args[0] === "list") {
    const list = Object.entries(VOICES).map(([code, v]) => `👉 ${code} = ${v.name}`).join("\n");
    return api.sendMessage({ msg: `📢 Các giọng có thể chọn:\n${list}`, ttl: 60000 }, threadId, type);
  }

  if (args[0] === "set") {
    const voiceCode = args[1]?.toLowerCase();
    if (!VOICES[voiceCode]) {
      return api.sendMessage({ msg: "❌ Giọng không hợp lệ. Dùng: say list để xem các giọng!", ttl: 60000 }, threadId, type);
    }
    const threadData = (await Threads.getData(threadId)).data || {};
    threadData.voice_code = voiceCode;
    await Threads.setData(threadId, threadData);
    return api.sendMessage({ msg: `✅ Đã chọn giọng: ${VOICES[voiceCode].name}`, ttl: 60000 }, threadId, type);
  }

  const text = (data.quote && typeof data.quote.content === "string" ? data.quote.content : "") || args.join(" ");
  if (!text) {
    return api.sendMessage({ msg: "❌ Nhập nội dung để đọc!", ttl: 60000 }, threadId, type);
  }

  const threadData = (await Threads.getData(threadId)).data || {};
  const voice = VOICES[threadData.voice_code] || VOICES.nam;

  const tempDir = path.join(__dirname, "temp");
  const filePath = path.join(tempDir, `say_${Date.now()}.mp3`);

  try {
    fs.mkdirSync(tempDir, { recursive: true });
    const res = await axios({
      method: "POST",
      url: `https://api.elevenlabs.io/v1/text-to-speech/${voice.id}`,
      headers: { "xi-api-key": apiKey(), "Content-Type": "application/json" },
      responseType: "arraybuffer",
      timeout: 60000,
      data: {
        text: text.slice(0, 2000),
        model_id: "eleven_flash_v2_5",
        voice_settings: { stability: 0.3, similarity_boost: 0.9, style: 0.0, use_speaker_boost: true }
      }
    });
    fs.writeFileSync(filePath, res.data);

    const voiceUrl = await processAudio(filePath, threadId, type);
    await api.sendMessage({ msg: `🔊 Đã đọc bằng giọng: ${voice.name}`, ttl: 300000 }, threadId, type);
    await api.sendVoice({ voiceUrl, ttl: 300000 }, threadId, type);
  } catch (err) {
    console.error("TTS error:", err?.response?.data || err.message);
    api.sendMessage({ msg: "❌ Lỗi khi tạo giọng nói. Kiểm tra lại API key!", ttl: 30000 }, threadId, type);
  } finally {
    if (fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch { /* bỏ qua */ }
    }
  }
};
