const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const worker = require('../scripts/ru-pack-worker');
const importer = require('../scripts/import_mod_queue');

module.exports = async function (req, res) {
  const root = path.join(__dirname, '..');
  const queueFile = path.join(root, 'data', 'queue', 'ru-pack-queue.json');

  try {
    const current = worker.loadProgress();
    if (current.running) {
      return res.json({ ok: true, status: 'already_running', progress: current });
    }

    if (typeof importer === 'function') importer();

    const queue = JSON.parse(fs.readFileSync(queueFile, 'utf8'));
    const items = queue.items || queue.mods || [];

    if (!items.length) {
      return res.status(400).json({ ok: false, error: 'Queue empty' });
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
      status: 'starting',
      updatedAt: new Date().toISOString()
    };
    worker.saveProgress(progress);

    const child = spawn(process.execPath, [path.join(root, 'scripts', 'ru-pack-daemon.js')], {
      detached: true,
      stdio: 'ignore'
    });
    child.unref();

    return res.json({ ok: true, message: 'RU pack worker started', progress });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
};
