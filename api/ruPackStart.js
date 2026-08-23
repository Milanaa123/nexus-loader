const fs = require('fs');
const path = require('path');
const worker = require('../scripts/ru-pack-worker');
const importer = require('../scripts/import_mod_queue');

let started = false;

module.exports = async function (req, res) {
  const root = path.join(__dirname, '..');
  const queueFile = path.join(root, 'data', 'queue', 'ru-pack-queue.json');

  try {
    if (worker.loadProgress().running) {
      return res.json({ ok: true, status: 'already_running', progress: worker.loadProgress() });
    }

    if (typeof importer === 'function') importer();

    const queue = JSON.parse(fs.readFileSync(queueFile, 'utf8'));
    const items = queue.items || queue.mods || [];

    if (!items.length) {
      return res.status(400).json({ ok: false, error: 'Queue empty' });
    }

    if (!started) {
      started = true;
      worker.start({ queue: items }).catch((e) => {
        const p = worker.loadProgress();
        worker.saveProgress({ ...p, running: false, status: 'error', lastError: e.message });
      }).finally(() => {
        started = false;
      });
    }

    return res.json({ ok: true, message: 'RU pack worker started', progress: worker.loadProgress() });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
};
