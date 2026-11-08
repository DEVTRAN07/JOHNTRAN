const { execFileSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const RUST_DIR = path.join(__dirname, "..", "rust");
const BIN = (() => {
  const release = path.join(RUST_DIR, "target", "release", "canvas-render");
  const debug = path.join(RUST_DIR, "target", "debug", "canvas-render");
  if (fs.existsSync(release)) return release;
  if (fs.existsSync(debug)) return debug;
  return null;
})();

function isAvailable() {
  return !!BIN && fs.existsSync(BIN);
}

function render(spec) {
  if (!isAvailable()) {
    throw new Error("Rust canvas-render binary not found. Build with: cd rust && cargo build --release");
  }
  const input = JSON.stringify(spec);
  const png = execFileSync(BIN, [], {
    input,
    maxBuffer: 64 * 1024 * 1024,
    cwd: RUST_DIR,
  });
  return png;
}

module.exports = { render, isAvailable };
