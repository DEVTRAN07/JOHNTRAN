const { getData, saveData, hasData, delData, allData } = require('../../utils/db');
const logger = require('../../utils/logger');

const DEFAULT_USER = () => ({ ban: false });

module.exports = {
  getAll: () => {
    return allData('Users').map((row) => ({
      userId: row.userId,
      data: row.data || {}
    }));
  },

  getData: (userId) => {
    const existing = hasData('Users', 'userId', userId);
    if (!existing) {
      module.exports.createData(userId, DEFAULT_USER());
      logger.log("Đã tạo database cho người dùng: " + userId, "info");
    }
    return getData('Users', 'userId', userId);
  },

  setData: (userId, data) => {
    saveData('Users', 'userId', userId, data);
  },

  delData: (userId) => {
    if (hasData('Users', 'userId', userId)) {
      delData('Users', 'userId', userId);
    }
  },

  createData: (userId, defaultData = {}) => {
    if (!hasData('Users', 'userId', userId)) {
      saveData('Users', 'userId', userId, defaultData);
    }
  },

  isBanned: (userId) => {
    const record = getData('Users', 'userId', userId);
    return Boolean(record?.data?.ban);
  },

  setBan: (userId, banned) => {
    const data = module.exports.getData(userId).data || {};
    data.ban = Boolean(banned);
    module.exports.setData(userId, data);
  }
};
