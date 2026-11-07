const fs = require("fs");
const os = require("os");
const path = require("path");
const { pathToFileURL } = require("url");
const { execFile } = require("child_process");
const { promisify } = require("util");
const { createCanvas } = require("canvas");

const execFileAsync = promisify(execFile);

const VENDOR = path.resolve(__dirname, "..", "..", "vendor", "pixelfx");

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
  "melee/combat-scene": "src/fx/melee/combat-scene.js",
};

const LOCAL_CORE_FILE = path.join(VENDOR, "src", "core", "index.js");
const LOCAL_CORE_URL = pathToFileURL(LOCAL_CORE_FILE).href;

const VALID_ID = /^[a-z0-9_-]+(?:\/[a-z0-9_-]+)*$/i;
const VALID_REL = /^[a-z0-9][a-z0-9_\/-]*\.js$/i;
const fetchedPaths = new Set();

function envSource() {
  const v = String(process.env.PIXELFX_SOURCE || "local").toLowerCase();
  return v === "raw" || v === "hybrid" ? v : "local";
}
function rawRepo() { return String(process.env.PIXELFX_RAW_REPO || "patch-gg/pixelfx"); }
function rawRef() { return String(process.env.PIXELFX_RAW_REF || "main"); }
function rawBaseUrl() {
  const o = process.env.PIXELFX_RAW_BASE;
  if (o) return String(o).replace(/\/+$/, "");
  return `https://raw.githubusercontent.com/${rawRepo()}/${rawRef()}`;
}
function safeCacheSegment(s) {
  return String(s).replace(/[^a-z0-9._@-]+/gi, "_").slice(0, 180) || "default";
}
function cacheRootDir() {
  const base = process.env.PIXELFX_CACHE_DIR || path.join(os.tmpdir(), "jt_pixelfx_cache");
  return path.join(base, safeCacheSegment(`${rawRepo()}@${rawRef()}`));
}

function isSafeId(id) {
  return typeof id === "string" && id.length > 0 && id.length < 200 && !id.includes("..") && !id.startsWith("/") && VALID_ID.test(id);
}
function isSafeRel(rel) {
  return typeof rel === "string" && rel.length > 0 && rel.length < 300 && !rel.includes("..") && !rel.startsWith("/") && VALID_REL.test(rel) && rel.startsWith("src/");
}

function ensurePackageJson(root) {
  fs.mkdirSync(root, { recursive: true });
  const p = path.join(root, "package.json");
  if (!fs.existsSync(p)) fs.writeFileSync(p, '{"type":"module"}\n');
}

function copyDirSync(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const name of fs.readdirSync(src)) {
    const s = path.join(src, name);
    const d = path.join(dst, name);
    const st = fs.statSync(s);
    if (st.isDirectory()) copyDirSync(s, d);
    else fs.copyFileSync(s, d);
  }
}

function ensureCacheCore(root) {
  const dst = path.join(root, "src", "core");
  if (fs.existsSync(path.join(dst, "index.js"))) return;
  const src = path.join(VENDOR, "src", "core");
  if (!fs.existsSync(src)) throw new Error("Local pixelfx core unavailable and raw core fetch not implemented");
  copyDirSync(src, dst);
}

async function fetchToCache(cacheRoot, relPath, rawBase) {
  if (!isSafeRel(relPath)) throw new Error(`Unsafe pixelfx path: ${relPath}`);
  const base = String(rawBase).replace(/\/+$/, "");
  let host;
  try { host = new URL(base).host; } catch { throw new Error(`Invalid PIXELFX_RAW_BASE: ${base}`); }
  if (host !== "raw.githubusercontent.com") throw new Error(`PIXELFX_RAW_BASE host not allowed: ${host}`);
  const dest = path.join(cacheRoot, relPath);
  const key = dest;
  if (fetchedPaths.has(key) && fs.existsSync(dest) && fs.statSync(dest).size > 0) return dest;
  if (fs.existsSync(dest) && fs.statSync(dest).size > 0) { fetchedPaths.add(key); return dest; }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const url = `${base}/${relPath}`;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 15000);
  let res;
  try {
    res = await fetch(url, { signal: ac.signal, headers: { "user-agent": "johntran-pixelfx/1.0" } });
  } catch (e) {
    const msg = e && e.name === "AbortError" ? "timeout" : (e && e.message) || String(e);
    throw new Error(`Failed to fetch pixelfx module ${relPath} from ${url}: ${msg}`);
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw new Error(`Failed to fetch pixelfx module ${relPath}: HTTP ${res.status} ${res.statusText} (${url})`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (!buf.length) throw new Error(`Empty pixelfx module fetched: ${relPath}`);
  fs.writeFileSync(dest, buf);
  fetchedPaths.add(key);
  return dest;
}

async function resolveFx(id) {
  if (typeof id !== "string" || !id) throw new Error("Invalid fx id");
  let rel = FX_MAP[id];
  if (!rel) {
    if (!isSafeId(id)) throw new Error(`Unknown or unsafe fx id: ${id}`);
    rel = `src/fx/${id}.js`;
  }
  if (!isSafeRel(rel)) throw new Error(`Unsafe fx path mapping: ${rel}`);

  const localFx = path.join(VENDOR, rel);
  const localFxExists = fs.existsSync(localFx);
  const source = envSource();
  // melee/combat-scene and any existing local file always prefer local, even in raw mode.
  if (localFxExists) {
    return { fxUrl: pathToFileURL(localFx).href, coreUrl: LOCAL_CORE_URL, metaHint: null };
  }

  if (source !== "hybrid" && source !== "raw") {
    throw new Error(`Unknown fx id: ${id} (local file missing; set PIXELFX_SOURCE=hybrid|raw to fetch)`);
  }

  const root = cacheRootDir();
  ensurePackageJson(root);
  ensureCacheCore(root);
  const cachedFx = await fetchToCache(root, rel, rawBaseUrl());
  // fx imports ../../core/* relative to src/fx/*, so core must exist in cache root.
  return { fxUrl: pathToFileURL(cachedFx).href, coreUrl: LOCAL_CORE_URL, metaHint: null };
}

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
  core.composite(frame, rgba, bg != null ? bg : null, 1);
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
  const { fxUrl, coreUrl } = await resolveFx(id);
  const core = await import(coreUrl);
  const mod = await import(fxUrl);
  const meta = mod.meta || {};
  const w = opts.width || (meta.size && meta.size[0]) || 160;
  const h = opts.height || (meta.size && meta.size[1]) || 120;
  const origin = opts.ox != null || opts.oy != null
    ? [opts.ox || 0, opts.oy || 0]
    : (meta.origin || [Math.floor(w / 2), Math.floor(h * 0.8)]);
  const frame = core.createFrame(w, h, 0, 0);
  core.clearFrame(frame);
  const fxOpts = { ...(opts.fxOpts || {}), x: origin[0], y: origin[1] };
  const fx = core.createFx(mod, fxOpts);
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
  core.composite(frame, rgba, opts.bg != null ? opts.bg : null, 1);
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
  const safeId = String(id).replace(/[^a-z0-9_-]+/gi, "_");
  const filePath = path.join(os.tmpdir(), `jt_pfx_${safeId}_${ts}.png`);
  fs.writeFileSync(filePath, buf);
  return { path: filePath, w: w * scale, h: h * scale, meta };
}

async function renderFxGif(id, opts = {}) {
  const { fxUrl, coreUrl } = await resolveFx(id);
  const ffmpeg = resolveFfmpeg();
  if (!ffmpeg) throw new Error("ffmpeg-static not available");

  const core = await import(coreUrl);
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

  const safeId = String(id).replace(/[^a-z0-9_-]+/gi, "_");
  const frameDir = mkTempDir(`jt_pfxanim_${safeId}`);
  const gifPath = path.join(os.tmpdir(), `jt_pfx_${safeId}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.gif`);

  try {
    const frame = core.createFrame(w, h, 0, 0);
    frame.__core = core;
    const fx = core.createFx(mod, { ...(opts.fxOpts || {}), x: origin[0], y: origin[1] });

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

function listFx() {
  const out = new Set(Object.keys(FX_MAP));
  try {
    const fxRoot = path.join(VENDOR, "src", "fx");
    for (const cat of fs.readdirSync(fxRoot, { withFileTypes: true })) {
      if (!cat.isDirectory()) continue;
      for (const f of fs.readdirSync(path.join(fxRoot, cat.name), { withFileTypes: true })) {
        if (!f.isFile() || !f.name.endsWith(".js") || f.name.startsWith("_")) continue;
        out.add(`${cat.name}/${f.name.replace(/\.js$/i, "")}`);
      }
    }
  } catch {}
  return Array.from(out).sort();
}

function cleanup(p) {
  try { if (p && fs.existsSync(p)) fs.unlinkSync(p); } catch {}
}

module.exports = { renderFx, renderFxGif, cleanup, listFx, _internal: { resolveFx, fetchToCache, cacheRootDir, rawBaseUrl, envSource } };
