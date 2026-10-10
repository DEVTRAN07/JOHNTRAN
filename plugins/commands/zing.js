const { createMusicCommand } = require("../../core/music/command");

module.exports = createMusicCommand("zing", {
  dependencies: { "zingmp3-api-full": "" }
});
 