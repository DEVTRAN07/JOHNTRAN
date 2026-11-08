const fs = require('fs');
const path = require('path');
const os = require('os');
const rustBridge = require('./rustBridge');

async function renderVipCard(spec) {
  const png = rustBridge.render({ type: 'vip', ...(spec || {}) });
  const outPath = path.join(os.tmpdir(), 'jt_vip_card_' + Date.now() + '.png');
  fs.writeFileSync(outPath, png);
  return outPath;
}

module.exports = { renderVipCard };
