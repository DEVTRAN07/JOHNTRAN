const fs = require("fs");
const os = require("os");
const path = require("path");
const { pathToFileURL } = require("url");
const { execFile } = require("child_process");
const { promisify } = require("util");
const { createCanvas } = require("canvas");

const execFileAsync = promisify(execFile);

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

function resolveFfmpeg() {
  try {
    const p = require("ffmpeg-static");
    if (p && typeof p === "string" && fs.existsSync(p)) return p;
  } catch {}
  return null;
}

function mkTempDir(prefix) {
  const dir = path.join(os.tmpdir(), `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function rmDir(dir) {
  try {
    if (!dir || !fs.existsSync(dir)) return;
    for (const f of fs.readdirSync(dir)) {
      try { fs.unlinkSync(path.join(dir, f)); } catch {}
    }
    fs.rmdirSync(dir);
  } catch {}
}

function writeScaledFrame(frame, w, h, scale, bg, filePath) {
  const rgba = new Uint8ClampedArray(w * h * 4);
  const core = frame.__core;
  core.composite(frame, rgba, bg != null ? bg : null);
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
  fs.writeFileSync(filePath, outCanvas.toBuffer("image/png"));
}

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

async function renderFxGif(id, opts = {}) {
  const rel = FX_MAP[id];
  if (!rel) throw new Error(`Unknown fx id: ${id}`);
  const ffmpeg = resolveFfmpeg();
  if (!ffmpeg) throw new Error("ffmpeg-static not available");

  const fxUrl = pathToFileURL(path.join(VENDOR, rel)).href;
  const core = await import(CORE_URL);
  const mod = await import(fxUrl);
  const meta = mod.meta || {};

  const fps = Math.max(1, Math.min(opts.fps || meta.fps || 12, 15));
  const dur = Math.max(0.2, Math.min(opts.duration != null ? opts.duration : (meta.duration != null ? meta.duration : 1), 1.6));
  const scale = Math.max(1, Math.min(opts.scale || 2, 3));
  const maxFrames = Math.max(2, Math.min(opts.frames || Math.ceil(fps * dur), 24));
  const dt = dur / maxFrames;

  const w = opts.width || (meta.size && meta.size[0]) || 160;
  const h = opts.height || (meta.size && meta.size[1]) || 120;
  const origin = opts.ox != null || opts.oy != null
    ? [opts.ox || 0, opts.oy || 0]
    : (meta.origin || [Math.floor(w / 2), Math.floor(h * 0.8)]);
  const bg = opts.bg != null ? opts.bg : 0xff101018;

  const safeId = id.replace(/\//g, "_");
  const frameDir = mkTempDir(`jt_pfxanim_${safeId}`);
  const gifPath = path.join(os.tmpdir(), `jt_pfx_${safeId}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.gif`);

  try {
    const frame = core.createFrame(w, h, origin[0], origin[1]);
    frame.__core = core;
    const fx = core.createFx(mod, opts.fxOpts || {});

    for (let i = 0; i < maxFrames; i++) {
      if (i > 0) fx.update(dt);
      core.clearFrame(frame);
      fx.draw(frame);
      const fp = path.join(frameDir, `frame_${String(i).padStart(4, "0")}.png`);
      writeScaledFrame(frame, w, h, scale, bg, fp);
    }

    const inputPattern = path.join(frameDir, "frame_%04d.png");
    const paletteArgs = [
      "-y",
      "-framerate", String(fps),
      "-i", inputPattern,
      "-vf", "split[s0][s1];[s0]palettegen=stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=3:diff_mode=rectangle",
      "-loop", "0",
      gifPath
    ];
    try {
      await execFileAsync(ffmpeg, paletteArgs, { timeout: 30000, windowsHide: true });
    } catch {
      const simpleArgs = [
        "-y",
        "-framerate", String(fps),
        "-i", inputPattern,
        "-vf", `fps=${fps}`,
        "-loop", "0",
        gifPath
      ];
      await execFileAsync(ffmpeg, simpleArgs, { timeout: 30000, windowsHide: true });
    }

    if (!fs.existsSync(gifPath) || fs.statSync(gifPath).size < 100) {
      throw new Error("GIF encoding produced no output");
    }

    return { path: gifPath, w: w * scale, h: h * scale, frames: maxFrames, fps, meta };
  } finally {
    rmDir(frameDir);
  }
}

function cleanup(p) {
  try { if (p && fs.existsSync(p)) fs.unlinkSync(p); } catch {}
}

module.exports = { renderFx, renderFxGif, cleanup };
