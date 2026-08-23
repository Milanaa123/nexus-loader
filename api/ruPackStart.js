const fs = require('fs');
const path = require('path');

module.exports = async function (req, res) {
  const root = path.join(__dirname, '..');
  const workDir = path.join(root, 'RU_PACK_WORK');
  const progressFile = path.join(workDir, 'progress.json');
  const queueFile = path.join(workDir, 'queue.json');

  fs.mkdirSync(workDir, { recursive: true });

  const queue = fs.existsSync(queueFile)
    ? JSON.parse(fs.readFileSync(queueFile, 'utf8'))
    : { mods: [] };

  const total = queue.mods?.length || 535;
  const old = fs.existsSync(progressFile)
    ? JSON.parse(fs.readFileSync(progressFile, 'utf8'))
    : {};

  const progress = {
    total,
    processed: old.processed || 0,
    remaining: Math.max(total - (old.processed || 0), 0),
    foundTranslations: old.foundTranslations || 0,
    downloaded: old.downloaded || 0,
    noTranslations: old.noTranslations || 0,
    failed: old.failed || 0,
    current: old.current || null,
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
