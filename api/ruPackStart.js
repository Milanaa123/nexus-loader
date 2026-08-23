const fs = require('fs');
const path = require('path');

module.exports = async function (req, res) {
  const root = path.join(__dirname, '..');
  const progressFile = path.join(root, 'RU_PACK_WORK', 'progress.json');
  const queueFile = path.join(root, 'RU_PACK_WORK', 'queue.json');

  const queue = fs.existsSync(queueFile) ? JSON.parse(fs.readFileSync(queueFile, 'utf8')) : { mods: [] };

  const progress = {
    total: queue.mods?.length || 535,
    processed: 0,
    remaining: queue.mods?.length || 535,
    foundTranslations: 0,
    downloaded: 0,
    noTranslations: 0,
    failed: 0,
    current: null,
    running: true,
    status: 'processing'
  };

  fs.mkdirSync(path.dirname(progressFile), { recursive: true });
  fs.writeFileSync(progressFile, JSON.stringify(progress, null, 2), 'utf8');

  const worker = require('./ruPackWorker');
  await worker({ body: { action: 'start' }, query: {} }, { json: () => {} , status: () => ({ json: () => {} }) });

  return res.json({ ok: true, message: 'RU pack worker started', progress });
};
