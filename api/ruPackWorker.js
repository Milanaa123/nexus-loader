const worker = require('../scripts/ru-pack-worker');

module.exports = async function(req, res) {
  const action = (req.body && req.body.action) || (req.query && req.query.action) || 'status';

  try {
    if (action === 'status') {
      return res.json({ ok: true, data: worker.loadProgress() });
    }

    if (action === 'start') {
      const current = worker.loadProgress();
      if (current.running) {
        return res.json({ ok: true, status: 'already_running', data: current });
      }

      setImmediate(() => {
        worker.start().catch((err) => {
          const progress = worker.loadProgress();
          worker.saveProgress({
            ...progress,
            running: false,
            status: 'error',
            lastError: err.message
          });
        });
      });

      return res.json({ ok: true, status: 'started', data: worker.loadProgress() });
    }

    return res.status(400).json({ ok:false, error:'Unknown action' });
  } catch (e) {
    return res.status(500).json({ ok:false, error:e.message });
  }
};
