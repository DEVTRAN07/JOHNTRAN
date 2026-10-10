const axios = require('axios');
const fs = require('fs');
const path = require('path');
const services = require('../../core/services');

module.exports.config = {
    name: 'fbin4',
    version: '2.0.0',
    role: 0,
    author: 'ᴶᴼᴴᴺ ᵀᴿᴬᴺ',
    description: 'Lấy thông tin Facebook bằng link hoặc UID (token do admin cấu hình)',
    category: 'Tiện ích',
    usage: 'fbin4 [uid hoặc link]',
    cooldowns: 2,
    dependencies: {}
};

// Token Facebook đặt trong config.yml → services.facebook_access_token
function accessToken() {
    return (global.config?.services?.facebook_access_token || '').trim();
}

async function getFacebookInfo(fbId) {
    const url = `https://graph.facebook.com/${fbId}?fields=picture.width(720).height(720),id,is_verified,cover,updated_time,work,education,likes,created_time,work,posts,hometown,username,family,timezone,link,name,locale,location,about,website,birthday,gender,relationship_status,significant_other,quotes,first_name,subscribers.limit(0)&access_token=${accessToken()}`;
    const res = await axios.get(url, { timeout: 30000 });
    return res.data;
}

function formatTimestamp(isoTime) {
  try {
    const date = new Date(isoTime);

    const pad = (n) => n.toString().padStart(2, '0');

    const hours = pad(date.getUTCHours());
    const minutes = pad(date.getUTCMinutes());
    const seconds = pad(date.getUTCSeconds());

    const day = pad(date.getUTCDate());
    const month = pad(date.getUTCMonth() + 1);
    const year = date.getUTCFullYear();

    return `${hours}:${minutes}:${seconds} | ${day}/${month}/${year}`;
  } catch (err) {
    return null;
  }
}

function formatInfo(data) {
    const work = data.work?.map(job => job.employer?.name || 'N/A').join(', ') || 'N/A';
    const timezone = data.timezone !== undefined ? `GMT ${data.timezone}` : 'N/A';

    return `
╭─────────────⭓
│ 𝗜𝗗: ${data.id || 'N/A'}
│ 𝗟𝗶𝗻𝗸: ${data.link || 'N/A'}
│ 𝗡𝗮𝗺𝗲: ${data.name || 'N/A'}
│ 𝗨𝘀𝗲𝗿𝗻𝗮𝗺𝗲: ${data.username || 'N/A'}
│ 𝗩𝗲𝗿𝗶𝗳𝗶𝗲𝗱: ${data.is_verified ? 'Có' : 'Không'}
│ 𝗖𝗿𝗲𝗮𝘁𝗲𝗱 𝗧𝗶𝗺𝗲: ${formatTimestamp(data.created_time) || 'N/A'}
│ 𝗕𝗶𝗿𝘁𝗵𝗱𝗮𝘆: ${data.birthday || 'N/A'}
│ 𝗚𝗲𝗻𝗱𝗲𝗿: ${data.gender || 'N/A'}
│ 𝗙𝗼𝗹𝗹𝗼𝘄𝗲𝗿𝘀: ${data.subscribers?.summary?.total_count || 'N/A'}
│ 𝗥𝗲𝗹𝗮𝘁𝗶𝗼𝗻𝘀𝗵𝗶𝗽𝘀: ${data.relationship_status || 'N/A'}
│ 𝗛𝗼𝗺𝗲𝘁𝗼𝘄𝗻: ${data.hometown?.name || 'N/A'}
│ 𝗟𝗼𝗰𝗮𝘁𝗶𝗼𝗻: ${data.location?.name || 'N/A'}
│ 𝗪𝗼𝗿𝗸: ${work}
├─────────────⭔
│ 𝗟𝗼𝗰𝗮𝗹𝗲: ${data.locale || 'N/A'}
│ 𝗨𝗽𝗱𝗮𝘁𝗲𝗱 𝗧𝗶𝗺𝗲: ${formatTimestamp(data.updated_time) || 'N/A'}
│ 𝗧𝗶𝗺𝗲 𝗭𝗼𝗻𝗲: ${timezone}
╰─────────────⭓`;
}

async function sendInfoMessage(api, threadId, type, data) {
    const message = formatInfo(data);
    const avatarUrl = data.picture?.data?.url || '';
    const filePath = path.join(__dirname, 'temp', 'fbin4.jpg');

    try {
        const image = await axios.get(avatarUrl, { responseType: 'arraybuffer' });
        fs.writeFileSync(filePath, image.data);

        await api.sendMessage({
            msg: message,
            attachments: filePath
        }, threadId, type);
    } finally {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
}

module.exports.run = async ({ args, event, api }) => {
    const { threadId, type, data } = event;
    const fbId = args[0] || data.content.href;
    if (data?.msgType === 'chat.recommended' && data?.content?.action === 'recommened.link') {
        if (!accessToken()) {
            return api.sendMessage('❌ Admin chưa cấu hình token Facebook (config.yml → services.facebook_access_token).', threadId, type);
        }

        try {
            const baseUrl = services.requireService("facebook_api_url");
            const uid = (await axios.get(`${baseUrl}/facebook/getuid?link=${encodeURIComponent(fbId)}`, { timeout: 30000 })).data.uid;
            const fbData = await getFacebookInfo(uid);
            if (fbData.error) {
                return api.sendMessage("Không tìm thấy thông tin.", threadId, type);
            }
            await sendInfoMessage(api, threadId, type, fbData);
        } catch (err) {
            if (err.notConfigured) {
                return api.sendMessage(`❌ ${err.message}`, threadId, type);
            }
            console.error(err);
            api.sendMessage("Lỗi xảy ra khi lấy thông tin.", threadId, type);
        }
    }

    if (!fbId) {
        return api.sendMessage('Vui lòng nhập UID hoặc link Facebook.', threadId, type);
    }

    if (!accessToken()) {
        return api.sendMessage('❌ Admin chưa cấu hình token Facebook (config.yml → services.facebook_access_token).', threadId, type);
    }

    try {
        const fbData = await getFacebookInfo(fbId);
        if (fbData.error) {
            return api.sendMessage("Không tìm thấy thông tin.", threadId, type);
        }
        await sendInfoMessage(api, threadId, type, fbData);
    } catch (err) {
        console.error(err);
        api.sendMessage("Lỗi xảy ra khi lấy thông tin.", threadId, type);
    }
};
