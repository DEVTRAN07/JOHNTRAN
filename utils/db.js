const path = require("path");
const { JsonStore } = require("../core/storage");

// Mỗi bot con có thể dùng DB riêng qua biến môi trường JT_DB_FILE (panel bot con)
const dbFile = process.env.JT_DB_FILE || path.join(__dirname, "..", "data", "store.json");

const db = new JsonStore(dbFile, ["Users", "Threads"]);

function getData(table, idField, id) {
  return db.get(table, idField, id);
}

function saveData(table, idField, id, dataObj, extra = {}) {
  return db.set(table, idField, id, dataObj, extra);
}

function hasData(table, idField, id) {
  return db.has(table, idField, id);
}

function delData(table, idField, id) {
  return db.delete(table, idField, id);
}

function allData(table) {
  return db.all(table);
}

module.exports = {
  getData,
  saveData,
  hasData,
  delData,
  allData,
  db,
  flush: () => db.flushSync()
};
