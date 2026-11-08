const fs = require('fs');
const path = require('path');
const os = require('os');
const rustBridge = require('./rustBridge');

async function renderSearchGrid(query, tracks, { page = 1, totalPages = 1, source }) {
  const perPage = 7;
  const shown = tracks.slice(0, perPage);
  const png = rustBridge.render({
    type: 'search_grid',
    query,
    tracks: shown.map(t => ({ title: t.title, artist: t.artist, duration: t.duration, plays: t.plays, likes: t.likes })),
    page, totalPages, source: source || 'SOUNDCLOUD'
  });
  const outPath = path.join(os.tmpdir(), 'jt_music_grid_' + Date.now() + '.png');
  fs.writeFileSync(outPath, png);
  return outPath;
}

async function renderNowPlaying(track, sourceLabel) {
  const png = rustBridge.render({
    type: 'now_playing',
    track: track ? { title: track.title, artist: track.artist, duration: track.duration, plays: track.plays, likes: track.likes, thumbnail: track.thumbnail } : null,
    source: sourceLabel || (track && track.source) || 'SOUNDCLOUD'
  });
  const outPath = path.join(os.tmpdir(), 'jt_music_now_' + Date.now() + '.png');
  fs.writeFileSync(outPath, png);
  return outPath;
}

module.exports = { renderSearchGrid, renderNowPlaying };
