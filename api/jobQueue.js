const queue = require('../lib/job-queue');

async function jobQueueHandler(req, res) {
  if (req.method === 'GET' || req.method === 'HEAD') {
    return res.json({ ok: true, ...queue.stats(), items: queue.load() });
  }
  if (req.method === 'POST') {
    const mods = Array.isArray(req.body?.mods) ? req.body.mods : [];
    if (!mods.length) return res.status(400).json({ ok: false, error: 'mods_required' });
    const result = queue.addJobs(mods, req.body?.provider || 'nexus');
    return res.status(202).json({ ok: true, status: 'queued', added: result.added, updated: result.updated, total: result.items.length });
  }
  return res.status(405).json({ ok: false, error: 'method_not_allowed' });
}

Object.assign(jobQueueHandler, queue);
module.exports = jobQueueHandler;
