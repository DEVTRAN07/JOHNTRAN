const test = require("node:test");
const assert = require("node:assert/strict");
const { wrapApi, DEFAULT_AUTO_RECALL_MS } = require("../core/message");

test("bot messages are scheduled for recall after one minute", async () => {
  assert.equal(DEFAULT_AUTO_RECALL_MS, 60_000);

  const originalSetTimeout = global.setTimeout;
  const scheduled = [];
  const undone = [];
  global.setTimeout = (callback, delay) => {
    scheduled.push({ callback, delay });
    return { unref() {} };
  };

  try {
    const api = {
      async sendMessage() {
        return {
          message: { msgId: 1, cliMsgId: "text-client-id" },
          attachment: [{ msgId: 2, cliMsgId: "file-client-id" }]
        };
      },
      async sendVoice() {
        return { msgId: 3, cliMsgId: "voice-client-id" };
      },
      async sendVideo() {
        return { msgId: 4, cliMsgId: "video-client-id" };
      },
      async sendSticker() {
        return { msgId: 5, cliMsgId: "sticker-client-id" };
      },
      async sendCard() {
        return { msgId: 6, cliMsgId: "card-client-id" };
      },
      async sendCustomStickerUrl() {
        return { msgId: 7, cliMsgId: "custom-sticker-client-id" };
      },
      async undo(payload, threadId, type) {
        undone.push({ payload, threadId, type });
      }
    };
    const wrapped = wrapApi(api, "thread-id", 1, "test");

    await wrapped.sendMessage({ msg: "hello" });
    await wrapped.sendVoice({ voiceUrl: "https://example.test/voice.m4a" });
    await wrapped.sendVideo({ videoUrl: "https://example.test/video.mp4" });
    await wrapped.sendSticker({ id: 1 }, "thread-id", 1);
    await wrapped.sendCard({ userId: "user-id" }, "thread-id", 1);
    await wrapped.sendCustomStickerUrl({
      staticImgUrl: "https://example.test/sticker.webp",
      threadId: "thread-id",
      threadType: 1
    });

    assert.equal(scheduled.length, 7);
    assert.ok(scheduled.every(({ delay }) => delay === 60_000));
    for (const { callback } of scheduled) await callback();
    assert.deepEqual(undone, [
      { payload: { msgId: 1, cliMsgId: "text-client-id" }, threadId: "thread-id", type: 1 },
      { payload: { msgId: 2, cliMsgId: "file-client-id" }, threadId: "thread-id", type: 1 },
      { payload: { msgId: 3, cliMsgId: "voice-client-id" }, threadId: "thread-id", type: 1 },
      { payload: { msgId: 4, cliMsgId: "video-client-id" }, threadId: "thread-id", type: 1 },
      { payload: { msgId: 5, cliMsgId: "sticker-client-id" }, threadId: "thread-id", type: 1 },
      { payload: { msgId: 6, cliMsgId: "card-client-id" }, threadId: "thread-id", type: 1 },
      { payload: { msgId: 7, cliMsgId: "custom-sticker-client-id" }, threadId: "thread-id", type: 1 }
    ]);
  } finally {
    global.setTimeout = originalSetTimeout;
  }
});
