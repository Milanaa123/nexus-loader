const queue = require('../lib/job-queue');

async function jobQueueHandler(req, res) {
  const storage = require('../lib/runtime-storage').getStores().queue;
  if (req.method === 'GET' || req.method === 'HEAD') {
    const items = await storage.load();
    const statuses = {};
    for (const item of items) statuses[item.status || 'queued'] = (statuses[item.status || 'queued'] || 0) + 1;
    return res.json({ ok: true, total: items.length, statuses, items });
  }
  if (req.method === 'POST') {
    const mods = Array.isArray(req.body?.mods) ? req.body.mods : [];
    if (!mods.length) return res.status(400).json({ ok: false, error: 'mods_required' });
    const result = await storage.addJobs(mods, req.body?.provider || 'nexus');
    return res.status(202).json({ ok: true, status: 'queued', added: result.added, updated: result.updated, total: result.items.length });
  }
  return res.status(405).json({ ok: false, error: 'method_not_allowed' });
}

Object.assign(jobQueueHandler, queue);
module.exports = jobQueueHandler;
