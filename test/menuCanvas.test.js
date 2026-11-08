const assert = require("node:assert/strict");
const fs = require("node:fs");
const { loadImage } = require("canvas");
const { test } = require("node:test");
const theme = require("../core/canvas/theme");
const { renderMenuGrid } = require("../core/canvas/menu");

test("menu renders grouped command cards inside a macOS window", async () => {
  const filePath = await renderMenuGrid({
    requesterName: "Nguyễn Văn A",
    requesterAvatarUrl: "",
    botVersion: "1.2.0",
    prefix: "/",
    page: 1,
    totalPages: 1,
    totalCommands: 2,
    categories: [
      { name: "Info", commands: [{ name: "help" }] },
      { name: "Music", commands: [{ name: "play" }] }
    ]
  });

  try {
    const image = await loadImage(fs.readFileSync(filePath));
    const scale = theme.WIDTH / 750;
    assert.equal(image.width, theme.WIDTH);
    assert.ok(image.height > 44 * scale);
  } finally {
    fs.unlinkSync(filePath);
  }
});
