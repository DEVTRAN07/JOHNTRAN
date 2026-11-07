const fs = require('fs');
const path = require('path');

const ECONOMY_PATH = path.join(process.cwd(), 'data', 'game', 'economy.json');
const DEFAULTS = { startCoins: 1000, dailyBonus: 500, minBet: 10, maxBet: 100000 };

function loadConfig() {
  try {
    const raw = fs.readFileSync(ECONOMY_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return { ...DEFAULTS, ...parsed };
  } catch (e) {
    return { ...DEFAULTS };
  }
}

const CONFIG = loadConfig();
const START_COINS = Number.isFinite(CONFIG.startCoins) ? CONFIG.startCoins : DEFAULTS.startCoins;
const DAILY_BONUS = Number.isFinite(CONFIG.dailyBonus) ? CONFIG.dailyBonus : DEFAULTS.dailyBonus;

function uidStr(uid) {
  return String(uid);
}

function normalizeAmount(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.floor(n);
}

function recordOf(Users, uid) {
  const id = uidStr(uid);
  const record = Users.getData(id);
  if (!record) return null;
  if (!record.data || typeof record.data !== 'object') record.data = {};
  return record;
}

function getCoins(Users, uid) {
  const record = recordOf(Users, uid);
  if (!record) return 0;
  const c = record.data.coins;
  return Number.isFinite(c) && c >= 0 ? Math.floor(c) : 0;
}

function ensureWallet(Users, uid) {
  const id = uidStr(uid);
  const record = recordOf(Users, id);
  if (record.data.coins === undefined || !Number.isFinite(record.data.coins) || record.data.coins < 0) {
    record.data.coins = START_COINS;
  }
  if (record.data.coins < 0) record.data.coins = 0;
  Users.setData(id, record.data);
  return record.data.coins;
}

function addCoins(Users, uid, amount, reason) {
  const id = uidStr(uid);
  const n = normalizeAmount(amount);
  if (n === null) return { ok: false, balance: getCoins(Users, id), reason: 'invalid amount' };
  ensureWallet(Users, id);
  const record = recordOf(Users, id);
  record.data.coins = (record.data.coins || 0) + n;
  Users.setData(id, record.data);
  return { ok: true, balance: record.data.coins, reason: reason || null };
}

function canAfford(Users, uid, amount) {
  const n = normalizeAmount(amount);
  if (n === null) return false;
  return getCoins(Users, uid) >= n;
}

function takeCoins(Users, uid, amount) {
  const id = uidStr(uid);
  const n = normalizeAmount(amount);
  if (n === null) return { ok: false, balance: getCoins(Users, id), reason: 'invalid amount' };
  ensureWallet(Users, id);
  const record = recordOf(Users, id);
  if ((record.data.coins || 0) < n) {
    return { ok: false, balance: record.data.coins || 0, reason: 'insufficient' };
  }
  record.data.coins -= n;
  Users.setData(id, record.data);
  return { ok: true, balance: record.data.coins };
}

function formatCoins(n) {
  const v = Number.isFinite(n) ? Math.floor(n) : 0;
  return v.toLocaleString('en-US');
}

function vnDayString() {
  const d = new Date();
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
}

function dailyClaim(Users, uid) {
  const id = uidStr(uid);
  ensureWallet(Users, id);
  const record = recordOf(Users, id);
  const today = vnDayString();
  if (record.data.lastDailyCoins === today) {
    return { ok: false, claimed: false, bonus: 0, balance: record.data.coins, reason: 'already claimed' };
  }
  record.data.coins = (record.data.coins || 0) + DAILY_BONUS;
  record.data.lastDailyCoins = today;
  Users.setData(id, record.data);
  return { ok: true, claimed: true, bonus: DAILY_BONUS, balance: record.data.coins, reason: null };
}

module.exports = {
  START_COINS,
  DAILY_BONUS,
  CONFIG,
  getCoins,
  ensureWallet,
  addCoins,
  takeCoins,
  canAfford,
  formatCoins,
  dailyClaim
};
