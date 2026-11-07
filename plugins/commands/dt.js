const fs = require("fs");
const path = require("path");
const { firstMention } = require("../../core/mentions");

const BRAND = "ᴶᴼᴴᴺ ᵀᴿᴬᴺ";
const CONFIG_PATH = path.join(__dirname, "..", "..", "data", "game", "dt.json");

function loadCfg() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
  } catch {
    return {};
  }
}
const C = () => loadCfg();

function now() { return Date.now(); }
function vnDay(ts) {
  const d = new Date(ts);
  const vn = new Date(d.getTime() + 7 * 3600 * 1000);
  return `${vn.getUTCFullYear()}-${vn.getUTCMonth() + 1}-${vn.getUTCDate()}`;
}

function defaultDt(name) {
  const c = C();
  return {
    name: name || "Võ Sĩ",
    cls: "võ sĩ",
    level: 1,
    exp: 0,
    hp: c.startHp || 100,
    maxHp: c.startHp || 100,
    atk: c.startAtk || 12,
    def: c.startDef || 5,
    spd: c.startSpd || 8,
    gold: c.startGold || 100,
    energy: c.startEnergy || 50,
    maxEnergy: c.maxEnergy || 100,
    wins: 0,
    losses: 0,
    pveWins: 0,
    lastDaily: 0,
    lastTrain: 0,
    createdAt: Date.now()
  };
}

function expToNext(dt) {
  const c = C();
  return (c.expBase || 50) + dt.level * (c.expFactor || 35);
}

function tryRender() {
  try {
    const px = require("../../core/pixelfx");
    return px;
  } catch { return null; }
}

async function renderVisual(renderSpec) {
  const px = tryRender();
  if (!px) return null;
  try {
    if (!renderSpec) return null;
    if (typeof renderSpec === "function") return await renderSpec(px);
    const { gifId, gifOpts, pngId, pngOpts } = renderSpec;
    if (gifId && typeof px.renderFxGif === "function") {
      try {
        const r = await px.renderFxGif(gifId, gifOpts || {});
        if (r?.path) return r.path;
      } catch {}
    }
    if (pngId && typeof px.renderFx === "function") {
      const r = await px.renderFx(pngId, pngOpts || {});
      return r?.path || null;
    }
    if (gifId && typeof px.renderFx === "function") {
      const r = await px.renderFx(gifId, { progress: 0.6, bg: 0xff101018, scale: 1, ...(gifOpts || {}) });
      return r?.path || null;
    }
  } catch {}
  return null;
}

async function sendWithImage(api, threadId, type, msg, renderSpec) {
  let imgPath = null;
  try {
    imgPath = await renderVisual(renderSpec);
  } catch { imgPath = null; }
  try {
    if (imgPath && fs.existsSync(imgPath)) {
      await api.sendMessage({ msg, attachments: [imgPath] }, threadId, type);
    } else {
      await api.sendMessage(msg, threadId, type);
    }
  } catch {
    try { await api.sendMessage(msg, threadId, type); } catch {}
  } finally {
    if (imgPath) try { fs.unlinkSync(imgPath); } catch {}
  }
}

function getDt(record) {
  const data = record?.data || {};
  return data.dt || null;
}

function saveDt(Users, uid, dt) {
  const record = Users.getData(uid);
  const data = record?.data || {};
  data.dt = dt;
  return Users.setData(uid, data);
}

function levelUpIfNeeded(dt) {
  let leveled = false;
  const c = C();
  while (dt.exp >= expToNext(dt)) {
    dt.exp -= expToNext(dt);
    dt.level += 1;
    dt.maxHp += c.hpPerLevel || 15;
    dt.hp = dt.maxHp;
    dt.atk += c.atkPerLevel || 3;
    dt.def += c.defPerLevel || 2;
    dt.spd += c.spdPerLevel || 1;
    leveled = true;
  }
  return leveled;
}

function pickDtTier(level) {
  const lv = Number(level) || 1;
  if (lv <= 3) return 1; if (lv <= 8) return 2; if (lv <= 15) return 3;
  if (lv <= 25) return 4; if (lv <= 40) return 5; return 6;
}
function hitsForTier(tier) { return tier <= 1 ? 1 : tier === 2 ? 2 : tier <= 4 ? 3 : 4; }
function combatSceneFx({ mode, tier, hits, power, seed, result }) {
  const t = Math.max(1, Math.min(6, Number(tier) || 1));
  const fxOpts = { mode: mode === 'pk' ? 'pk' : 'pve', tier: t, hits: Math.max(1, Math.min(5, Number(hits) || hitsForTier(t))), power: Math.max(1, Math.min(6, Number(power) || t)), seed: Number(seed) || 7, result: result === 'loss' ? 'loss' : 'win' };
  return { gifId: 'melee/combat-scene', gifOpts: { fps: 12, scale: 2, bg: 0xff101018, fxOpts }, pngId: 'melee/combat-scene', pngOpts: { progress: 0.7, bg: 0xff101018, scale: 1, fxOpts } };
}

function combat(player, enemy) {
  let pHp = player.hp, eHp = enemy.hp;
  let first = player.spd >= enemy.spd;
  let turns = 0;
  while (pHp > 0 && eHp > 0 && turns < 50) {
    turns++;
    if (first) {
      const dmg = Math.max(1, player.atk - enemy.def * 0.5 + Math.floor(Math.random() * 4));
      eHp -= dmg;
      if (eHp <= 0) break;
      const edmg = Math.max(1, enemy.atk - player.def * 0.5 + Math.floor(Math.random() * 4));
      pHp -= edmg;
    } else {
      const edmg = Math.max(1, enemy.atk - player.def * 0.5 + Math.floor(Math.random() * 4));
      pHp -= edmg;
      if (pHp <= 0) break;
      const dmg = Math.max(1, player.atk - enemy.def * 0.5 + Math.floor(Math.random() * 4));
      eHp -= dmg;
    }
  }
  return pHp > 0;
}

module.exports.config = {
  name: "dt",
  aliases: ["dautruong"],
  version: "1.0.0",
  role: 0,
  author: BRAND,
  description: "Đấu Trường - game võ sĩ solo",
  category: "Game",
  usage: "dt <dk|info|daily|train|pve|pk|bxh>",
  cooldowns: 3,
  dependencies: {}
};

module.exports.run = async ({ api, event, args, Users, reply }) => {
  const { threadId, type } = event;
  const senderId = String(event.senderID || event.data?.uidFrom || "");
  const sub = (args[0] || "").toLowerCase();
  const c = C();

  if (!sub || sub === "help") {
    await api.sendMessage("Đấu Trường: dk [tên] | info | daily | train | pve | pk @tag | bxh", threadId, type);
    return;
  }

  // dk
  if (sub === "dk") {
    const name = args.slice(1).join(" ").trim() || "Võ Sĩ";
    const dt = defaultDt(name);
    saveDt(Users, senderId, dt);
    await api.sendMessage(`Đã đăng ký võ sĩ "${name}" (Lv.1). /dt daily để điểm danh.`, threadId, type);
    return;
  }

  const me = Users.getData(senderId);
  const dt = getDt(me);

  if (sub === "info") {
    let targetId = senderId;
    const m = firstMention(event.data || event);
    if (m) targetId = m;
    if (event.data?.quote?.uidFrom && !m && args.length > 1) targetId = event.data.quote.uidFrom;
    const rec = Users.getData(targetId);
    const d = getDt(rec);
    if (!d) { await api.sendMessage("Chưa đăng ký. Dùng /dt dk [tên].", threadId, type); return; }
    const msg = `📜 ${d.name} | ${d.cls}\nLv.${d.level} (${d.exp}/${expToNext(d)} EXP)\nHP ${d.hp}/${d.maxHp} • ATK ${d.atk} • DEF ${d.def} • SPD ${d.spd}\nGold ${d.gold} • Energy ${d.energy}/${d.maxEnergy}\nW ${d.wins} L ${d.losses} • PVE ${d.pveWins}`;
    await api.sendMessage(msg, threadId, type);
    return;
  }

  if (!dt) { await api.sendMessage("Chưa đăng ký. Dùng /dt dk [tên].", threadId, type); return; }

  if (sub === "daily") {
    const today = vnDay(Date.now());
    if (dt.lastDaily && vnDay(dt.lastDaily) === today) {
      await api.sendMessage("Hôm nay đã điểm danh. Quay lại ngày mai.", threadId, type);
      return;
    }
    dt.lastDaily = Date.now();
    dt.exp += c.dailyExp || 30;
    dt.gold += c.dailyGold || 50;
    dt.energy = Math.min(dt.maxEnergy, dt.energy + (c.dailyEnergy || 20));
    const leveled = levelUpIfNeeded(dt);
    saveDt(Users, senderId, dt);
    let msg = `Daily: +${c.dailyExp} EXP, +${c.dailyGold} gold, +${c.dailyEnergy} energy.`;
    const fx = leveled
      ? { gifId: "ui/level-up", gifOpts: { fps: 12, scale: 2, bg: 0xff101018 }, pngId: "ui/level-up", pngOpts: { progress: 0.6, bg: 0xff101018, scale: 1 } }
      : { gifId: "ui/quest-complete", gifOpts: { fps: 12, scale: 2, bg: 0xff101018 }, pngId: "ui/quest-complete", pngOpts: { progress: 0.6, bg: 0xff101018, scale: 1 } };
    if (leveled) msg += "\n🎉 Level up! Lv." + dt.level;
    await sendWithImage(api, threadId, type, msg, fx);
    return;
  }

  if (sub === "train") {
    const cd = (c.trainCooldown || 120) * 1000;
    if (Date.now() - (dt.lastTrain || 0) < cd) {
      const left = Math.ceil((cd - (Date.now() - dt.lastTrain)) / 1000);
      await api.sendMessage(`Luyện tập cooldown: còn ${left}s.`, threadId, type);
      return;
    }
    if (dt.energy < (c.trainEnergyCost || 5)) {
      await api.sendMessage("Không đủ energy.", threadId, type);
      return;
    }
    dt.lastTrain = Date.now();
    dt.energy -= c.trainEnergyCost || 5;
    dt.exp += c.trainExp || 15;
    const leveled = levelUpIfNeeded(dt);
    saveDt(Users, senderId, dt);
    let msg = `Train: +${c.trainExp} EXP, -${c.trainEnergyCost} energy.`;
    if (leveled) {
      msg += "\n🎉 Level up! Lv." + dt.level;
      await sendWithImage(api, threadId, type, msg, { gifId: "ui/level-up", gifOpts: { fps: 12, scale: 2, bg: 0xff101018 }, pngId: "ui/level-up", pngOpts: { progress: 0.6, bg: 0xff101018, scale: 1 } });
    } else {
      await api.sendMessage(msg, threadId, type);
    }
    return;
  }

  if (sub === "pve") {
    const monLevel = Math.max(1, dt.level + (Math.random() < 0.5 ? 0 : 1));
    const enemy = {
      name: "Quái bot",
      level: monLevel,
      hp: 60 + monLevel * 12,
      atk: 8 + monLevel * 2,
      def: 3 + monLevel,
      spd: 6 + monLevel
    };
    const pHp = dt.hp;
    const win = combat({ ...dt, hp: pHp }, enemy);
    dt.hp = Math.max(1, pHp);
    if (win) {
      dt.pveWins = (dt.pveWins || 0) + 1;
      const expGain = (c.pveExpBase || 20) + monLevel * (c.pveLevelScale || 8);
      const goldGain = (c.pveGoldBase || 25) + monLevel * (c.pveLevelScale || 8);
      dt.exp += expGain;
      dt.gold += goldGain;
      const leveled = levelUpIfNeeded(dt);
      saveDt(Users, senderId, dt);
      let msg = `PVE vs ${enemy.name} Lv.${monLevel}: THẮNG +${expGain} EXP, +${goldGain} gold.`;
      const fx = leveled
        ? { gifId: "ui/level-up", gifOpts: { fps: 12, scale: 2, bg: 0xff101018 }, pngId: "ui/level-up", pngOpts: { progress: 0.6, bg: 0xff101018, scale: 1 } }
        : combatSceneFx({ mode: 'pve', tier: pickDtTier(Math.max(dt.level, monLevel)), seed: dt.level * 100 + monLevel + dt.pveWins, result: 'win' });
      if (leveled) msg += "\n🎉 Level up! Lv." + dt.level;
      await sendWithImage(api, threadId, type, msg, fx);
    } else {
      dt.hp = Math.max(1, Math.floor(dt.maxHp * 0.3));
      dt.exp += 5;
      saveDt(Users, senderId, dt);
      await sendWithImage(api, threadId, type, `PVE vs ${enemy.name} Lv.${monLevel}: THUA. Hồi 30% HP, +5 EXP consolation.`, combatSceneFx({ mode: 'pve', tier: Math.max(1, Math.min(2, pickDtTier(dt.level))), seed: dt.level * 100 + monLevel, result: 'loss' }));
    }
    return;
  }

  if (sub === "pk") {
    let targetId = null;
    const m = firstMention(event.data || event);
    if (m) targetId = m;
    if (!targetId && event.data?.quote?.uidFrom) targetId = event.data.quote.uidFrom;
    if (!targetId) { await api.sendMessage("PK cần @tag hoặc reply đối thủ.", threadId, type); return; }
    if (targetId === senderId) { await api.sendMessage("Không thể PK chính mình.", threadId, type); return; }
    const tRec = Users.getData(targetId);
    const tdt = getDt(tRec);
    if (!tdt) { await api.sendMessage("Đối thủ chưa đăng ký.", threadId, type); return; }
    const win = combat(dt, tdt);
    if (win) {
      dt.wins += 1;
      tdt.losses += 1;
      dt.exp += c.pkExpWin || 40;
      dt.gold += c.pkGoldWin || 60;
      tdt.gold = Math.max(0, tdt.gold - (c.pkGoldLoss || 20));
      const leveled = levelUpIfNeeded(dt);
      saveDt(Users, senderId, dt);
      saveDt(Users, targetId, tdt);
      let msg = `PK: Bạn THẮNG ${tdt.name}. +${c.pkExpWin} EXP, +${c.pkGoldWin} gold.`;
      const fx = leveled
        ? { gifId: "ui/level-up", gifOpts: { fps: 12, scale: 2, bg: 0xff101018 }, pngId: "ui/level-up", pngOpts: { progress: 0.6, bg: 0xff101018, scale: 1 } }
        : combatSceneFx({ mode: 'pk', tier: pickDtTier(Math.max(dt.level, tdt.level)), seed: dt.level * 100 + tdt.level, result: 'win' });
      if (leveled) msg += "\n🎉 Level up! Lv." + dt.level;
      await sendWithImage(api, threadId, type, msg, fx);
    } else {
      dt.losses += 1;
      tdt.wins += 1;
      tdt.exp += c.pkExpWin || 40;
      tdt.gold += c.pkGoldWin || 60;
      dt.gold = Math.max(0, dt.gold - (c.pkGoldLoss || 20));
      levelUpIfNeeded(tdt);
      saveDt(Users, senderId, dt);
      saveDt(Users, targetId, tdt);
      await sendWithImage(api, threadId, type, `PK: Bạn THUA ${tdt.name}. -${c.pkGoldLoss} gold.`, combatSceneFx({ mode: 'pk', tier: Math.max(1, Math.min(2, pickDtTier(Math.max(dt.level, tdt.level)))), seed: dt.level * 100 + tdt.level, result: 'loss' }));
    }
    return;
  }

  if (sub === "bxh") {
    const rows = Users.getAll();
    const list = rows
      .map((r) => ({ uid: r.userId, dt: r.data?.dt }))
      .filter((x) => x.dt)
      .sort((a, b) => (b.dt.level - a.dt.level) || (b.dt.exp - a.dt.exp))
      .slice(0, 10);
    if (list.length === 0) {
      await api.sendMessage("BXH trống. Hãy /dt dk.", threadId, type);
      return;
    }
    const lines = list.map((x, i) => `${i + 1}. ${x.dt.name} Lv.${x.dt.level} (${x.dt.wins}W/${x.dt.losses}L)`);
    await api.sendMessage("🏆 BXH Đấu Trường:\n" + lines.join("\n"), threadId, type);
    return;
  }

  await api.sendMessage("Subcommand không hợp lệ. /dt help", threadId, type);
};
