const http = require("../http");

const DEFAULT_MODEL = "gemini-2.5-flash";
const NO_KEY_MESSAGE = "Tính năng AI chưa được cấu hình (thiếu ai.gemini_keys trong config.yml hoặc biến môi trường JT_GEMINI_KEYS).";
const MAX_HISTORY = 8;

function apiKeys() {
  return global.config?.ai?.gemini_keys || [];
}

function model() {
  return global.config?.ai?.gemini_model || DEFAULT_MODEL;
}

function maxPromptLength() {
  return global.config?.ai?.max_prompt_length || 340;
}

function historyLimit() {
  return global.config?.ai?.max_history || MAX_HISTORY;
}

function buildBody(prompt) {
  return {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { maxOutputTokens: 800 }
  };
}

async function callGemini(key, parts) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model()}:generateContent?key=${key}`;
  const response = await http.request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts }], generationConfig: { maxOutputTokens: 800 } }),
    retries: 0
  });
  return response.json();
}

// Lấy lịch sử hội thoại gần nhất của user (nhớ ngữ cảnh)
function getHistory(userId) {
  const Users = require("../controller/controllerUsers");
  const data = Users.getData(userId).data || {};
  return Array.isArray(data.aiHistory) ? data.aiHistory.slice(-historyLimit()) : [];
}

function pushHistory(userId, entry) {
  const Users = require("../controller/controllerUsers");
  const data = Users.getData(userId).data || {};
  const history = Array.isArray(data.aiHistory) ? data.aiHistory : [];
  history.push(entry);
  data.aiHistory = history.slice(-historyLimit());
  Users.setData(userId, data);
}

function clearHistory(userId) {
  const Users = require("../controller/controllerUsers");
  const data = Users.getData(userId).data || {};
  data.aiHistory = [];
  Users.setData(userId, data);
}

function buildParts(prompt, imageBuffer, mimeType, userId) {
  const parts = [];
  if (userId) {
    const history = getHistory(userId);
    if (history.length > 0) {
      const context = history.map((h) => `${h.role === "user" ? "Người dùng" : "Bot"}: ${h.text}`).join("\n");
      parts.push({ text: `Đây là đoạn hội thoại trước đó (chỉ dùng làm ngữ cảnh, không tiết lộ lại):\n${context}` });
    }
  }
  parts.push({ text: prompt });
  if (imageBuffer) {
    parts.push({ inline_data: { mime_type: mimeType || "image/jpeg", data: imageBuffer.toString("base64") } });
  }
  return parts;
}

async function generate(prompt, { imageBuffer, mimeType, maxLength, userId, remember = true } = {}) {
  const keys = apiKeys();
  if (keys.length === 0) {
    const error = new Error(NO_KEY_MESSAGE);
    error.notConfigured = true;
    throw error;
  }

  const limit = maxLength || maxPromptLength();
  const safePrompt = String(prompt || "").slice(0, limit);
  const parts = buildParts(safePrompt, imageBuffer, mimeType, userId);

  for (const key of keys) {
    try {
      const result = await callGemini(key, parts);
      if (result?.candidates?.[0]?.content?.parts?.[0]?.text) {
        const text = result.candidates[0].content.parts[0].text;
        if (remember && userId && !imageBuffer) {
          pushHistory(userId, { role: "user", text: safePrompt, ts: Date.now() });
          pushHistory(userId, { role: "model", text, ts: Date.now() });
        }
        return text;
      }
      if (result?.error && [429, 503, 500].includes(result.error.code)) continue;
    } catch (error) {
      if (error.privacyBlocked) throw error;
      const status = error?.response?.status;
      if ([429, 503, 500].includes(status)) continue;
    }
  }

  const error = new Error("Dịch vụ AI đang quá tải hoặc không khả dụng. Vui lòng thử lại sau!");
  error.unavailable = true;
  throw error;
}

module.exports = { generate, apiKeys, getHistory, clearHistory, NO_KEY_MESSAGE };
