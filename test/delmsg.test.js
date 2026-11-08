const test = require("node:test");
const assert = require("node:assert/strict");
const { getTargetUid, getRecentMessages } = require("../plugins/commands/delmsg");

test("delmsg selects a single mentioned user before a quoted user", () => {
  assert.equal(getTargetUid({
    mentions: [{ uid: "12345" }],
    data: { quote: { uidFrom: "67890" } }
  }), "12345");
});

test("delmsg selects the quoted sender and rejects multiple mentions", () => {
  assert.equal(getTargetUid({ data: { quote: { ownerId: "12345" } } }), "12345");
  assert.equal(getTargetUid({ mentions: [{ uid: "1" }, { uid: "2" }] }), null);
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
