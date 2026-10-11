const { createMusicCommand } = require("../../core/music/command");

module.exports = createMusicCommand("spt", {
  dependencies: {},
    requires: [
        { key: "music.spotify_client_id", label: "Spotify client_id/secret (music.spotify_*)", optional: true }
    ]
});
