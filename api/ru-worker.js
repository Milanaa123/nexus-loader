const fs = require('fs');
const path = require('path');

module.exports = async function(req, res) {
  const root = path.join(__dirname, '..');
  const queueFile = path.join(root, 'queue.json');

  let queue = [];
  if (fs.existsSync(queueFile)) {
    try { queue = JSON.parse(fs.readFileSync(queueFile, 'utf8')); } catch (_) { queue = []; }
  }

  const batch = queue.filter(x => !x.done).slice(0, 20).map(x => ({
    name: x.name,
    status: 'queued_for_ru_check'
  }));

  return res.json({
    ok: true,
    batchSize: batch.length,
    batch
  });
};
