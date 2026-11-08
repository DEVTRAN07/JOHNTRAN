const test = require("node:test");
const assert = require("node:assert/strict");
const { ThreadType } = require("zalo-client");
const { getTargetUid, getRecentMessages } = require("../plugins/commands/delmsg");
const delmsg = require("../plugins/commands/delmsg");

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

test("delmsg reads SDK group history when the local cache has no matching messages", async () => {
  const previousUsers = global.users;
  const callerUid = "delmsg-history-caller";
  const threadId = "delmsg-history-group";
  const now = Date.now();
  const deleted = [];
  let historyRequest;
  global.users = { admin: [callerUid] };

  try {
    await delmsg.run({
      api: {
        getGroupChatHistory: async (...args) => {
          historyRequest = args;
          return {
            groupMsgs: [{
              threadId,
              type: ThreadType.Group,
              data: {
                uidFrom: callerUid,
                idTo: threadId,
                ts: now,
                msgId: "history-msg",
                cliMsgId: "history-client-msg"
              }
            }]
          };
        },
        deleteMessage: async (destination, onlyMe) => deleted.push({ destination, onlyMe })
      },
      event: {
        threadId,
        type: ThreadType.Group,
        data: { uidFrom: callerUid }
      },
      args: ["1"],
      reply: {
        error: (message) => message,
        text: (message) => message,
        success: (message) => message,
        warn: (message) => message
      }
    });

    assert.deepEqual(historyRequest, [threadId, 100]);
    assert.equal(deleted.length, 1);
    assert.equal(deleted[0].destination.data.msgId, "history-msg");
    assert.equal(deleted[0].destination.data.cliMsgId, "history-client-msg");
    assert.equal(deleted[0].onlyMe, false);
  } finally {
    global.users = previousUsers;
  }
});
