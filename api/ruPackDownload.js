const worker = require('../scripts/ru-pack-worker');

module.exports = async function (req, res) {
  try {
    const action = (req.body && req.body.action) || (req.query && req.query.action) || 'status';

    if (action === 'status') {
      return res.json({ ok: true, service: 'ruPackDownload', status: 'ready' });
    }

    if (action === 'start') {
      const result = await worker.start(req.body || {});
      return res.json({ ok: true, data: result });
    }

    return res.status(400).json({ ok: false, error: 'Unknown action' });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
};
