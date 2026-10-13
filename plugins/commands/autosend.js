const { ThreadType } = require("zalo-client");

module.exports.config = {
  name: 'autosend',
  version: '2.0.0',
  role: 1,
  author: 'ᴶᴼᴴᴺ ᵀᴿᴬᴺ',
  description: 'Tự động gửi tin nhắn 1 tiếng/lần cho nhóm đã bật',
  category: "Tiện ích",
  usage: 'autosend [on|off|status|test]',
  cooldowns: 2
};

// Mỗi nhóm bật autosend nhận 1 tin/giờ. Thời điểm gửi ghi vào data nhóm
// (Supabase) nên restart bot không gửi lại, không bỏ lỡ.
const SEND_INTERVAL = 60 * 60 * 1000; // 1 tiếng
const TICK_INTERVAL = 60 * 1000;     // quét mỗi phút
const INITIAL_DELAY = 5 * 1000;      // chờ bot ổn định sau khi bật

// Kho tin nhắn — random mỗi lần gửi
const MESSAGES = [
  'Chúc mọi người buổi sáng vui vẻ😉',
  'Buổi sáng đầy năng lượng nhaa các bạn😙',
  'Dậy đi học và đi làm nào mọi người ơi😁',
  'Dậy sớm thành công rồi đó, cố lên nhé!💪',
  'Chúc mọi người buổi trưa vui vẻ😋',
  'Cả sáng mệt mỏi rùi nghỉ ngơi nạp năng lượng nào!!😴',
  'Đến giờ ăn trưa rồi nè, đừng bỏ bữa nhé🍱',
  'Chúc mọi người buổi chiều vui vẻ🙌',
  'Chúc mọi người buổi chiều đầy năng lượng😼',
  'Nghỉ trưa xíu rồi bắt đầu buổi chiều nha😇',
  'Hết giờ làm rồi về nhà thôi mọi người 😎',
  'Chiều rồi, xả stress thôi nào 🎉',
  'Đi làm hay đi học về nhớ tắm rửa ăn uống nha 🚿🍚',
  'Tối rồi, nghỉ ngơi đi mọi người 🥱',
  'Tối nay có ai rảnh đi chơi hông nè? 😜',
  'Nhớ ăn tối đầy đủ nhé, giữ sức khỏe 💪',
  'Khuya ròi ngủ đuy😴',
  'Tới giờ lên giường ngủ rùi😇',
  'Ngủ sớm cho da đẹp dáng xinh nha💤',
  'Chúc mọi người ngủ ngon😴',
  'Khuya rùi ngủ ngon nhé các bạn😇',
  'Tắt điện thoại và đi ngủ thôi 📴🛌'
];

function randomMessage() {
  return MESSAGES[Math.floor(Math.random() * MESSAGES.length)];
}

function vnTime() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" }));
}

// Thời gian còn lại tới lần gửi kế tiếp (cho lệnh status)
function nextSendText(last) {
  if (!last) return "sắp gửi (trong vài phút tới)";
  const remain = SEND_INTERVAL - (Date.now() - Number(last));
  if (remain <= 0) return "sắp gửi (trong vài phút tới)";
  const minutes = Math.ceil(remain / 60000);
  return minutes >= 60 ? `${Math.floor(minutes / 60)} tiếng ${minutes % 60} phút nữa` : `${minutes} phút nữa`;
}

module.exports.onLoad = async function ({ api, Threads }) {
  let sending = false; // chặn tick chồng nhau nếu tick trước chưa xong

  const autosend = async () => {
    if (sending) return;
    sending = true;
    try {
      // Phòng thủ: api mất kết nối thì bỏ qua tick này
      if (!api || typeof api.getAllGroups !== "function") return;

      const allGroups = await api.getAllGroups();
      const allBoxIDs = Object.keys(allGroups?.gridVerMap || {});
      if (allBoxIDs.length === 0) return;

      const now = Date.now();
      let sentCount = 0;

      for (const groupId of allBoxIDs) {
        try {
          const thread = await Threads.getData(groupId);
          if (!thread?.data?.auto_send) continue;

          const last = Number(thread.data.auto_send_last) || 0;
          if (now - last < SEND_INTERVAL) continue; // chưa tới giờ

          const t = vnTime();
          const msg =
            `➢ 𝐍𝐨𝐭𝐢𝐟𝐢𝐜𝐚𝐭𝐢𝐨𝐧 🏆\n` +
            `➝ Bây Giờ Là: ${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}\n` +
            `➝ Đây Là Tin Nhắn Tự Động (1 tiếng/lần)\n` +
            `━━━━━━━━━━\n` +
            `[ 𝗡𝗢̣̂𝗜 𝗗𝗨𝗡𝗚 ]  ${randomMessage()}`;

          await api.sendMessage({ msg }, thread.threadId, ThreadType.Group);

          // GHI NHỚ thời điểm gửi — restart/deploy không gửi lại
          thread.data.auto_send_last = Date.now();
          await Threads.setData(groupId, thread.data);
          sentCount++;
        } catch (err) {
          console.log(`Autosend: không gửi được tới nhóm ${groupId}: ${err.message}`);
        }
      }

      if (sentCount > 0) {
        console.log(`[AUTOSEND] ${new Date().toLocaleTimeString("vi-VN")} → đã gửi ${sentCount}/${allBoxIDs.length} nhóm`);
      }
    } catch (err) {
      console.log("Autosend tick lỗi (bỏ qua):", err.message);
    } finally {
      sending = false;
    }
  };

  // Tick đầu sau vài giây (bot vừa khởi động — nhóm nào tới giờ thì gửi ngay)
  setTimeout(() => {
    autosend();
    setInterval(autosend, TICK_INTERVAL).unref();
  }, INITIAL_DELAY);
};

module.exports.run = async ({ api, event, args, Threads }) => {
  const { threadId, type } = event;

  if (type === ThreadType.User) {
    return api.sendMessage({ msg: "❌ Lệnh chỉ có thể dùng trong nhóm", plain: true }, threadId, type);
  }

  const action = (args[0] || "").toLowerCase();

  // ===== TEST: gửi ngay 1 tin thử (không đợi 1 tiếng) =====
  if (action === "test" || action === "thu") {
    const current = (await Threads.getData(threadId)).data || {};
    if (!current.auto_send) {
      return api.sendMessage({ msg: "⚠️ Nhóm này chưa bật autosend. Gõ `autosend on` trước đã.", plain: true }, threadId, type);
    }
    try {
      await api.sendMessage({ msg: `📩 Tin thử autosend\nNếu thấy tin này là tính năng hoạt động.` }, threadId, type);
    } catch (error) {
      return api.sendMessage({ msg: `❌ Gửi thất bại: ${error.message}`, plain: true, ttl: 60000 }, threadId, type);
    }
    return;
  }

  const current = (await Threads.getData(threadId)).data || {};
  // getData trả SHALLOW copy: current.data và data phía dưới là CÙNG object —
  // ghi nhớ trạng thái cũ bằng flag riêng trước khi mutate.
  const wasEnabled = Boolean(current.auto_send);

  if (args[0] === "all") {
    return api.sendMessage(
      { msg: "❌ Không thể bật hàng loạt. Autosend chỉ bật/tắt trong từng nhóm: gõ `autosend on` / `autosend off` trong nhóm muốn điều khiển.", plain: true },
      threadId, type
    );
  }

  let status;
  if (action === "on" || action === "off") {
    status = action === "on";
  } else if (action === "status" || action === "stt") {
    return api.sendMessage(
      {
        msg: `📩 Autosend nhóm này: ${current.auto_send ? "ĐANG BẬT ✅" : "ĐANG TẮT ❌"}\n` +
             `⏱️ Nhịp gửi: 1 tiếng/lần — lần kế tiếp: ${nextSendText(current.auto_send_last)}\n` +
             `Gõ autosend test để gửi tin thử ngay.`,
        plain: true,
        ttl: 120000
      },
      threadId, type
    );
  } else {
    status = !current.auto_send; // không tham số → toggle
  }

  const data = (await Threads.getData(threadId)).data || {};
  data.auto_send = status;
  if (status && !data.auto_send_last) {
    // Bật lần đầu: ghi mốc "đã gửi" nhẹ nhàng — tin đầu tiên sẽ tới sau
    // 1 giây của tick kế tiếp (INITIAL_DELAY/TICK), không spam ngay.
    data.auto_send_last = Date.now();
  }
  await Threads.setData(threadId, data);

  // Bật xong gửi ngay 1 tin để người dùng THẤY nó chạy (lần đầu mỗi nhóm)
  if (status && !wasEnabled) {
    try {
      const t = vnTime();
      await api.sendMessage(
        {
          msg: `➢ 𝐍𝐨𝐭𝐢𝐟𝐢𝐜𝐚𝐭𝐢𝐨𝐧 🏆\n` +
               `➝ Bây Giờ Là: ${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}\n` +
               `➝ Đây Là Tin Nhắn Tự Động (1 tiếng/lần)\n` +
               `━━━━━━━━━━\n` +
               `[ 𝗡𝗢̣̂𝗜 𝗗𝗨𝗡𝗚 ]  ${randomMessage()}`
        },
        threadId, type
      );
    } catch (error) {
      console.log("Autosend: gửi tin bật lập tức thất bại:", error.message);
    }
  }

  return api.sendMessage(
    { msg: `📩 Autosend đã được ${status ? "bật ✅ (1 tiếng/lần)" : "tắt ❌"} cho nhóm này.`, plain: true },
    threadId, type
  );
};
