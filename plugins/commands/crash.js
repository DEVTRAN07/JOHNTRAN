const fs = require('fs');
const path = require('path');
const wallet = require('../../core/gameWallet');
function getPixelfx() { try { return require('../../core/pixelfx'); } catch { return null; } }

const CONFIG_PATH = path.join(process.cwd(), 'data', 'game', 'crash.json');
const sessions = new Map();

const DEFAULT_CONFIG = {
  minBet: 10,
  maxBet: 50000,
  houseEdge: 0.97,
  maxMultiplier: 100
};

function loadConfig() {
  try {
    const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    return { ...DEFAULT_CONFIG, ...raw };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

function keyOf(threadId, uid) {
  return `${threadId}:${uid}`;
}

function fmt(n) {
  return wallet.formatCoins(n);
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function parseBet(v) {
  if (v == null) return null;
  const n = Number(String(v).trim().replace(/[,._\s]/g, ''));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.floor(n);
}

async function sendFx(api, threadId, type, msg, fxId) {
  const pixelfx = getPixelfx();
  if (!pixelfx) { try { await api.sendMessage({ msg }, threadId, type); } catch {} return; }
  let attachment;
  try {
    const fx = await pixelfx.renderFxGif(fxId, { fps: 12, frames: 10, scale: 2 });
    attachment = fx.path;
    await api.sendMessage({ msg, attachments: [attachment] }, threadId, type);
  } catch {
    try { await api.sendMessage({ msg }, threadId, type); } catch {}
  } finally {
    if (attachment) pixelfx.cleanup(attachment);
  }
}

async function sendMsg({ api, threadId, type, reply }, msg, fxId) {
  if (fxId) return sendFx(api, threadId, type, msg, fxId);
  try {
    if (reply && typeof reply === 'function') return await reply(msg);
    return await api.sendMessage({ msg }, threadId, type);
  } catch {
    try { await api.sendMessage({ msg }, threadId, type); } catch {}
  }
}

function multAt(session, now) {
  const t = (now - session.startedAt) / 1000;
  const m = 1 + t * 0.6667;
  return Math.min(m, session.crashAt - 0.01);
}

module.exports.config = {
  name: 'crash',
  aliases: ['cr'],
  role: 0,
  category: 'Game',
  cooldowns: 2,
  description: 'Game Crash/Aviator: đặt cược, rút tiền trước khi crash.',
  usage: '/crash <bet> | /crash cashout | /crash info | /crash daily'
};

module.exports.run = async function ({ api, event, args = [], reply, Users }) {
  const cfg = loadConfig();
  const { threadId, type, data } = event || {};
  const uid = String(data?.uidFrom || event?.senderID || '');
  if (!uid || !threadId) return;

  const ctx = { api, threadId, type, reply };
  const send = (msg, fxId) => sendMsg(ctx, msg, fxId);
  const sessionKey = keyOf(threadId, uid);
  const active = sessions.get(sessionKey);

  const sub = String(args[0] || '').toLowerCase();

  if (!sub || sub === 'help' || sub === 'info') {
    return send(`✈️ Crash/Aviator\n• /crash <bet> bắt đầu\n• /crash cashout|rut|co rút tiền\n• /crash daily nhận thưởng\nCấu hình: min ${fmt(cfg.minBet)} max ${fmt(cfg.maxBet)} max x${cfg.maxMultiplier}`);
  }

  if (sub === 'daily') {
    const res = wallet.dailyClaim(Users, uid);
    if (!res.ok || !res.claimed) {
      return send(`⏳ Bạn đã nhận thưởng hôm nay rồi.\n• Số dư: ${fmt(res.balance != null ? res.balance : wallet.getCoins(Users, uid))} coins`);
    }
    return send(`🎁 Nhận thưởng hằng ngày: +${fmt(res.bonus)} coins\n• Số dư: ${fmt(res.balance)} coins`, 'ui/coin-collect');
  }

  if (['cashout', 'rut', 'rút', 'co'].includes(sub)) {
    const session = sessions.get(sessionKey);
    if (!session || session.cashedOut) return send('❌ Không có ván Crash đang chơi.');
    if (session._crashed) return send('💥 Đã crash rồi, không thể rút.');
    session.cashedOut = true;
    const now = Date.now();
    const mult = multAt(session, now);
    const crashTime = session.startedAt + session.crashAt * 1200;
    if (now >= crashTime || mult >= session.crashAt - 0.01) {
      session._crashed = true;
      sessions.delete(sessionKey);
      return send(`💥 Quá muộn! Máy bay đã crash ở x${session.crashAt.toFixed(2)}.\n• Mất cược: ${fmt(session.bet)} coins`, 'impacts/ground-slam');
    }
    const payout = Math.floor(session.bet * mult);
    const added = wallet.addCoins(Users, uid, payout, 'crash cashout');
    session.cashoutAt = now;
    session.multiplierAtCashout = mult;
    sessions.delete(sessionKey);
    const big = mult >= 5;
    return send(`💰 RÚT THÀNH CÔNG!\n• Hệ số: x${mult.toFixed(2)}\n• Nhận: ${fmt(payout)} coins\n• Số dư: ${fmt(added.balance)} coins`, big ? 'impacts/crit-hit' : 'ui/coin-collect');
  }

  // start
  let betArg = sub === 'bet' ? args[1] : args[0];
  const bet = parseBet(betArg);
  if (bet === null) return send('❌ Cược không hợp lệ. Ví dụ: /crash 100');

  if (active && !active.cashedOut && !active._crashed) {
    return send('❌ Bạn đang có ván Crash chưa kết thúc. Dùng /crash cashout để rút.');
  }

  wallet.ensureWallet(Users, uid);
  if (bet < cfg.minBet || bet > cfg.maxBet) {
    return send(`❌ Cược phải từ ${fmt(cfg.minBet)} đến ${fmt(cfg.maxBet)} coins.`);
  }
  if (!wallet.canAfford(Users, uid, bet)) {
    return send(`❌ Không đủ coins. Số dư: ${fmt(wallet.getCoins(Users, uid))} coins.`);
  }
  wallet.takeCoins(Users, uid, bet);

  const houseEdge = cfg.houseEdge || 0.97;
  const crashPoint = clamp((10000 / (Math.random() * 10000 + 1)) / houseEdge, 1.0, cfg.maxMultiplier);

  const session = {
    bet,
    startedAt: Date.now(),
    crashAt: crashPoint,
    cashedOut: false,
    cashoutAt: null,
    multiplierAtCashout: null,
    _crashed: false
  };
  sessions.set(sessionKey, session);

  const crashTime = session.startedAt + session.crashAt * 1200;
  const timeout = setTimeout(() => {
    const s = sessions.get(sessionKey);
    if (!s || s.cashedOut || s._crashed) return;
    s._crashed = true;
    sessions.delete(sessionKey);
    send(`💥 CRASH! Máy bay rơi ở x${s.crashAt.toFixed(2)}.\n• Mất cược: ${fmt(s.bet)} coins\n• Số dư: ${fmt(wallet.getCoins(Users, uid))} coins`, 'impacts/ground-slam');
  }, Math.max(0, crashTime - Date.now()));

  session._timeout = timeout;

  return send(`✈️ Bắt đầu! Cược ${fmt(bet)} coins.\n• Hệ số hiện tại x1.00\n• Crash tại x? (ẩn)\nDùng /crash cashout để rút.`, 'moves/dash-strike');
};

