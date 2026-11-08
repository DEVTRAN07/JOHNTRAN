const assert = require("assert");
const fs = require("fs");
const http = require("../core/http");
const command = require("../plugins/commands/girl");

async function main() {
  const originalGetBuffer = http.getBuffer;
  const messages = [];
  let attachmentExistsWhenSent = false;

  http.getBuffer = async (url) => {
    assert.ok(command.config.name === "girl");
    assert.ok(url.startsWith("https://"));
    return { buffer: Buffer.from("image"), contentType: "image/jpeg" };
  };

  try {
    await command.run({
      event: { threadId: "test-thread", type: 1 },
      api: {
        async sendMessage(message) {
          messages.push(message);
          if (message.attachments) attachmentExistsWhenSent = fs.existsSync(message.attachments);
        }
      }
    });
  } finally {
    http.getBuffer = originalGetBuffer;
  }

  assert.strictEqual(messages.length, 1);
  assert.ok(messages[0].attachments);
  assert.strictEqual(attachmentExistsWhenSent, true);
  assert.strictEqual(fs.existsSync(require("path").dirname(messages[0].attachments)), false);
  console.log("✓ girl tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
