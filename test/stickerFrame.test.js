const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { createCanvas, Image } = require("canvas");
const converter = require("../core/stickerConvert");
const stickerCommand = require("../plugins/commands/stk");
const { test } = require("node:test");

const hasFfmpeg = spawnSync("ffmpeg", ["-version"], { stdio: "ignore" }).status === 0;

test("/stk ghép khung mong vuốt rồng lên sticker", { skip: !hasFfmpeg }, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "johntran-sticker-frame-"));
  try {
    const canvas = createCanvas(240, 240);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#3366cc";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const result = await converter.makeStickerFile(
      "https://example.test/frame-source.png",
      dir,
      false,
      async () => ({ buffer: canvas.toBuffer("image/png") })
    );
    assert.equal(result.width, 480);
    assert.equal(result.height, 480);

    const extracted = path.join(dir, "first-frame.png");
    const extraction = spawnSync("ffmpeg", [
      "-y", "-i", result.path, "-frames:v", "1", "-update", "1", extracted
    ], { encoding: "utf8" });
    assert.equal(extraction.status, 0, extraction.stderr);

    const frame = new Image();
    frame.src = fs.readFileSync(extracted);
    const rendered = createCanvas(frame.width, frame.height);
    const renderedContext = rendered.getContext("2d");
    renderedContext.drawImage(frame, 0, 0);
    const pixels = renderedContext.getImageData(0, 0, frame.width, frame.height).data;
    let pixelsChangedByFrame = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      if (Math.abs(pixels[i] - 51) > 20 || Math.abs(pixels[i + 1] - 102) > 20 ||
          Math.abs(pixels[i + 2] - 204) > 20) {
        pixelsChangedByFrame++;
      }
    }
    assert.ok(pixelsChangedByFrame > 10000, "frame artwork should be visible in the output");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("/stk <URL> cũng đi qua xử lý ghép khung", { skip: !hasFfmpeg }, async () => {
  const canvas = createCanvas(120, 120);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#3366cc";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  let uploadedFileWasValid = false;
  let previewWasValid = false;
  let sentSticker;
  const operations = [];

  await stickerCommand.run({
    api: {
      sendMessage: async (payload) => {
        if (payload.attachments) {
          const preview = fs.readFileSync(payload.attachments);
          previewWasValid = preview.subarray(1, 4).toString() === "PNG";
          operations.push("preview");
        }
      },
      fetchZaloMedia: async () => ({ buffer: canvas.toBuffer("image/png") }),
      uploadStickerImage: async ({ filePath }) => {
        const output = fs.readFileSync(filePath);
        uploadedFileWasValid = output.subarray(0, 3).toString() === "GIF" ||
          output.subarray(8, 12).toString() === "WEBP";
        operations.push("upload");
        return { normalUrl: "https://cdn.example.test/framed-sticker" };
      },
      sendCustomStickerUrl: async (payload) => {
        sentSticker = payload;
        operations.push("sticker");
      }
    },
    event: { threadId: "test-thread", type: 0, data: {} },
    args: ["https://files.zdn.vn/source.png"]
  });

  assert.ok(uploadedFileWasValid, "URL input should be converted before upload");
  assert.ok(previewWasValid, "preview should be a valid PNG");
  assert.deepEqual(operations, ["preview", "upload", "sticker"]);
  assert.equal(sentSticker.staticImgUrl, sentSticker.animationImgUrl);
});
