const os = require("os");
const path = require("path");
const fs = require("fs");
const http = require("../../core/http");
const { fetchProfile } = require("../../core/zaloProfile");
const { firstMention } = require("../../core/mentions");

module.exports.config = {
  name: 'hon',
  aliases: ['kiss', 'hôn'],
  version: '1.0.0',
  role: 0,
  author: 'ShinTHL09', // ý tưởng từ Raiden Makoto
  description: 'Hôn người bạn tag',
  category: 'Hành động',
  usage: 'hôn [@tag]',
  cooldowns: 2,
  dependencies: {}
};

module.exports.run = async ({ event, api }) => {
    const { threadId, type, data } = event;

    const links = [
"https://i.imgur.com/0rKeVFp.gif",
"https://i.imgur.com/V4JnRiq.gif"
   ];

    const receiverID = firstMention(data);
    if (!receiverID) {
        return api.sendMessage("❌ Bạn cần tag người muốn hôn!", threadId, type);
    }

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "jt_hon_"));
    const honPath = path.join(tempDir, "hon.gif");
    try {
        const { user } = await fetchProfile(api, receiverID);
        if (!user) throw new Error("Không đọc được hồ sơ người được tag.");
        const name = String(user.displayName || user.zaloName || receiverID);
        const link = links[Math.floor(Math.random() * links.length)];
        const { buffer } = await http.getBuffer(link, {
            timeout: 20000,
            retries: 1,
            headers: {
                "User-Agent": "Mozilla/5.0",
                "Referer": "https://imgur.com/",
                "Accept": "image/*,*/*;q=0.8"
            }
        });
        if (!buffer?.length) throw new Error("Ảnh động tải về rỗng.");
        fs.writeFileSync(honPath, buffer);

        const msg = `${name} 𝗕𝗮𝗲 𝗰𝗵𝗼 𝗮𝗻𝗵 𝘁𝗵𝗼̛𝗺 𝗺𝗼̣̂𝘁 𝗰𝗮́𝗶 𝗻𝗲̀ 💞`;
        await api.sendMessage({
            msg,
            attachments: honPath,
            mentions: [{ uid: receiverID, pos: msg.indexOf(name), len: name.length }]
        }, threadId, type);
    } catch (error) {
        return api.sendMessage(`❌ Không thể gửi hành động hôn: ${error.message}`, threadId, type);
    } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }

};