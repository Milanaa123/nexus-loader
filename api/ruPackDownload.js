const worker = require('../scripts/ru-pack-worker');

module.exports = async function (req, res) {
  try {
    const action = (req.body && req.body.action) || (req.query && req.query.action) || 'status';

    if (action === 'status') {
      const progress = worker.loadProgress();
      return res.json({ ok: true, data: progress });
    }

    if (action === 'start') {
      const progress = worker.loadProgress();
      if (progress.running) {
        return res.json({ ok: true, status: 'already_running', data: progress });
      }

      setImmediate(() => {
        worker.start(req.body || {}).catch(() => {});
      });

      return res.json({ ok: true, status: 'started' });
    }

    return res.status(400).json({ ok: false, error: 'Unknown action' });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
};
