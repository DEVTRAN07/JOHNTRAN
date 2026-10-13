const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { ThreadType } = require("zalo-client");

const autosendgif = require('../../assets/autosend.json');

module.exports.config = {
  name: 'autosend',
  version: '1.1.0',
  role: 1,
  author: 'ShinTHL09',
  description: 'Tự động gửi tin nhắn theo giờ đã cài và tự xóa sau 5 phút',
  category: "Tiện ích",
  usage: 'autosend [on|off|status|test]',
  cooldowns: 2
};

// Danh sách thời gian và nội dung tự động gửi
const setting = [
  {
    timer: '07:10:00 AM',
    message: [
      'Chúc mọi người buổi sáng vui vẻ😉',
      'Buổi sáng đầy năng lượng nhaa các bạn😙',
      'Dậy đi học và đi làm nào mọi người ơi😁',
      'Dậy sớm thành công rồi đó, cố lên nhé!💪'
    ]
  },
  {
    timer: '08:00:00 AM',
    message: [
      'Dậy đê ngủ như heo😒',
      'Tính nướng tới bao giờ đây😠',
      'Ai chưa dậy thì lỡ giờ học giờ làm ráng chịu đó nha🤨'
    ]
  },
  {
    timer: '11:30:00 AM',
    message: [
      'Chúc mọi người buổi trưa vui vẻ😋',
      'Cả sáng mệt mỏi rùi nghỉ ngơi nạp năng lượng nào!!😴',
      'Đến giờ ăn trưa rồi nè, đừng bỏ bữa nhé🍱'
    ]
  },
  {
    timer: '01:00:00 PM',
    message: [
      'Chúc mọi người buổi chiều vui vẻ🙌',
      'Chúc mọi người buổi chiều đầy năng lượng😼',
      'Nghỉ trưa xíu rồi bắt đầu buổi chiều nha😇'
    ]
  },
  {
    timer: '05:00:00 PM',
    message: [
      'Hết giờ làm rồi về nhà thôi mọi người 😎',
      'Chiều rồi, xả stress thôi nào 🎉',
      'Đi làm hay đi học về nhớ tắm rửa ăn uống nha 🚿🍚'
    ]
  },
  {
    timer: '07:16:00 PM',
    message: [
      'Tối rồi, nghỉ ngơi đi mọi người 🥱',
      'Tối nay có ai rảnh đi chơi hông nè? 😜',
      'Nhớ ăn tối đầy đủ nhé, giữ sức khỏe 💪'
    ]
  },
  {
    timer: '10:00:00 PM',
    message: [
      'Khuya ròi ngủ đuy😴',
      'Tới giờ lên giường ngủ rùi😇',
      'Ngủ sớm cho da đẹp dáng xinh nha💤'
    ]
  },
  {
    timer: '11:00:00 PM',
    message: [
      'Chúc mọi người ngủ ngon😴',
      'Khuya rùi ngủ ngon nhé các bạn😇',
      'Tắt điện thoại và đi ngủ thôi 📴🛌'
    ]
  },
  {
    timer: '12:00:00 AM',
    message: [
      'Bây giờ bot sẽ ngủ😗',
      'Bot ngủ đây tạm biệt mọi người😘',
      'Chúc ai còn thức một đêm an yên nhé🌙'
    ]
  }
];

const form = `➢𝐍𝐨𝐭𝐢𝐟𝐢𝐜𝐚𝐭𝐢𝐨𝐧🏆
 ➝ Bây Giờ Là: %time_now
 ➝ Đây Là Tin Nhắn Tự Động
 ━━━━━━━━━━━
 [ 𝗡𝗢̣̂𝗜 𝗗𝗨𝗡𝗚 ]  %content`;

const GIF_TIMEOUT = 20000; // tải ảnh tối đa 20s — không được chặn việc gửi tin

module.exports.onLoad = async function ({ api, Threads }) {
  const tempPath = path.join(__dirname, 'temp');
  if (!fs.existsSync(tempPath)) fs.mkdirSync(tempPath, { recursive: true });

  // Dọn ảnh autosend cũ sót lại (nếu lần trước crash giữa lúc gửi)
  try {
    const stale = fs.readdirSync(tempPath).filter((f) => f.startsWith('autosend.'));
    for (const file of stale) fs.unlinkSync(path.join(tempPath, file));
  } catch { /* bỏ qua */ }

  setInterval(autosend, 1000);

  // Khớp theo PHÚT (trước khớp theo giây → setInterval trôi là bỏ lỡ cả khung giờ)
  function currentHm() {
    const vn = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
    return String(vn.getHours()).padStart(2, '0') + ':' + String(vn.getMinutes()).padStart(2, '0');
  }

  function timerToHm(timer) {
    const m = String(timer).match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/i);
    if (!m) return null;
    let h = parseInt(m[1], 10);
    const mm = m[2];
    const ap = (m[3] || '').toUpperCase();
    if (ap === 'PM' && h < 12) h += 12;
    if (ap === 'AM' && h === 12) h = 0;
    return String(h).padStart(2, '0') + ':' + mm;
  }

  let lastFiredSlot = '';

  async function autosend() {
    // Phòng thủ: api mất kết nối thì bỏ qua tick này (không crash interval)
    if (!api || typeof api.getAllGroups !== "function") return;

    const hm = currentHm();
    const matched = setting.find(item => timerToHm(item.timer) === hm);
    if (!matched) return;
    if (lastFiredSlot === hm) return; // đã gửi trong phút này rồi
    lastFiredSlot = hm;

    const randomMessage = matched.message[Math.floor(Math.random() * matched.message.length)];
    const msg = form
      .replace(/%time_now/g, matched.timer)
      .replace(/%content/g, randomMessage);

    const filePath = path.join(tempPath, 'autosend.gif');

    // Ảnh gif là phần TRANG TRÍ: tải không được thì vẫn phải gửi được tin nhắn
    let hasGif = false;
    try {
      const imageUrl = autosendgif[Math.floor(Math.random() * autosendgif.length)];
      const res = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: GIF_TIMEOUT,
        headers: {
          'User-Agent': 'Mozilla/5.0',
          'Referer': 'https://imgur.com/',
          'Accept': 'image/*,*/*;q=0.8'
        }
      });
      if (res.data && res.data.length > 0) {
        fs.writeFileSync(filePath, res.data);
        hasGif = true;
      }
    } catch (err) {
      console.error("Lỗi tải ảnh autosend (vẫn gửi tin nhắn):", err.message);
    }

    try {
      const allGroups = await api.getAllGroups();
      const allBoxIDs = Object.keys(allGroups?.gridVerMap || {});
      console.log(`[AUTOSEND] ${matched.timer} → ${allBoxIDs.length} nhóm được quét`);

      let sentCount = 0;
      for (const Group of allBoxIDs) {
        const Thread = await Threads.getData(Group);
        if (!Thread?.data?.auto_send) continue;
        try {
          await api.sendMessage({
            msg: msg,
            ...(hasGif ? { attachments: filePath } : {})
          }, Thread.threadId, ThreadType.Group);
          sentCount++;
        } catch (err) {
          console.log(`Không gửi được tới threadId ${Thread?.threadId}: ${err.message}`);
        }
      }
      console.log(`[AUTOSEND] ${hm} → đã gửi ${sentCount}/${allBoxIDs.length} nhóm`);
      if (sentCount === 0) console.log("Autosend: không có nhóm nào bật tính năng này");
    } finally {
      try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch { /* bỏ qua */ }
    }
  }
};

module.exports.run = async ({ api, event, args, Threads }) => {
  const { threadId, type } = event;

  if (type === ThreadType.User) return api.sendMessage({ msg: "❌ Lệnh chỉ có thể dùng trong nhóm", plain: true }, threadId, type);

  const action = (args[0] || "").toLowerCase();

  // ===== TEST: gửi NGAY tin thử (không cần đợi khung giờ) =====
  if (action === "test" || action === "thu") {
    const current = (await Threads.getData(threadId)).data || {};
    if (!current.auto_send) {
      return api.sendMessage({ msg: "⚠️ Nhóm này chưa bật autosend. Gõ `autosend on` trước đã.", plain: true }, threadId, type);
    }
    const slot = setting[0];
    const randomMessage = slot.message[Math.floor(Math.random() * slot.message.length)];
    const msg = form.replace(/%time_now/g, slot.timer).replace(/%content/g, randomMessage);
    try {
      await api.sendMessage({ msg }, threadId, type);
      return api.sendMessage({ msg: "✅ Đã gửi tin thử autosend. Nếu thấy tin ở trên là tính năng hoạt động.", plain: true, ttl: 60000 }, threadId, type);
    } catch (error) {
      return api.sendMessage({ msg: `❌ Gửi thất bại: ${error.message}`, plain: true, ttl: 60000 }, threadId, type);
    }
  }

  const current = (await Threads.getData(threadId)).data || {};

  // Không bật/tắt hàng loạt mọi nhóm — chỉ nhóm đang gọi lệnh mới điều khiển được
  if (args[0] === "all") {
    return api.sendMessage(
      { msg: "❌ Không thể bật hàng loạt. Autosend chỉ bật/tắt trong từng nhóm: gõ `autosend on` / `autosend off` trong nhóm muốn điều khiển.", plain: true },
      threadId, type
    );
  }

  let status;

  if (action === "on" || action === "off") {
    // on/off tường minh: luôn đặt đúng trạng thái (không toggle ngược)
    status = action === "on";
  } else if (action === "status" || action === "stt") {
    const slots = setting.map((s) => s.timer.replace(/:00\s*(AM|PM)$/i, " $1")).join(", ");
    return api.sendMessage(
      { msg: `📩 Autosend nhóm này: ${current.auto_send ? "ĐANG BẬT ✅" : "ĐANG TẮT ❌"}\nDùng: autosend on / autosend off\nGõ autosend test để gửi tin thử ngay lập tức.\n\n⏰ Các khung giờ gửi: ${slots}`, plain: true, ttl: 120000 },
      threadId, type
    );
  } else {
    // không tham số → toggle
    status = !current.auto_send;
  }

  const data = (await Threads.getData(threadId)).data || {};
  data.auto_send = status;
  await Threads.setData(threadId, data);

  return api.sendMessage(
    { msg: `📩 Autosend đã được ${status ? "bật ✅" : "tắt ❌"} cho nhóm này.`, plain: true },
    threadId, type
  );
};
