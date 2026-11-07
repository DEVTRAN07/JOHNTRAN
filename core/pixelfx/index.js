const fs = require("fs");
const os = require("os");
const path = require("path");
const { pathToFileURL } = require("url");
const { createCanvas } = require("canvas");

const VENDOR = path.resolve(__dirname, "..", "..", "vendor", "pixelfx");
const CORE_URL = pathToFileURL(path.join(VENDOR, "src", "core", "index.js")).href;

const FX_MAP = {
  "ui/level-up": "src/fx/ui/level-up.js",
  "ui/coin-collect": "src/fx/ui/coin-collect.js",
  "ui/quest-complete": "src/fx/ui/quest-complete.js",
  "ui/damage-number": "src/fx/ui/damage-number.js",
  "impacts/hit-flash": "src/fx/impacts/hit-flash.js",
  "impacts/crit-hit": "src/fx/impacts/crit-hit.js",
  "melee/sword-slash": "src/fx/melee/sword-slash.js",
  "spawn/coin-drop": "src/fx/spawn/coin-drop.js",
  "pickups/chest-open": "src/fx/pickups/chest-open.js",
};

async function renderFx(id, opts = {}) {
  const rel = FX_MAP[id];
  if (!rel) throw new Error(`Unknown fx id: ${id}`);
  const fxUrl = pathToFileURL(path.join(VENDOR, rel)).href;
  const core = await import(CORE_URL);
  const mod = await import(fxUrl);
  const meta = mod.meta || {};
  const w = opts.width || (meta.size && meta.size[0]) || 160;
  const h = opts.height || (meta.size && meta.size[1]) || 120;
  const origin = opts.ox != null || opts.oy != null
    ? [opts.ox || 0, opts.oy || 0]
    : (meta.origin || [Math.floor(w / 2), Math.floor(h * 0.8)]);
  const frame = core.createFrame(w, h, origin[0], origin[1]);
  core.clearFrame(frame);
  const fx = core.createFx(mod, opts.fxOpts || {});
  const D = meta.duration || 1;
  const loop = !!meta.loop;
  const target = loop
    ? (opts.time != null ? opts.time : 0.5)
    : (opts.time != null ? opts.time : (opts.progress != null ? D * opts.progress : Math.min(D, 0.9) * 0.55));
  const dt = 1 / 60;
  let t = 0;
  while (t < target) {
    const step = Math.min(dt, target - t);
    fx.update(step);
    t += step;
  }
  fx.draw(frame);
  const rgba = new Uint8ClampedArray(w * h * 4);
  core.composite(frame, rgba, opts.bg != null ? opts.bg : null);
  const scale = opts.scale || 2;
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext("2d");
  const img = ctx.createImageData(w, h);
  img.data.set(rgba);
  ctx.putImageData(img, 0, 0);
  let outCanvas = canvas;
  if (scale > 1) {
    outCanvas = createCanvas(w * scale, h * scale);
    const octx = outCanvas.getContext("2d");
    octx.imageSmoothingEnabled = false;
    octx.drawImage(canvas, 0, 0, w * scale, h * scale);
  }
  const buf = outCanvas.toBuffer("image/png");
  const ts = Date.now();
  const safeId = id.replace(/\//g, "_");
  const filePath = path.join(os.tmpdir(), `jt_pfx_${safeId}_${ts}.png`);
  fs.writeFileSync(filePath, buf);
  return { path: filePath, w: w * scale, h: h * scale, meta };
}

function cleanup(p) {
  try { if (p && fs.existsSync(p)) fs.unlinkSync(p); } catch (e) {}
}

module.exports = { renderFx, cleanup };
