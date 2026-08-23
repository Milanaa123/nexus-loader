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

  const progress = {
    total,
    processed: 0,
    remaining: total,
    foundTranslations: 0,
    downloaded: 0,
    noTranslations: 0,
    failed: 0,
    current: null,
    running: true,
    status: 'processing',
    updatedAt: new Date().toISOString()
  };

  fs.writeFileSync(progressFile, JSON.stringify(progress, null, 2), 'utf8');

  const worker = require('./ruPackWorker');
  worker({ body: { action: 'start' }, query: {} }, {
    json: () => {},
    status: () => ({ json: () => {} })
  }).catch(err => {
    const failed = {
      ...progress,
      running: false,
      status: 'failed',
      error: err.message,
      updatedAt: new Date().toISOString()
    };
    fs.writeFileSync(progressFile, JSON.stringify(failed, null, 2), 'utf8');
  });

  return res.json({ ok: true, message: 'RU pack worker started', progress });
};
