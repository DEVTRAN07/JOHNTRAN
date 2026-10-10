const http = require("../http");

const TTS_URL = "https://translate.google.com/translate_tts";
const MAX_CHUNK = 180;
const MAX_TOTAL = 900;

function splitChunks(text, size = MAX_CHUNK) {
  const sentences = String(text).split(/(?<=[.!?。！？\n])\s+/);
  const chunks = [];
  let current = "";
  for (const sentence of sentences) {
    if ((current + sentence).length > size && current) {
      chunks.push(current.trim());
      current = sentence;
    } else {
      current += (current ? " " : "") + sentence;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.slice(0, Math.ceil(MAX_TOTAL / size));
}

async function speakChunk(text, lang) {
  const url = `${TTS_URL}?ie=UTF-8&client=tw-ob&tl=${encodeURIComponent(lang)}&q=${encodeURIComponent(text)}`;
  const { buffer } = await http.getBuffer(url, { timeout: 20000, retries: 1 });
  if (!buffer || buffer.length < 200) throw new Error("TTS trả về rỗng");
  return buffer;
}

async function textToSpeech(text, lang = "vi") {
  const clean = String(text || "").trim().slice(0, MAX_TOTAL);
  if (!clean) throw new Error("Không có nội dung để đọc");
  const chunks = splitChunks(clean);
  const buffers = [];
  for (const chunk of chunks) {
    buffers.push(await speakChunk(chunk, lang));
  }
  return Buffer.concat(buffers);
}

module.exports = { textToSpeech, splitChunks };
