const worker = require('../scripts/ru-pack-worker');
const path = require('path');
const { spawn } = require('child_process');

function normalize(progress) {
  return {
    total: progress.total || 0,
    processed: progress.processed || 0,
    remaining: progress.remaining || Math.max((progress.total || 0) - (progress.processed || 0), 0),
    foundTranslations: progress.foundTranslations || 0,
    downloaded: progress.downloaded || 0,
    noTranslations: progress.noTranslations || 0,
    failed: progress.failed || 0,
    current: progress.current || null,
    running: Boolean(progress.running),
    status: progress.status || 'idle',
    updatedAt: progress.updatedAt || null
  };
}

module.exports = async function (req, res) {
  try {
    const action = (req.body && req.body.action) || (req.query && req.query.action) || 'status';

    if (action === 'status') {
      return res.json({ ok: true, data: normalize(worker.loadProgress()) });
    }

    if (action === 'start') {
      const progress = normalize(worker.loadProgress());
      if (progress.running) {
        return res.json({ ok: true, status: 'already_running', data: progress });
      }

      const child = spawn(process.execPath, [path.join(__dirname, '..', 'scripts', 'ru-pack-daemon.js')], {
        detached: true,
        stdio: 'ignore'
      });
      child.unref();

      return res.json({ ok: true, message: 'RU pack worker started', progress: normalize(worker.loadProgress()) });
    }

    return res.status(400).json({ ok: false, error: 'Unknown action' });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
};
