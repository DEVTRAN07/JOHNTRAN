const fs = require('fs');
const path = require('path');
const wallet = require('../../core/gameWallet');
const pixelfx = require('../../core/pixelfx');

const CONFIG_PATH = path.join(process.cwd(), 'data', 'game', 'tower.json');
const sessions = new Map();

const DEFAULT_CONFIG = {
  minBet: 10,
  maxBet: 100000,
  maxFloors: 10,
  difficulties: {
    easy: { name: 'Dễ', tiles: 3, bombs: 1, multipliers: [1.25, 1.55, 1.95, 2.45, 3.1, 3.95, 5.1, 6.6, 8.6, 11.2] },
    medium: { name: 'Trung bình', tiles: 4, bombs: 1, multipliers: [1.45, 1.95, 2.65, 3.65, 5.1, 7.2, 10.3, 14.9, 21.8, 32.0] },
    hard: { name: 'Khó', tiles: 5, bombs: 2, multipliers: [1.8, 2.8, 4.4, 7.0, 11.3, 18.5, 30.5, 50.8, 85.0, 143.0] }
  }
};

function loadConfig() {
  try {
    return { ...DEFAULT_CONFIG, ...JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')) };
  } catch {
    return DEFAULT_CONFIG;
  }
}

function keyOf(threadId, uid) {
  return `${threadId}:${uid}`;
}

function fmt(n) {
  return wallet.formatCoins(n);
}

function parsePositiveInt(v) {
  if (v == null) return null;
  const n = Number(String(v).replace(/[,._\s]/g, ''));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.floor(n);
}

function pickFx(event, floor, wonBig) {
  if (event === 'loss') return Math.random() < 0.5 ? 'impacts/blunt-hit' : 'impacts/ground-slam';
  if (event === 'cashout') return wonBig ? 'impacts/crit-hit' : 'ui/quest-complete';
  if (event === 'start') return 'moves/dash-strike';
  return Math.random() < 0.5 ? 'ui/coin-collect' : 'moves/dash-strike';
}

async function sendFx(api, threadId, type, msg, fxId) {
  let attachment;
  try {
    const fx = await pixelfx.renderFxGif(fxId, { fps: 12, frames: 10, scale: 2 });
    attachment = fx.path;
    await api.sendMessage({ msg, attachments: [attachment] }, threadId, type);
  } catch {
    try {
      await api.sendMessage({ msg }, threadId, type);
    } catch {}
  } finally {
    if (attachment) pixelfx.cleanup(attachment);
  }
}

function difficultyOf(cfg, raw) {
  const k = String(raw || 'easy').toLowerCase();
  if (cfg.difficulties[k]) return k;
  if (['e', 'de', 'dễ'].includes(k)) return 'easy';
  if (['m', 'tb', 'trungbinh', 'trung'].includes(k)) return 'medium';
  if (['h', 'kho', 'khó'].includes(k)) return 'hard';
  return null;
}

function generateBombs(tiles, bombs) {
  const set = new Set();
  while (set.size < Math.min(bombs, Math.max(1, tiles - 1))) {
    set.add(1 + Math.floor(Math.random() * tiles));
  }
  return set;
}

function nextMultiplier(diff, floorIndex) {
  const arr = Array.isArray(diff.multipliers) ? diff.multipliers : [];
  if (arr[floorIndex] != null) return Number(arr[floorIndex]) || 1;
  const last = Number(arr[arr.length - 1]) || 1;
  const extra = floorIndex - (arr.length - 1);
  return Number((last * Math.pow(1.25, Math.max(1, extra))).toFixed(2));
}

function renderState(session, cfg) {
  const diff = cfg.difficulties[session.difficulty];
  const floorNum = session.floor + 1;
  const mult = session.multiplier;
  const payout = Math.floor(session.bet * mult);
  const nextMult = nextMultiplier(diff, session.floor);
  const nextPayout = Math.floor(session.bet * nextMult);
  const choices = Array.from({ length: diff.tiles }, (_, i) => `[${i + 1}]`).join(' ');
  return [
    `🗼 TOWER | ${diff.name}`,
    `• Tầng: ${floorNum}/${cfg.maxFloors}`,
    `• Cược: ${fmt(session.bet)} coins`,
    `• Hệ số hiện tại: x${mult}`,
    `• Có thể rút: ${fmt(payout)} coins`,
    `• Qua tầng này: x${nextMult} → ${fmt(nextPayout)} coins`,
    `• Chọn ô an toàn (1-${diff.tiles}): ${choices}`,
    `• Lệnh: /tower pick <n> | /tower cashout`
  ].join('\n');
}

function helpText(cfg) {
  return [
    '🗼 HƯỚNG DẪN TOWER',
    '• /tower <bet> [easy|medium|hard] — bắt đầu leo tháp',
    '• /tower pick <n> hoặc /tower <n> — chọn ô khi đang chơi',
    '• /tower cashout | /tower rut | /tower co — rút tiền',
    '• /tower daily — nhận thưởng hằng ngày',
    '• /tower info — xem luật chơi',
    `• Cược: ${fmt(cfg.minBet)} - ${fmt(cfg.maxBet)} coins`
  ].join('\n');
}

module.exports.config = {
  name: 'tower',
  aliases: ['tw'],
  role: 0,
  category: 'Game',
  cooldowns: 2,
  description: 'Leo tháp: chọn ô an toàn để tăng hệ số, có thể rút bất cứ lúc nào.',
  usage: 'tower <bet> [difficulty] | tower pick <n> | tower cashout | tower daily'
};

module.exports.run = async function ({ api, event, args = [], reply, Users }) {
  const cfg = loadConfig();
  const { threadId, type, data } = event || {};
  const uid = String(data?.uidFrom || event?.senderID || '');
  if (!uid || !threadId) return;

  const send = async (msg, fxId) => {
    if (fxId) return sendFx(api, threadId, type, msg, fxId);
    try {
      return await api.sendMessage({ msg }, threadId, type);
    } catch {
      try {
        if (reply && typeof reply === 'function') return await reply(msg);
        if (reply && typeof reply.error === 'function') return await reply.error(msg);
      } catch {}
    }
  };

  const sessionKey = keyOf(threadId, uid);
  const active = sessions.get(sessionKey);
  const sub = String(args[0] || '').toLowerCase();

  if (!sub || sub === 'help' || sub === 'info') {
    return send(helpText(cfg));
  }

  if (sub === 'daily') {
    const res = wallet.dailyClaim(Users, uid);
    if (!res.ok || !res.claimed) {
      return send(`⏳ Bạn đã nhận thưởng hôm nay rồi.\n• Số dư: ${fmt(res.balance || wallet.getCoins(Users, uid))} coins`);
    }
    return send(`🎁 Nhận thưởng hằng ngày: +${fmt(res.bonus)} coins\n• Số dư: ${fmt(res.balance)} coins`, 'ui/coin-collect');
  }

  if (['cashout', 'rut', 'rút', 'co'].includes(sub)) {
    if (!active) return send('❌ Bạn chưa có ván Tower đang chơi. Dùng /tower <bet> để bắt đầu.');
    const payout = Math.floor(active.bet * active.multiplier);
    const added = wallet.addCoins(Users, uid, payout, 'tower cashout');
    sessions.delete(sessionKey);
    const wonBig = active.multiplier >= 5 || payout >= active.bet * 5;
    return send(
      `💰 RÚT TIỀN THÀNH CÔNG!\n• Tầng đã qua: ${active.floor}\n• Hệ số: x${active.multiplier}\n• Nhận: ${fmt(payout)} coins\n• Số dư: ${fmt(added.balance || wallet.getCoins(Users, uid))} coins`,
      pickFx('cashout', active.floor, wonBig)
    );
  }

  let pickArg = null;
  if (sub === 'pick') pickArg = args[1];
  else if (active && /^\d+$/.test(sub)) pickArg = sub;

  if (pickArg != null) {
    if (!active) return send('❌ Bạn chưa có ván Tower đang chơi. Dùng /tower <bet> để bắt đầu.');
    const diff = cfg.difficulties[active.difficulty];
    const n = parsePositiveInt(pickArg);
    if (!n || n < 1 || n > diff.tiles) {
      return send(`❌ Ô không hợp lệ. Chọn từ 1 đến ${diff.tiles}.`);
    }
    if (!active.bombs) active.bombs = generateBombs(diff.tiles, diff.bombs);
    if (active.bombs.has(n)) {
      sessions.delete(sessionKey);
      const bal = wallet.getCoins(Users, uid);
      return send(
        `💣 BOOM! Bạn chọn ô ${n} và dính bom ở tầng ${active.floor + 1}.\n• Mất cược: ${fmt(active.bet)} coins\n• Dừng ở hệ số: x${active.multiplier}\n• Số dư: ${fmt(bal)} coins`,
        pickFx('loss')
      );
    }

    const reached = active.floor + 1;
    active.multiplier = nextMultiplier(diff, active.floor);
    active.floor = reached;
    active.history = active.history || [];
    active.history.push({ floor: reached, pick: n, multiplier: active.multiplier });
    active.bombs = null;

    if (active.floor >= cfg.maxFloors) {
      const payout = Math.floor(active.bet * active.multiplier);
      const added = wallet.addCoins(Users, uid, payout, 'tower max floor');
      sessions.delete(sessionKey);
      return send(
        `🏆 CHINH PHỤC TOWER!\n• Đã qua tối đa ${cfg.maxFloors} tầng\n• Hệ số: x${active.multiplier}\n• Thưởng: ${fmt(payout)} coins\n• Số dư: ${fmt(added.balance || wallet.getCoins(Users, uid))} coins`,
        'impacts/crit-hit'
      );
    }

    return send(`✅ An toàn! Bạn chọn ô ${n}.\n\n${renderState(active, cfg)}`, pickFx('safe', active.floor));
  }

  if (active) {
    return send(`⚠️ Bạn đang có ván Tower.\n\n${renderState(active, cfg)}`);
  }

  const bet = parsePositiveInt(sub);
  if (!bet) return send(helpText(cfg));
  const diffKey = difficultyOf(cfg, args[1]) || (difficultyOf(cfg, sub) ? null : 'easy');
  if (difficultyOf(cfg, sub) && !parsePositiveInt(args[1]) && args[1]) {
    return send('❌ Cú pháp: /tower <bet> [easy|medium|hard]');
  }
  const chosen = difficultyOf(cfg, args[1]) || 'easy';
  if (args[1] && !difficultyOf(cfg, args[1])) {
    return send('❌ Độ khó không hợp lệ. Dùng: easy, medium, hard.');
  }
  if (bet < cfg.minBet || bet > cfg.maxBet) {
    return send(`❌ Mức cược phải từ ${fmt(cfg.minBet)} đến ${fmt(cfg.maxBet)} coins.`);
  }

  wallet.ensureWallet(Users, uid);
  const taken = wallet.takeCoins(Users, uid, bet);
  if (!taken.ok) {
    return send(`❌ Không đủ coins để cược ${fmt(bet)}.\n• Số dư: ${fmt(taken.balance || wallet.getCoins(Users, uid))} coins`);
  }

  const session = {
    bet,
    difficulty: chosen,
    floor: 0,
    multiplier: 1,
    bombs: null,
    history: []
  };
  sessions.set(sessionKey, session);
  return send(`🎮 BẮT ĐẦU TOWER!\n• Đã cược: ${fmt(bet)} coins\n• Số dư còn: ${fmt(taken.balance)} coins\n\n${renderState(session, cfg)}`, pickFx('start'));
};
