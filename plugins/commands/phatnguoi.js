
function apiUrl() {
  return global.config?.services?.phatnguoi_url || "https://api.checkphatnguoi.vn/phatnguoi";
}

module.exports.config = {
  name: "phatnguoi",
  aliases: ["phatnguoi","phatn guoi","checkphat"],

  version: "2.0.0",
  role: 0,
  author: "ᴶᴼᴴᴺ ᵀᴿᴬᴺ",
  description: "Kiểm tra phạt nguội xe máy, ô tô, xe máy điện",
  category: "Tiện ích",
  usage: "phatnguoi [biển số xe]",
  cooldowns: 5,
  dependencies: {},
    requires: [
        { key: "services.phatnguoi_url", label: "API phạt nguội (services.phatnguoi_url)", optional: true }
    ]
};

async function processCheckRequest(api, event, bienSo) {
  const { threadId, type } = event;
  try {
    const axios = require('axios');
    const response = await axios.post(apiUrl(), { bienso: bienSo }, {
      headers: { "Content-Type": "application/json" },
      timeout: 30000
    });

    const { status, data, data_info } = response.data;

    if (status === 1 && Array.isArray(data) && data.length > 0) {
      await sendViolationMessage(api, event, bienSo, data_info, data);
    } else {
      api.sendMessage({ msg: `✅ Biển số ${bienSo} không có phạt nguội.` }, threadId, type);
    }
  } catch (error) {
    console.error("❌ Lỗi khi kiểm tra phạt nguội:", error.message);
    api.sendMessage({ msg: "⚠️ Đã xảy ra lỗi khi kiểm tra. Vui lòng thử lại sau." }, threadId, type);
  }
}

async function sendViolationMessage(api, event, bienSo, data_info, data) {
  const { threadId, type } = event;
  let message = `🚨 Kết quả kiểm tra phạt nguội cho biển số: ${bienSo}\n`;
  message += `📊 Tổng số vi phạm: ${data_info.total}\n`;
  message += `❌ Chưa xử phạt: ${data_info.chuaxuphat} | ✅ Đã xử phạt: ${data_info.daxuphat}\n`;
  message += `⏰ Lần vi phạm gần nhất: ${data_info.latest || "Không có"}\n\n`;

  data.slice(0, 5).forEach((violation, index) => {
    message += `🚔 Vi phạm ${index + 1}:\n`;
    message += `📅 Thời gian: ${violation["Thời gian vi phạm"] || "Không có"}\n`;
    message += `📍 Địa điểm: ${violation["Địa điểm vi phạm"] || "Không có"}\n`;
    message += `⚠️ Lỗi vi phạm: ${violation["Hành vi vi phạm"] || "Không có"}\n`;
    message += `📌 Trạng thái: ${violation["Trạng thái"] || "Không có"}\n`;
    message += `🚓 Đơn vị phát hiện: ${violation["Đơn vị phát hiện vi phạm"] || "Không có"}\n\n`;
  });

  api.sendMessage({ msg: message.slice(0, 1900) }, threadId, type);
}

module.exports.run = async function ({ api, event, args }) {
  const bienSo = args.join("").toUpperCase();

  if (!bienSo) {
    return api.sendMessage({ msg: "⚠️ Vui lòng nhập biển số xe cần kiểm tra. VD: /phatnguoi 72A12345" }, event.threadId, event.type);
  }

  processCheckRequest(api, event, bienSo);
};
