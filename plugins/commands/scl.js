const { createMusicCommand } = require("../../core/music/command");

module.exports = createMusicCommand("scl", {
  dependencies: { "zingmp3-api-full": "" }
});
