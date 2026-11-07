import { Rng, clamp, smooth, ease } from '../../core/index.js';

export const meta = {
  name: 'Combat scene',
  desc: 'Hero vs monster (PVE) or 2 heroes (PK) slash combo, tiered',
  tags: ['melee', 'combat', 'pve', 'pk', 'scene', 'one-shot'],
  size: [220, 120],
  origin: [110, 102],
  duration: 1.35,
  loop: false,
  fps: 15,
  bg: 'ground',
  options: { mode: 'pve', tier: 1, hits: 1, power: 1, seed: 7, result: 'win' }
};

function C(hex) {
  // accept #rrggbb or number; painter takes numbers from core hex() usually, but keep simple
  if (typeof hex === 'number') return hex;
  if (!hex || typeof hex !== 'string') return 0xffffffff;
  const h = hex.replace('#', '');
  if (h.length === 6) return (0xff << 24) | (parseInt(h.slice(4, 6), 16) << 16) | (parseInt(h.slice(2, 4), 16) << 8) | parseInt(h.slice(0, 2), 16);
  return 0xffffffff;
}

function lerp(a, b, t) { return a + (b - a) * t; }

function safeDraw(fn) { try { fn(); } catch (_) {} }

function drawRect(p, x, y, w, h, col, a) {
  if (p && p.rect) p.rect(x, y, w, h, col, a == null ? 1 : a);
}
function drawPx(p, x, y, col, a) {
  if (!p) return;
  if (p.dot) p.dot(x, y, col, a == null ? 1 : a);
  else if (p.px) p.px(x, y, col);
  else if (p.rect) p.rect(x, y, 1, 1, col, a == null ? 1 : a);
}
function drawLine(p, x0, y0, x1, y1, col, a) {
  if (p && p.line) p.line(x0, y0, x1, y1, col, a == null ? 1 : a);
}
function drawCircle(p, x, y, r, col, a) {
  if (!p) return;
  if (p.circle) p.circle(x, y, r, col, a == null ? 1 : a);
  else if (p.ring) p.ring(x, y, r, 1, col, a == null ? 1 : a);
  else {
    for (let i = 0; i < 24; i++) {
      const t = (i / 24) * Math.PI * 2;
      drawPx(p, x + Math.cos(t) * r, y + Math.sin(t) * r, col, a);
    }
  }
}
function drawGlow(p, x, y, r, col, k) {
  if (p && p.glow) p.glow(x, y, r, col, k == null ? 0.5 : k);
}

export function create(o) {
  const opts = o && typeof o === 'object' ? o : {};
  const tier = clamp((opts.tier | 0) || 1, 1, 6);
  const hits = clamp((opts.hits | 0) || 1, 1, 5);
  const power = clamp((opts.power | 0) || 1, 1, 6);
  const mode = opts.mode === 'pk' ? 'pk' : 'pve';
  const result = opts.result === 'loss' ? 'loss' : 'win';
  const seed = (opts.seed == null ? 7 : opts.seed) | 0;
  const R = new Rng(seed);
  const duration = (meta && meta.duration) || 1.35;

  // Build hit timeline: more hits at higher tier feel faster; distribute across middle.
  const hitCount = clamp(hits + (tier >= 4 ? 1 : 0) - (tier <= 1 && hits > 1 ? 0 : 0), 1, 5);
  const start = 0.18;
  const end = Math.min(1.05, 0.45 + hitCount * 0.16 - tier * 0.01);
  const timeline = [];
  for (let i = 0; i < hitCount; i++) {
    const u = hitCount === 1 ? 0.5 : i / (hitCount - 1);
    timeline.push(start + (end - start) * u + R.range(-0.02, 0.02));
  }
  timeline.sort((a, b) => a - b);

  let t = 0;
  const particles = [];
  const fired = new Array(timeline.length).fill(false);

  function spawnBurst(x, y, intensity, warm) {
    const n = clamp((4 + tier * 2 + power + intensity * 2) | 0, 4, 28);
    for (let i = 0; i < n; i++) {
      const ang = R.range(-Math.PI, Math.PI);
      const sp = R.range(18, 55 + tier * 8 + power * 4) * (0.6 + intensity * 0.3);
      const life = R.range(0.12, 0.34 + tier * 0.03);
      const cols = warm
        ? [0xfff8d080, 0xffffaa44, 0xffff6633, 0xffffffff]
        : [0xffccf0ff, 0xff88ddff, 0xffffdd88, 0xffffffff];
      particles.push({
        x, y,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp - R.range(5, 25),
        life, max: life,
        col: cols[(R.next() * cols.length) | 0],
        r: R.range(0.7, 1.4 + tier * 0.15)
      });
    }
  }

  function spawnSlashSparks(x, y, dir, finisher) {
    const n = clamp((3 + tier + (finisher ? 6 : 0)) | 0, 3, 18);
    for (let i = 0; i < n; i++) {
      const ang = dir * (R.range(-0.9, 0.9)) + (dir > 0 ? 0 : Math.PI);
      const sp = R.range(30, 90 + tier * 10) * (finisher ? 1.2 : 1);
      const life = R.range(0.08, 0.22);
      particles.push({
        x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 10,
        life, max: life, col: finisher ? 0xffffffff : 0xffffe080, r: R.range(0.6, 1.2)
      });
    }
  }

  function hitAt(i) { return timeline[i] != null ? timeline[i] : 999; }
  function hitProgress(i) {
    const ht = hitAt(i);
    const w = 0.16;
    return clamp((t - ht) / w, 0, 1);
  }
  function activeHit() {
    for (let i = timeline.length - 1; i >= 0; i--) {
      if (t >= timeline[i] && t < timeline[i] + 0.22) return i;
    }
    return -1;
  }

  function update(dt) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    t += dt;
    for (let i = 0; i < timeline.length; i++) {
      if (!fired[i] && t >= timeline[i]) {
        fired[i] = true;
        const finisher = i === timeline.length - 1 && tier >= 3;
        const intensity = finisher ? 1.4 : 1;
        if (mode === 'pve') {
          spawnBurst(18, -22, intensity, true);
          spawnSlashSparks(18, -22, 1, finisher);
        } else {
          const fromLeft = i % 2 === 0;
          spawnBurst(fromLeft ? 8 : -8, -22, intensity, true);
          spawnSlashSparks(0, -22, fromLeft ? 1 : -1, finisher);
        }
      }
    }
    for (let i = particles.length - 1; i >= 0; i--) {
      const q = particles[i];
      q.life -= dt;
      if (q.life <= 0) { particles.splice(i, 1); continue; }
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.vy += 90 * dt;
      q.vx *= Math.pow(0.08, dt);
    }
  }

  function drawHumanoid(p, x, y, facing, pose, colors, weapon) {
    // pose: { lunge, recoil, arm, crouch }
    const lunge = pose.lunge || 0;
    const recoil = pose.recoil || 0;
    const arm = pose.arm == null ? -0.4 : pose.arm;
    const crouch = pose.crouch || 0;
    const f = facing >= 0 ? 1 : -1;
    const bx = x + f * lunge - f * recoil;
    const by = y + crouch;
    const skin = colors.skin || 0xffe0b890;
    const cloth = colors.cloth || 0xff3a6ad8;
    const dark = colors.dark || 0xff24448f;
    const outline = 0xff1a1422;
    // legs
    drawRect(p, bx - 4, by - 8, 3, 8, dark);
    drawRect(p, bx + 1, by - 8, 3, 8, dark);
    // body
    drawRect(p, bx - 5, by - 18, 10, 11, cloth);
    drawRect(p, bx - 5, by - 18, 10, 1, outline, 0.5);
    // head
    drawRect(p, bx - 4, by - 26, 8, 8, skin);
    drawPx(p, bx + f * 1, by - 23, 0xff1a1422);
    // back arm
    drawRect(p, bx - f * 6, by - 16, 3, 7, cloth);
    // weapon arm + slash
    const ax = bx + f * 4;
    const ay = by - 15;
    const ex = ax + Math.cos(arm) * f * 8;
    const ey = ay + Math.sin(arm) * 8;
    drawLine(p, ax, ay, ex, ey, skin, 1);
    if (weapon) {
      const sx = ex + Math.cos(arm) * f * 10;
      const sy = ey + Math.sin(arm) * 10;
      drawLine(p, ex, ey, sx, sy, 0xffd8e8ff, 1);
      drawLine(p, ex, ey, ex + Math.cos(arm) * f * 2, ey + Math.sin(arm) * 2, 0xff8a6240, 1);
    }
  }

  function drawMonster(p, x, y, pose, colors) {
    const recoil = pose.recoil || 0;
    const flash = pose.flash || 0;
    const collapse = pose.collapse || 0;
    const mx = x + recoil;
    const my = y + collapse * 10;
    const body = flash > 0 ? 0xfffff0d8 : (colors.body || 0xff6a3a5a);
    const shade = colors.shade || 0xff44243a;
    const eye = flash > 0 ? 0xffffffff : 0xffffcc44;
    const outline = 0xff1a1422;
    // body blob
    drawRect(p, mx - 14, my - 16 - collapse * -2, 28, 16 - collapse * 6, body);
    drawRect(p, mx - 12, my - 18, 24, 4, shade);
    // horns/spikes
    drawLine(p, mx - 10, my - 16, mx - 14, my - 24, 0xffccb8a0);
    drawLine(p, mx + 10, my - 16, mx + 14, my - 24, 0xffccb8a0);
    drawLine(p, mx - 2, my - 18, mx - 4, my - 25, 0xffccb8a0);
    drawLine(p, mx + 2, my - 18, mx + 4, my - 25, 0xffccb8a0);
    // eyes
    drawRect(p, mx - 8, my - 11, 4, 3, eye);
    drawRect(p, mx + 4, my - 11, 4, 3, eye);
    drawPx(p, mx - 6, my - 10, outline);
    drawPx(p, mx + 6, my - 10, outline);
    // teeth
    for (let i = -3; i <= 3; i += 2) drawRect(p, mx + i * 2, my - 4, 2, 3, 0xfff4efe6);
    // feet
    drawRect(p, mx - 11, my, 6, 4, shade);
    drawRect(p, mx + 5, my, 6, 4, shade);
    if (flash > 0) drawGlow(p, mx, my - 10, 14 + tier * 2, 0xffffdd88, 0.18 * flash);
  }

  function drawSlashArc(p, cx, cy, dir, progress, finisher) {
    const pr = ease.outExpo(clamp(progress * 1.4));
    const fade = 1 - smooth(0.55, 1, progress);
    if (pr <= 0 || fade <= 0) return;
    const r = 16 + tier * 2 + (finisher ? 6 : 0);
    const spread = (0.8 + tier * 0.08) * pr;
    const base = dir > 0 ? -0.9 : Math.PI - 0.9;
    const col = finisher ? 0xffffffff : 0xffc8f0ff;
    const trail = finisher ? 0xff88ccff : 0xff5a9ad8;
    const steps = 10 + tier * 2;
    let px0 = null, py0 = null;
    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      const a = base + dir * spread * u;
      const rr = r + u * (3 + tier * 0.4);
      const x = cx + Math.cos(a) * rr;
      const y = cy + Math.sin(a) * rr * 0.72;
      if (px0 != null) drawLine(p, px0, py0, x, y, u > 0.7 ? col : trail, fade * (0.5 + u * 0.5));
      px0 = x; py0 = y;
    }
    drawGlow(p, cx + dir * (8 + pr * 8), cy - 2, 10 + tier * 2, finisher ? 0xffd8f4ff : 0xff7ab8ff, 0.18 * fade);
  }

  function drawImpact(p, x, y, progress, finisher) {
    const k = ease.outQuad(clamp(progress));
    const fade = 1 - smooth(0.25, 1, progress);
    if (fade <= 0) return;
    const r = (6 + tier * 2 + power) * k + (finisher ? 4 : 0);
    drawCircle(p, x, y, r, finisher ? 0xffffffff : 0xffffe8a0, fade * 0.9);
    drawCircle(p, x, y, r * 0.55, finisher ? 0xffb8e8ff : 0xffffcc66, fade * 0.7);
    drawGlow(p, x, y, 12 + tier * 3 + (finisher ? 8 : 0), finisher ? 0xfff4ffb0 : 0xffffb050, 0.22 * fade);
  }

  function draw(p, tt, opts2) {
    // accept 1-3 args safely
    let painter = p;
    let time = tt;
    if (typeof painter === 'number') { time = painter; painter = null; }
    if (painter && typeof painter === 'object' && painter.w == null && painter.rect == null && painter.px == null && painter.dot == null) {
      // unusual; ignore
    }
    if (time == null) time = t;
    if (!painter || typeof painter !== 'object') return;

    safeDraw(() => {
      // ground hint
      drawRect(painter, -90, 0, 180, 2, 0xff2a3048, 0.9);
      drawRect(painter, -70, 2, 140, 1, 0xff20263a, 0.7);
    });

    const ai = activeHit();
    const finisher = ai === timeline.length - 1 && tier >= 3;
    const endPhase = clamp((t - duration * 0.78) / (duration * 0.22), 0, 1);

    if (mode === 'pve') {
      // hero left attacks right; monster at right
      let heroLunge = 0, heroArm = -0.5, heroRecoil = 0, heroCrouch = 0;
      let monRecoil = 0, monFlash = 0, monCollapse = 0;
      if (ai >= 0) {
        const hp = hitProgress(ai);
        const s = ease.outQuad(clamp(hp / 0.35)) * (1 - smooth(0.35, 1, hp));
        heroLunge = (10 + tier * 2 + (ai === timeline.length - 1 ? 6 : 0)) * s;
        heroArm = lerp(-0.7, 1.15, ease.outCubic(clamp(hp / 0.45)));
        if (hp > 0.22) monRecoil = (4 + power + (ai === timeline.length - 1 ? 5 : 0)) * ease.outQuad(clamp((hp - 0.22) / 0.3)) * (1 - smooth(0.7, 1, hp));
        if (hp > 0.18 && hp < 0.55) monFlash = 1 - Math.abs((hp - 0.36) / 0.19);
      }
      if (result === 'win' && endPhase > 0) {
        const fin = ease.outQuad(endPhase);
        monCollapse = fin * (0.45 + tier * 0.06);
        monFlash = Math.max(monFlash, (1 - endPhase) * (tier >= 4 ? 0.9 : 0.5));
        heroArm = lerp(heroArm, 0.8, fin);
      } else if (result === 'loss' && endPhase > 0) {
        heroRecoil = ease.outQuad(endPhase) * (10 + tier);
        heroArm = lerp(heroArm, -1.2, endPhase);
        heroCrouch = endPhase * 2;
      }
      safeDraw(() => drawHumanoid(painter, -58, 0, 1, { lunge: heroLunge, recoil: heroRecoil, arm: heroArm, crouch: heroCrouch }, { cloth: 0xff3a74e8, dark: 0xff244eaa }, true));
      safeDraw(() => drawMonster(painter, 58, 0, { recoil: monRecoil, flash: clamp(monFlash, 0, 1), collapse: clamp(monCollapse, 0, 1) }, { body: 0xff7a4a6e, shade: 0xff4f2f49 }));
      if (ai >= 0) {
        const hp = hitProgress(ai);
        safeDraw(() => drawSlashArc(painter, -40 + heroLunge, -24, 1, hp, finisher));
        if (hp > 0.12) safeDraw(() => drawImpact(painter, 44 + monRecoil, -18, (hp - 0.12) / 0.88, finisher));
      }
    } else {
      // PK: two heroes exchange slashes
      let lL = 0, lA = -0.5, lR = 0, rL = 0, rA = -0.5, rR = 0;
      if (ai >= 0) {
        const hp = hitProgress(ai);
        const s = ease.outQuad(clamp(hp / 0.35)) * (1 - smooth(0.35, 1, hp));
        const fromLeft = ai % 2 === 0;
        if (fromLeft) {
          lL = (9 + tier * 2) * s; lA = lerp(-0.7, 1.1, ease.outCubic(clamp(hp / 0.45)));
          if (hp > 0.22) rR = (3 + power) * (1 - smooth(0.7, 1, hp));
        } else {
          rL = (9 + tier * 2) * s; rA = lerp(-0.7, 1.1, ease.outCubic(clamp(hp / 0.45)));
          if (hp > 0.22) lR = (3 + power) * (1 - smooth(0.7, 1, hp));
        }
      }
      if (endPhase > 0) {
        if (result === 'win') { rR += endPhase * 8; rA = lerp(rA, -1.1, endPhase); lA = lerp(lA, 0.7, endPhase); }
        else { lR += endPhase * 8; lA = lerp(lA, -1.1, endPhase); rA = lerp(rA, 0.7, endPhase); }
      }
      safeDraw(() => drawHumanoid(painter, -58, 0, 1, { lunge: lL, recoil: lR, arm: lA }, { cloth: 0xff3a74e8, dark: 0xff244eaa }, true));
      safeDraw(() => drawHumanoid(painter, 58, 0, -1, { lunge: rL, recoil: rR, arm: rA }, { cloth: 0xffd85a4a, dark: 0xff993828 }, true));
      if (ai >= 0) {
        const hp = hitProgress(ai);
        const fromLeft = ai % 2 === 0;
        const dir = fromLeft ? 1 : -1;
        const cx = fromLeft ? -40 + lL : 40 - rL;
        safeDraw(() => drawSlashArc(painter, cx, -24, dir, hp, finisher));
        if (hp > 0.12) safeDraw(() => drawImpact(painter, 0, -20, (hp - 0.12) / 0.88, finisher));
      }
    }

    // particles / sparks
    safeDraw(() => {
      for (let i = 0; i < particles.length; i++) {
        const q = particles[i];
        const a = clamp(q.life / (q.max || 0.2), 0, 1);
        drawPx(painter, q.x, q.y, q.col, a);
        if (q.r > 1.05) drawPx(painter, q.x + (q.vx > 0 ? -1 : 1), q.y, q.col, a * 0.45);
      }
    });
  }

  return { update, draw };
}
