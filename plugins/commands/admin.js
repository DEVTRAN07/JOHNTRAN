const { updateConfigArray, reloadConfig } = require("../../utils/index");
const metrics = require("../../core/metrics");

module.exports.config = {
  name: 'admin',
  version: '2.0.0',
  role: 2,
  author: 'ᴶᴼᴴᴺ ᵀᴿᴬᴺ',
  description: 'Quản lý admin và support của bot bằng ID hoặc tag.',
  category: 'Hệ thống',
  usage: 'admin <add|rm|sp|rmsp|list> [@tag/ID] (có thể tag nhiều người, nhập nhiều uid cách nhau dấu cách hoặc ,)',
  cooldowns: 2
};

module.exports.run = async ({ args, event, api, Threads, reply }) => {
  const action = args[0]?.toLowerCase();
  const { threadId, type, data } = event;

  let targetIds = [];

  if (data.mentions && Object.keys(data.mentions).length > 0) {
    targetIds = Object.values(data.mentions).map(m => m.uid);
  }

  if (targetIds.length === 0 && args.length > 1) {
    targetIds = args.slice(1)
      .join(" ")
      .split(/[\s,]+/)
      .filter(id => id && !isNaN(id));
  }

  const processAdd = async (listName, label) => {
    if (targetIds.length === 0) return reply.error(`Vui lòng nhập ID hoặc tag người dùng cần thêm làm ${label}.`);

    const currentList = global.users[listName];
    const newIds = targetIds.filter(id => !currentList.includes(id));
    if (newIds.length === 0) return reply.error("Không có người dùng nào mới cần thêm.");

    const updated = [...currentList, ...newIds];
    await updateConfigArray(`${listName}_bot`, updated);
    await reloadConfig();
    metrics.audit(`admin add ${listName}`, event?.data?.uidFrom, newIds.join(","));

    const infos = await Promise.all(newIds.map(id => api.getUserInfo(id).catch(() => null)));
    const names = infos.map((info, i) => `${info?.changed_profiles?.[newIds[i]]?.displayName || "Không rõ"} — ${newIds[i]}`);

    return reply.card({
      theme: "success",
      title: `Đã thêm ${label}`,
      subtitle: `Số lượng: ${newIds.length}`,
      sections: [{ title: "Danh sách", lines: names }],
      footer: global.config.name_bot
    });
  };

  const processRemove = async (listName, label) => {
    if (targetIds.length === 0) return reply.error(`Vui lòng nhập ID hoặc tag người dùng cần gỡ khỏi ${label}.`);

    const currentList = global.users[listName];
    const existing = targetIds.filter(id => currentList.includes(id));
    if (existing.length === 0) return reply.error("Không có người dùng nào trong danh sách hiện tại.");

    const updated = currentList.filter(id => !existing.includes(id));
    await updateConfigArray(`${listName}_bot`, updated);
    await reloadConfig();
    metrics.audit(`admin remove ${listName}`, event?.data?.uidFrom, existing.join(","));

    const infos = await Promise.all(existing.map(id => api.getUserInfo(id).catch(() => null)));
    const names = infos.map((info, i) => `${info?.changed_profiles?.[existing[i]]?.displayName || "Không rõ"} — ${existing[i]}`);

    return reply.card({
      theme: "warn",
      title: `Đã gỡ ${label}`,
      subtitle: `Số lượng: ${existing.length}`,
      sections: [{ title: "Danh sách", lines: names }],
      footer: global.config.name_bot
    });
  };

  switch (action) {
    case "add":
      return processAdd("admin", "admin bot");
    case "rm":
      return processRemove("admin", "admin bot");
    case "sp":
      return processAdd("support", "support bot");
    case "rmsp":
      return processRemove("support", "support bot");

    case "list": {
      const adminList = global.users.admin || [];
      const supportList = global.users.support || [];

      const adminInfos = await Promise.all(adminList.map(id => api.getUserInfo(id).catch(() => null)));
      const supportInfos = await Promise.all(supportList.map(id => api.getUserInfo(id).catch(() => null)));

      const adminLines = adminInfos.length > 0
        ? adminInfos.map((info, i) => `👑 ${info?.changed_profiles?.[adminList[i]]?.displayName || "(Không rõ)"} — ${adminList[i]}`)
        : ["Không có admin nào."];
      const supportLines = supportInfos.length > 0
        ? supportInfos.map((info, i) => `🛠️ ${info?.changed_profiles?.[supportList[i]]?.displayName || "(Không rõ)"} — ${supportList[i]}`)
        : ["Không có support nào."];

      return reply.card({
        theme: "brand",
        title: "Danh sách quản trị",
        subtitle: `Admin: ${adminList.length} • Support: ${supportList.length}`,
        sections: [
          { title: "Admin Bot", lines: adminLines },
          { title: "Support Bot", lines: supportLines }
        ],
        footer: global.config.name_bot
      });
    }

    case "adminonly":
    case "supportonly":
    case "boxonly": {
      const keyMap = {
        adminonly: "admin_only",
        supportonly: "support_only",
        boxonly: "box_only"
      };

      const key = keyMap[action.toLowerCase()];

      const threadData = await Threads.getData(threadId);
      const currentValue = threadData.data[key] || false;

      const newValue = !currentValue;
      threadData.data[key] = newValue;
      await Threads.setData(threadId, threadData.data);

      return reply.success(`Đã ${newValue ? "bật" : "tắt"} chế độ ${key.replace("_", " ")}.`);
    }

    default:
      return reply.card({
        theme: "brand",
        title: "Quản lý admin bot",
        sections: [{ title: "Lệnh", lines: [
          "admin add [@tag/ID...] — Thêm admin",
          "admin rm [@tag/ID...] — Gỡ admin",
          "admin sp [@tag/ID...] — Thêm support",
          "admin rmsp [@tag/ID...] — Gỡ support",
          "admin list — Xem danh sách",
          "admin adminonly — Bật/tắt chỉ admin dùng bot",
          "admin supportonly — Bật/tắt chỉ support dùng bot",
          "admin boxonly — Bật/tắt chỉ cho phép trong nhóm"
        ]}],
        footer: global.config.name_bot
      });
  }
};
