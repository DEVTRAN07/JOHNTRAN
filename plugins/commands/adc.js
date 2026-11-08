const fs = require('fs');
const path = require('path');
const { getMessageCache } = require('../../utils/index');
const http = require('../../core/http');
// cheerio nặng ~4s khi require lần đầu — lazy-load trong handler
// để khỏi làm chậm khởi động bot (preload nền sau khi boot xong).

module.exports.config = {
  name: 'adc',
  aliases: ["getcode", "upcode"],
  version: '2.0.0',
  role: 2,
  author: 'ShinTHL09, ᴶᴼᴴᴺ ᵀᴿᴬᴺ', // phát triển từ mdl gốc của D-Jukie
  description: 'Áp dụng code hoặc tải code lên',
  category: 'Hệ Thống',
  usage: 'adc [reply hoặc tên file]',
  usages: 'adc [reply hoặc tên file]',
  cooldowns: 2,
  dependencies: { "cheerio": "" },
    requires: [
        { key: "services.dpaste_url", label: "API dpaste (services.dpaste_url)", optional: true }
    ]
};

function getSafePluginPath(name) {
  if (name == null || typeof name !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(name)) return null;
  const safeName = path.basename(name).replace(/\.js$/, '');
  const resolved = path.resolve(__dirname, `${safeName}.js`);
  const base = path.resolve(__dirname);
  if (resolved !== base && !resolved.startsWith(base + path.sep)) return null;
  return resolved;
}

module.exports.run = async function ({ api, event, args }) {
  const { threadId, type, data } = event;

  if (!args[0]) return api.sendMessage("Vui lòng nhập tên file hoặc reply link chứa code!", threadId, type);

  const name = args[0].replace(/\.js$/, '');
  const filePath = getSafePluginPath(name);
  if (!filePath) {
    return api.sendMessage("Tên file không hợp lệ hoặc đường dẫn vượt ngoài thư mục plugin. Chỉ cho phép chữ cái, số, gạch dưới và gạch ngang.", threadId, type);
  }
  let link;

  if (data?.quote?.cliMsgId) {
    const messageCache = getMessageCache()[data.quote.cliMsgId];
    link = messageCache?.content?.trim();
  }

  if (!link) {
    try {
      const fileData = fs.readFileSync(filePath, "utf-8");
      const dpasteUrl = await uploadToDpaste(fileData);
      return api.sendMessage(`${dpasteUrl}`, threadId, type);
    } catch {
      return api.sendMessage(`Không tìm thấy file "${name}.js" để upload.`, threadId, type);
    }
  }

  const urlRegex = /https?:\/\/[^\s]+/g;
  const matched = link.match(urlRegex);
  if (!matched || matched.length === 0) {
    return api.sendMessage("Vui lòng chỉ reply 1 link hợp lệ!", threadId, type);
  }

  const url = matched[0];

  try {
    if (url.includes('pastebin')) {
      const { data } = await http.getJson(url);
      await writeCodeToFile(name, data, api, threadId, type);
    }

    else if (url.includes('dpaste.com')) {
      const rawUrl = url.endsWith('.txt') ? url : `${url}.txt`;
      const { data } = await http.getJson(rawUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      await writeCodeToFile(name, data, api, threadId, type);
    }

    else if (url.includes('buildtool') || url.includes('tinyurl.com')) {
      const response = await http.request(url);
      const cheerio = require('cheerio');
      const $ = cheerio.load(response.text());
      const codeBlock = $('.language-js').first();
      const code = codeBlock?.text()?.trim();

      if (!code) {
        return api.sendMessage('Không tìm thấy code trong trang.', threadId, type);
      }

      await writeCodeToFile(name, code, api, threadId, type);
    }

    else if (url.includes('drive.google')) {
      const idMatch = url.match(/[-\w]{25,}/);
      if (!idMatch) return api.sendMessage("Không lấy được ID từ link Google Drive.", threadId, type);
      const fileID = idMatch[0];
      await downloadFile(`https://drive.google.com/u/0/uc?id=${fileID}&export=download`, filePath);
      return api.sendMessage(`Đã tải plugin "${name}.js". ⚠️ Cảnh báo: tính năng tải code từ link chỉ dành cho admin, có nguy cơ RCE - chỉ chạy code từ nguồn tin cậy. Hãy dùng cmd load ${name} để sử dụng.`, threadId, type);
    }

    else {
      return api.sendMessage("Không hỗ trợ link này.", threadId, type);
    }
  } catch (err) {
    return api.sendMessage(`Lỗi khi xử lý: ${err.message}`, threadId, type);
  }
};

async function writeCodeToFile(name, code, api, threadId, type) {
  const filePath = getSafePluginPath(name);
  if (!filePath) {
    return api.sendMessage("Tên file không hợp lệ hoặc đường dẫn vượt ngoài thư mục plugin.", threadId, type);
  }
  fs.writeFile(filePath, code, 'utf-8', (err) => {
    if (err) {
      return api.sendMessage(`Không thể ghi file "${name}.js".`, threadId, type);
    }
    api.sendMessage(`Đã tải plugin "${name}.js". ⚠️ Cảnh báo: tính năng ghi code từ link chỉ dành cho admin, có nguy cơ RCE - chỉ áp dụng code bạn tin cậy. Hãy dùng cmd load ${name} để sử dụng.`, threadId, type);
  });
}

async function uploadToDpaste(code) {
  try {
    const response = await http.request('https://dpaste.com/api/v2/', {
      method: 'POST',
      body: `content=${encodeURIComponent(code)}&syntax=text&expiry_days=7`,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0'
      }
    });
    const text = response.text();
    if (text.startsWith('https://dpaste.com/')) {
      return text.trim() + '.txt';
    } else {
      throw new Error('Phản hồi không hợp lệ từ Dpaste.');
    }
  } catch (error) {
    throw new Error("Không thể upload lên dpaste: " + error.message);
  }
}

async function downloadFile(url, filePath) {
  const { buffer } = await http.getBuffer(url);
  fs.writeFileSync(filePath, buffer);
}
