const test = require("node:test");
const assert = require("node:assert/strict");
const { ThreadType } = require("zalo-client");
const { getTargetUid, getRecentMessages } = require("../plugins/commands/delmsg");
const delmsg = require("../plugins/commands/delmsg");
const { shouldReplayOldMessage } = require("../core/listen");

test("delmsg selects the tagged user", () => {
  assert.equal(getTargetUid({
    data: {
      mentions: [{ uid: "12345" }],
      quote: { uidFrom: "67890" }
    }
  }, "admin-id"), "12345");
});

test("delmsg defaults to the caller even when replying to another user", () => {
  assert.equal(getTargetUid({
    data: { quote: { uidFrom: "quoted-user" } }
  }, "admin-id"), "admin-id");
});

test("delmsg rejects multiple direct mentions", () => {
  assert.equal(getTargetUid({
    data: { mentions: [{ uid: "1" }, { uid: "2" }] }
  }, "admin-id"), null);
});

test("delmsg returns only the latest matching group messages in the 24-hour window", () => {
  const now = Date.now();
  const cache = {
    old: { threadId: "g1", type: 1, uidFrom: "u1", timestamp: now - 25 * 60 * 60 * 1000, msgId: 1, cliMsgId: "old" },
    otherThread: { threadId: "g2", type: 1, uidFrom: "u1", timestamp: now - 1000, msgId: 2, cliMsgId: "other-thread" },
    otherUser: { threadId: "g1", type: 1, uidFrom: "u2", timestamp: now - 2000, msgId: 3, cliMsgId: "other-user" },
    private: { threadId: "g1", type: 0, uidFrom: "u1", timestamp: now - 3000, msgId: 4, cliMsgId: "private" },
    older: { threadId: "g1", type: 1, uidFrom: "u1", timestamp: now - 5000, msgId: 5, cliMsgId: "older" },
    latest: { threadId: "g1", type: 1, uidFrom: "u1", timestamp: now - 1000, msgId: 6, cliMsgId: "latest" }
  };

  const selected = getRecentMessages(cache, "g1", "u1", 1, now);
  assert.deepEqual(selected.map((message) => message.cliMsgId), ["latest"]);
});

test("delmsg accepts cached message timestamps in seconds", () => {
  const now = Date.now();
  const message = {
    threadId: "g1",
    type: ThreadType.Group,
    uidFrom: "u1",
    timestamp: Math.floor((now - 1000) / 1000),
    msgId: 7,
    cliMsgId: "seconds-timestamp"
  };
  assert.deepEqual(
    getRecentMessages({ one: message }, "g1", "u1", 1, now).map((item) => item.cliMsgId),
    ["seconds-timestamp"]
  );
});

test("delmsg explains that old group history is unavailable when cache is empty", async () => {
  const previousUsers = global.users;
  const callerUid = "delmsg-history-caller";
  const threadId = "delmsg-history-group";
  global.users = { admin: [callerUid] };
  let historyRequested = false;
  let response;

  try {
    await delmsg.run({
      api: {
        getGroupChatHistory: async () => {
          historyRequested = true;
          throw new Error("endpoint unavailable");
        },
        deleteMessage: async () => assert.fail("must not delete without cached messages")
      },
      event: {
        threadId,
        type: ThreadType.Group,
        data: { uidFrom: callerUid }
      },
      args: ["1"],
      reply: {
        error: (message) => message,
        text: (message) => { response = message; },
        success: (message) => message,
        warn: (message) => message
      }
    });

    assert.equal(historyRequested, false);
    assert.match(response, /Zalo không còn cho bot tải lịch sử nhóm/);
  } finally {
    global.users = previousUsers;
  }
});

test("startup backfill caches old messages without replaying their commands", () => {
  const reconnectSince = Date.now();
  assert.equal(shouldReplayOldMessage({
    data: { ts: Math.floor((reconnectSince - 60_000) / 1000) }
  }, reconnectSince), false);
  assert.equal(shouldReplayOldMessage({
    data: { ts: reconnectSince - 60_000 }
  }, reconnectSince), false);
  assert.equal(shouldReplayOldMessage({
    data: { ts: reconnectSince }
  }, reconnectSince), true);
  assert.equal(shouldReplayOldMessage({ data: {} }, reconnectSince), false);
});
