const { getData, saveData, hasData, delData, allData } = require('../../utils/db');
const logger = require('../../utils/logger');

module.exports = {
  getAll: () => {
    return allData('Threads').map((row) => ({
      threadId: row.threadId,
      data: row.data || {}
    }));
  },

  getData: async (threadId) => {
    const existing = hasData('Threads', 'threadId', threadId);
    if (!existing) {
      module.exports.createData(threadId, { ban: false, admin_only: false, support_only: false, box_only: false, prefix: global.config.prefix });
      logger.log("Đã tạo database cho nhóm: " + threadId, "info");
    }
    return getData('Threads', 'threadId', threadId);
  },

  setData: (threadId, data) => {
    saveData('Threads', 'threadId', threadId, data);
  },

  delData: (threadId) => {
    if (hasData('Threads', 'threadId', threadId)) {
      delData('Threads', 'threadId', threadId);
    }
  },

  createData: (threadId, defaultData = {}) => {
    if (!hasData('Threads', 'threadId', threadId)) {
      saveData('Threads', 'threadId', threadId, defaultData);
    }
  }
};
