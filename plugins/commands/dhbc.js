const fs = require('fs');
const path = require('path');
const wallet = require('../../core/gameWallet');
function getPixelfx() { try { return require('../../core/pixelfx'); } catch { return null; } }

const PUZZLE_PATH = path.join(process.cwd(), 'data', 'game', 'dhbc.json');
const sessions = new Map(); // threadId -> session

function loadPuzzles() {
  try {
    const raw = fs.readFileSync(PUZZLE_PATH, 'utf8');
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    return [];
  }
}

function normalizeText(str) {
  if (str == null) return '';
  let s = String(str).toLowerCase().trim();
  // Remove Vietnamese diacritics
  s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  // Replace đ/Đ
  s = s.replace(/đ/g, 'd').replace(/Đ/g, 'd');
  // Remove punctuation and extra spaces
  s = s.replace(/[\.,!?\:;"'()\[\]{}<>\/\\|`~@#$%^&*+=_-]/g, ' ');
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

function getPrefix() {
  return global.config?.prefix || '/';
}

function pickFx(event) {
  if (event === 'start' || event === 'question') return 'ui/quest-complete';
  if (event === 'correct') return 'ui/coin-collect';
  if (event === 'timeout' || event === 'reveal') return 'impacts/blunt-hit';
  if (event === 'skip') return 'impacts/crit-hit';
  return 'ui/quest-complete';
}

async function sendFx(api, threadId, type, msg, fxId) {
  const pixelfx = getPixelfx();
  if (!pixelfx) { try { await api.sendMessage({ msg }, threadId, type); } catch {} return; }
  let attachment;
  try {
    const fx = await pixelfx.renderFxGif(fxId, { fps: 12, frames: 10, scale: 2 });
    attachment = fx.path;
    await api.sendMessage({ msg, attachments: [attachment] }, threadId, type);
  } catch (e) {
    try {
      await api.sendMessage({ msg }, threadId, type);
    } catch {}
  } finally {
    if (attachment) {
      try { pixelfx.cleanup(attachment); } catch {}
    }
  }
}

module.exports.config = {
  name: 'dhbc',
  aliases: ['duoihinhbatchu'],
  version: '1.0.0',
  role: 0,
  author: 'JOHNTRAN',
  description: 'Đuổi hình bắt chữ - đoán từ/đáp án từ gợi ý',
  category: 'Game',
  usage: 'dhbc | dhbc start | dhbc hint | dhbc answer <đáp án> | dhbc skip | dhbc daily',
  cooldowns: 3,
  dependencies: {}
};

function startRound({ api, event, reply, Users }) {
  const { threadId, type } = event || {};
  if (!threadId) return;
  
  // End existing session if any
  const existing = sessions.get(threadId);
  if (existing && existing.timer) {
    try { clearTimeout(existing.timer); } catch {}
    sessions.delete(threadId);
  }
  
  const puzzles = loadPuzzles();
  if (puzzles.length === 0) {
    const msg = '❌ Chưa có dữ liệu câu đố. Hãy thêm vào data/game/dhbc.json';
    if (reply && typeof reply.error === 'function') return reply.error(msg);
    return api.sendMessage({ msg }, threadId, type);
  }
  
  const puzzle = puzzles[Math.floor(Math.random() * puzzles.length)];
  const answerNorm = normalizeText(puzzle.answer);
  
  const session = {
    puzzle,
    answerNormalized: answerNorm,
    startedAt: Date.now(),
    timeout: 60000,
    winner: null,
    threadId,
    type
  };
  
  // Set timeout
  session.timer = setTimeout(async () => {
    const s = sessions.get(threadId);
    if (!s || s.winner) {
      if (s && s.timer) {
        try { clearTimeout(s.timer); } catch {}
      }
      sessions.delete(threadId);
      return;
    }
    try {
      const revealMsg = `⏰ Hết thời gian!\nĐáp án đúng: ${s.puzzle.answer}\n${s.puzzle.hint ? `Gợi ý: ${s.puzzle.hint}` : ''}`;
      await sendFx(api, threadId, s.type, revealMsg, pickFx('timeout'));
    } catch {}
    if (s.timer) {
      try { clearTimeout(s.timer); } catch {}
    }
    sessions.delete(threadId);
  }, session.timeout);
  
  sessions.set(threadId, session);
  
  const startMsg = [
    '🖼️ ĐUỔI HÌNH BẮT CHỮ',
    `• Câu hỏi: ${puzzle.clue}`,
    '• Thời gian: 60 giây',
    '• Trả lời: /dhbc answer <đáp án> hoặc trả lời trực tiếp trong thread',
    puzzle.hint ? '• Dùng /dhbc hint để xem gợi ý' : ''
  ].filter(Boolean).join('\n');
  
  return sendFx(api, threadId, type, startMsg, pickFx('start'));
}

module.exports.run = async function ({ api, event, args = [], reply, Users }) {
  const { threadId, type, data } = event || {};
  const uid = String(data?.uidFrom || event?.senderID || '');
  if (!threadId) return;
  
  const sub = String(args[0] || '').toLowerCase();
  const prefix = getPrefix();
  
  if (!sub || sub === 'start') {
    return startRound({ api, event, reply, Users });
  }
  
  if (sub === 'daily') {
    const res = wallet.dailyClaim(Users, uid);
    if (!res.ok || !res.claimed) {
      const bal = res.balance || wallet.getCoins(Users, uid);
      const msg = `⏳ Bạn đã nhận thưởng hôm nay rồi.\n• Số dư: ${bal.toLocaleString('en-US')} coins`;
      if (reply && typeof reply.info === 'function') return reply.info(msg);
      return api.sendMessage({ msg }, threadId, type);
    }
    const msg = `🎁 Nhận thưởng hằng ngày: +${res.bonus.toLocaleString('en-US')} coins\n• Số dư: ${res.balance.toLocaleString('en-US')} coins`;
    if (reply && typeof reply.success === 'function') {
      reply.success(msg);
      return sendFx(api, threadId, type, '', pickFx('correct'));
    }
    return sendFx(api, threadId, type, msg, pickFx('correct'));
  }
  
  if (sub === 'hint') {
    const session = sessions.get(threadId);
    if (!session) {
      const msg = '❌ Không có ván DHBC đang diễn ra. Dùng /dhbc start để bắt đầu.';
      if (reply && typeof reply.error === 'function') return reply.error(msg);
      return api.sendMessage({ msg }, threadId, type);
    }
    if (!session.puzzle.hint) {
      const msg = '❌ Câu này không có gợi ý.';
      if (reply && typeof reply.warn === 'function') return reply.warn(msg);
      return api.sendMessage({ msg }, threadId, type);
    }
    const msg = `💡 Gợi ý: ${session.puzzle.hint}`;
    if (reply && typeof reply.info === 'function') return reply.info(msg);
    return api.sendMessage({ msg }, threadId, type);
  }
  
  if (sub === 'skip') {
    const session = sessions.get(threadId);
    if (!session) {
      const msg = '❌ Không có ván DHBC đang diễn ra.';
      if (reply && typeof reply.error === 'function') return reply.error(msg);
      return api.sendMessage({ msg }, threadId, type);
    }
    if (session.timer) {
      try { clearTimeout(session.timer); } catch {}
    }
    const revealMsg = `⏭️ Đã bỏ qua!\nĐáp án đúng: ${session.puzzle.answer}\n${session.puzzle.hint ? `Gợi ý: ${session.puzzle.hint}` : ''}`;
    sessions.delete(threadId);
    return sendFx(api, threadId, type, revealMsg, pickFx('skip'));
  }
  
  if (sub === 'answer') {
    const session = sessions.get(threadId);
    if (!session) {
      const msg = '❌ Không có ván DHBC đang diễn ra. Dùng /dhbc start để bắt đầu.';
      if (reply && typeof reply.error === 'function') return reply.error(msg);
      return api.sendMessage({ msg }, threadId, type);
    }
    const ans = args.slice(1).join(' ');
    if (!ans) {
      const msg = '❌ Vui lòng nhập đáp án: /dhbc answer <đáp án>';
      if (reply && typeof reply.error === 'function') return reply.error(msg);
      return api.sendMessage({ msg }, threadId, type);
    }
    const norm = normalizeText(ans);
    if (norm === session.answerNormalized || norm.includes(session.answerNormalized) || session.answerNormalized.includes(norm)) {
      if (session.winner) {
        const msg = `❌ Đã có người trả lời đúng rồi!`;
        if (reply && typeof reply.warn === 'function') return reply.warn(msg);
        return api.sendMessage({ msg }, threadId, type);
      }
      session.winner = uid;
      if (session.timer) {
        try { clearTimeout(session.timer); } catch {}
      }
      const reward = 100;
      const res = wallet.addCoins(Users, uid, reward, 'dhbc correct');
      const winMsg = `🎉 CHÍNH XÁC!\n• Người trả lời: ${uid}\n• Đáp án: ${session.puzzle.answer}\n• Thưởng: +${reward.toLocaleString('en-US')} coins\n• Số dư: ${(res.balance || wallet.getCoins(Users, uid)).toLocaleString('en-US')} coins`;
      sessions.delete(threadId);
      return sendFx(api, threadId, type, winMsg, pickFx('correct'));
    } else {
      const msg = '❌ Sai rồi! Thử lại xem sao.';
      if (reply && typeof reply.error === 'function') return reply.error(msg);
      return api.sendMessage({ msg }, threadId, type);
    }
  }
  
  // Default help
  const helpMsg = [
    '🖼️ ĐUỔI HÌNH BẮT CHỮ',
    '• /dhbc hoặc /dhbc start - Bắt đầu ván mới',
    '• /dhbc hint - Xem gợi ý (nếu có)',
    '• /dhbc answer <đáp án> - Trả lời',
    '• Trả lời trực tiếp trong thread cũng được chấp nhận',
    '• /dhbc skip - Bỏ qua câu hỏi',
    '• /dhbc daily - Nhận thưởng hằng ngày',
    '• Thời gian: 60 giây | Thưởng: 100 coins'
  ].join('\n');
  if (reply && typeof reply.info === 'function') return reply.info(helpMsg);
  return api.sendMessage({ msg: helpMsg }, threadId, type);
};

module.exports.handleEvent = async function ({ api, event, eventType, isSelf, Users, Threads }) {
  try {
    if (eventType && eventType !== 'message') return;
    if (isSelf) return;
    
    const threadId = event?.threadId;
    const type = event?.type;
    if (!threadId) return;
    
    const content = event?.data?.content;
    if (content == null) return;
    const text = typeof content === 'string' ? content : (content?.title || content?.href || content?.msg || '');
    if (!text || typeof text !== 'string') return;
    
    const prefix = getPrefix();
    const trimmed = text.trim();
    if (trimmed.startsWith(prefix)) return; // It's a command
    
    const session = sessions.get(threadId);
    if (!session || session.winner) return;
    
    // Check if it's an answer
    const norm = normalizeText(trimmed);
    if (!norm) return;
    
    const uid = String(event?.data?.uidFrom || event?.senderID || '');
    if (!uid) return;
    
    if (norm === session.answerNormalized || norm.includes(session.answerNormalized) || session.answerNormalized.includes(norm)) {
      session.winner = uid;
      if (session.timer) {
        try { clearTimeout(session.timer); } catch {}
      }
      const reward = 100;
      const res = wallet.addCoins(Users, uid, reward, 'dhbc correct');
      const winMsg = `🎉 CHÍNH XÁC!\n• Người trả lời: ${uid}\n• Đáp án: ${session.puzzle.answer}\n• Thưởng: +${reward.toLocaleString('en-US')} coins\n• Số dư: ${(res.balance || wallet.getCoins(Users, uid)).toLocaleString('en-US')} coins`;
      sessions.delete(threadId);
      return sendFx(api, threadId, type, winMsg, pickFx('correct'));
    }
    // Don't give feedback for wrong answers in handleEvent to avoid spam
  } catch (e) {
    // Silent fail
  }
};
