const fs = require('fs');
const path = require('path');
const os = require('os');
const rustBridge = require('./rustBridge');

async function renderMenuGrid({ commands, page, totalPages, totalCommands, botVersion, requesterName, prefix }) {
  const png = rustBridge.render({
    type: 'menu',
    commands: commands.map(c => ({ name: c.name, usage: c.usage, category: c.category })),
    page, totalPages, totalCommands, botVersion, requesterName, prefix
  });
  const outPath = path.join(os.tmpdir(), 'jt_menu_grid_' + Date.now() + '.png');
  fs.writeFileSync(outPath, png);
  return outPath;
}

module.exports = { renderMenuGrid };
