const fs = require('fs');
const path = require('path');
const wallet = require('../../core/gameWallet');
const pixelfx = require('../../core/pixelfx');

const CONFIG_PATH = path.join(process.cwd(), 'data', 'game', 'mines.json');
const sessions = new Map();

const DEFAULT_CONFIG = {
  minBet: 10,
  maxBet: 100000,
  minMines: 1,
  maxMines: 24,
  defaultMines: 3,
  houseEdge: 0.97
};

const GRID = 25;
const ROWS = 5;
const COLS = 5;

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

function parsePositiveInt(v) {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  const n = Number(s.replace(/[,._\s]/g, ''));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.floor(n);
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function generateMines(count) {
  const set = new Set();
  const target = clamp(Math.floor(count), 1, GRID - 1);
  while (set.size < target) {
    set.add(1 + Math.floor(Math.random() * GRID));
  }
  return set;
}

// Fair multiplier for k safe opens: Π_{i=0}^{k-1} (25-i)/(25-mines-i), with house edge applied.
function multiplierFor(openedSafe, mines, houseEdge) {
  if (openedSafe <= 0) return 1;
  let mult = 1;
  for (let i = 0; i < openedSafe; i++) {
    const totalLeft = GRID - i;
    const safeLeft = GRID - mines - i;
    if (safeLeft <= 0) return mult * houseEdge;
    mult *= totalLeft / safeLeft;
  }
  const edge = Number.isFinite(houseEdge) ? houseEdge : 0.97;
  return mult * edge;
}

function roundMult(m) {
  if (!Number.isFinite(m) || m < 1) return 1;
  return Math.floor(m * 10000) / 10000;
}

function payoutFor(session) {
  return Math.floor(session.bet * session.multiplier);
}

function renderBoard(session, revealMines) {
  const lines = [];
  for (let r = 0; r < ROWS; r++) {
    const row = [];
    for (let c = 0; c < COLS; c++) {
      const cell = r * COLS + c + 1;
      if (session.opened.has(cell)) {
        row.push('💎');
      } else if (revealMines && session.mineSet.has(cell)) {
        row.push('💣');
      } else {
        row.push('⬜');
      }
    }
    lines.push(row.join(''));
  }
  return lines.join('\n');
}

function sessionStatus(session) {
  const safeTotal = GRID - session.mines;
  return [
    `• Cược: ${fmt(session.bet)} coins`,
    `• Mìn: ${session.mines}/${GRID} | Ô an toàn: ${session.opened.size}/${safeTotal}`,
    `• Hệ số: x${roundMult(session.multiplier)}`,
    `• Có thể rút: ${fmt(payoutFor(session))} coins`
  ].join('\n');
}

function helpText(cfg) {
  return [
    '💣 HƯỚNG DẪN MINES',
    '• /mines <bet> [số mìn] — bắt đầu (mặc định 3 mìn)',
    '• /mines open <ô> hoặc /mines <ô> — mở ô 1-25 khi đang chơi',
    '• /mines cashout | /mines rut | /mines co — rút tiền',
    '• /mines daily — nhận thưởng hằng ngày',
    '• /mines info — xem luật chơi',
    `• Cược: ${fmt(cfg.minBet)} - ${fmt(cfg.maxBet)} coins`,
    `• Số mìn: ${cfg.minMines}-${cfg.maxMines} (ô 1-25, trái→phải, trên→dưới)`
  ].join('\n');
}

function lossFx() {
  return Math.random() < 0.5 ? 'impacts/ground-slam' : 'impacts/blunt-hit';
}

function safeFx() {
  return Math.random() < 0.5 ? 'ui/coin-collect' : 'impacts/hit-spark';
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

async function sendMsg({ api, threadId, type, reply }, msg, fxId) {
  if (fxId) return sendFx(api, threadId, type, msg, fxId);
  try {
    if (reply && typeof reply === 'function') return await reply(msg);
    return await api.sendMessage({ msg }, threadId, type);
  } catch {
    try { await api.sendMessage({ msg }, threadId, type); } catch {}
  }
}

function cashoutSession(session, Users, uid, cfg, reason) {
  const payout = payoutFor(session);
  const added = wallet.addCoins(Users, uid, payout, reason || 'mines cashout');
  return { payout, balance: added.balance != null ? added.balance : wallet.getCoins(Users, uid) };
}

module.exports.config = {
  name: 'mines',
  aliases: ['mine', 'm'],
  role: 0,
  category: 'Game',
  cooldowns: 2,
  description: 'Mở ô tìm kim cương, tránh mìn. Có thể rút bất cứ lúc nào.',
  usage: 'mines <bet> [mines] | mines open <1-25> | mines cashout | mines daily'
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
    return send(helpText(cfg));
  }

  if (sub === 'daily') {
    const res = wallet.dailyClaim(Users, uid);
    if (!res.ok || !res.claimed) {
      return send(`⏳ Bạn đã nhận thưởng hôm nay rồi.\n• Số dư: ${fmt(res.balance != null ? res.balance : wallet.getCoins(Users, uid))} coins`);
    }
    return send(`🎁 Nhận thưởng hằng ngày: +${fmt(res.bonus)} coins\n• Số dư: ${fmt(res.balance)} coins`, 'ui/coin-collect');
  }

  if (['cashout', 'rut', 'rút', 'co'].includes(sub)) {
    if (!active) return send('❌ Bạn chưa có ván Mines đang chơi. Dùng /mines <bet> [số mìn] để bắt đầu.');
    if (active.opened.size === 0) return send('❌ Bạn chưa mở ô an toàn nào, chưa thể rút. Hãy mở ít nhất 1 ô.');
    const { payout, balance } = cashoutSession(active, Users, uid, cfg, 'mines cashout');
    sessions.delete(sessionKey);
    const wonBig = active.multiplier >= 5 || payout >= active.bet * 5;
    return send(
      `💰 RÚT TIỀN THÀNH CÔNG!\n${renderBoard(active, false)}\n${sessionStatus({ ...active, multiplier: active.multiplier, bet: active.bet, mines: active.mines, opened: active.opened })}\n• Nhận: ${fmt(payout)} coins\n• Số dư: ${fmt(balance)} coins`,
      wonBig ? 'impacts/crit-hit' : 'ui/quest-complete'
    );
  }

  let openArg = null;
  if (sub === 'open' || sub === 'o') openArg = args[1];
  else if (active && /^\d+$/.test(sub)) openArg = sub;

  if (openArg != null) {
    if (!active) return send('❌ Bạn chưa có ván Mines đang chơi. Dùng /mines <bet> [số mìn] để bắt đầu.');
    const cell = parsePositiveInt(openArg);
    if (!cell || cell < 1 || cell > GRID) {
      return send(`❌ Ô không hợp lệ. Chọn từ 1 đến ${GRID}.`);
    }
    if (active.opened.has(cell)) {
      return send(`⚠️ Ô ${cell} đã được mở rồi.\n${renderBoard(active, false)}\n${sessionStatus(active)}`);
    }

    if (active.mineSet.has(cell)) {
      sessions.delete(sessionKey);
      const bal = wallet.getCoins(Users, uid);
      return send(
        `💣 BOOM! Ô ${cell} là mìn.\n${renderBoard(active, true)}\n• Mất cược: ${fmt(active.bet)} coins\n• Đã mở an toàn: ${active.opened.size} ô\n• Số dư: ${fmt(bal)} coins`,
        lossFx()
      );
    }

    active.opened.add(cell);
    active.multiplier = roundMult(multiplierFor(active.opened.size, active.mines, cfg.houseEdge));

    const safeTotal = GRID - active.mines;
    if (active.opened.size >= safeTotal) {
      const { payout, balance } = cashoutSession(active, Users, uid, cfg, 'mines perfect');
      sessions.delete(sessionKey);
      return send(
        `🏆 MỞ HẾT Ô AN TOÀN!\n${renderBoard(active, false)}\n• Hệ số: x${roundMult(active.multiplier)}\n• Thưởng: ${fmt(payout)} coins\n• Số dư: ${fmt(balance)} coins`,
        'impacts/crit-hit'
      );
    }

    return send(
      `✅ An toàn! Ô ${cell} là kim cương.\n${renderBoard(active, false)}\n${sessionStatus(active)}\n• /mines <ô> để mở tiếp | /mines cashout để rút`,
      safeFx()
    );
  }

  if (active) {
    return send(`⚠️ Bạn đang có ván Mines.\n${renderBoard(active, false)}\n${sessionStatus(active)}\n• /mines <ô> để mở | /mines cashout để rút`);
  }

  // Start game: /mines <bet> [minesCount]
  const bet = parsePositiveInt(sub);
  if (!bet) return send(helpText(cfg));

  let minesCount = cfg.defaultMines != null ? parsePositiveInt(cfg.defaultMines) : 3;
  if (args[1] != null && String(args[1]).trim() !== '') {
    const m = parsePositiveInt(args[1]);
    if (!m) return send(`❌ Số mìn không hợp lệ. Dùng số từ ${cfg.minMines} đến ${cfg.maxMines}.`);
    minesCount = m;
  }
  minesCount = clamp(minesCount, Number(cfg.minMines) || 1, Number(cfg.maxMines) || 24);
  minesCount = clamp(minesCount, 1, GRID - 1);

  if (bet < (Number(cfg.minBet) || 10) || bet > (Number(cfg.maxBet) || 100000)) {
    return send(`❌ Mức cược phải từ ${fmt(cfg.minBet)} đến ${fmt(cfg.maxBet)} coins.`);
  }

  wallet.ensureWallet(Users, uid);
  const taken = wallet.takeCoins(Users, uid, bet);
  if (!taken.ok) {
    return send(`❌ Không đủ coins để cược ${fmt(bet)}.\n• Số dư: ${fmt(taken.balance != null ? taken.balance : wallet.getCoins(Users, uid))} coins`);
  }

  const session = {
    bet,
    mines: minesCount,
    mineSet: generateMines(minesCount),
    opened: new Set(),
    multiplier: 1
  };
  sessions.set(sessionKey, session);

  return send(
    `🎮 BẮT ĐẦU MINES!\n${renderBoard(session, false)}\n${sessionStatus(session)}\n• /mines <ô 1-25> để mở | /mines cashout để rút`,
    'ui/coin-collect'
  );
};
