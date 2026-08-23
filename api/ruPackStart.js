const fs = require('fs');
const path = require('path');

module.exports = async function (req, res) {
  const root = path.join(__dirname, '..');
  const workDir = path.join(root, 'RU_PACK_WORK');
  const progressFile = path.join(workDir, 'progress.json');
  const queueFile = path.join(root, 'data', 'queue', 'ru-pack-queue.json');

  fs.mkdirSync(workDir, { recursive: true });

  function buildQueue() {
    delete require.cache[require.resolve('../scripts/import_mod_queue')];
    require('../scripts/import_mod_queue');
  }

  try {
    let rebuild = !fs.existsSync(queueFile);

    if (!rebuild) {
      const current = JSON.parse(fs.readFileSync(queueFile, 'utf8'));
      const items = current.items || current.mods || [];
      rebuild = items.length === 0;
    }

    if (rebuild) buildQueue();
  } catch (e) {
    return res.status(400).json({
      ok: false,
      error: 'Queue build failed: ' + e.message
    });
  }

  const queue = JSON.parse(fs.readFileSync(queueFile, 'utf8'));
  const items = queue.items || queue.mods || [];

  if (!items.length) {
    return res.status(400).json({ ok: false, error: 'Queue is empty after rebuild' });
  }

  const progress = {
    total: items.length,
    processed: 0,
    remaining: items.length,
    foundTranslations: 0,
    downloaded: 0,
    noTranslations: 0,
    failed: 0,
    current: null,
    running: true,
    status: 'processing',
    updatedAt: new Date().toISOString()
  };

  fs.writeFileSync(progressFile, JSON.stringify(progress, null, 2));

  require('./ruPackWorker')({ body: { action: 'start' }, query: {} }, {
    json: () => {},
    status: () => ({ json: () => {} })
  }).catch(() => {});

  return res.json({ ok: true, message: 'RU pack worker started', progress });
};
