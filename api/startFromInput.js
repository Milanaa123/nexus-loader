const { parseInput } = require('../lib/input-parser');
const queue = require('../lib/job-queue');

module.exports = async function startFromInput(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method_not_allowed' });
    const body = req.body || {};
    const text = typeof body.text === 'string' ? body.text : '';
    if (!text.trim()) return res.status(400).json({ ok: false, error: 'input_text_empty' });
    const mods = parseInput(text, { defaultGame: body.game || null });
    if (!mods.length) return res.status(400).json({ ok: false, error: 'no_valid_mods' });
    const queued = queue.addJobs(mods, body.provider || 'nexus');
    return res.status(202).json({
      ok: true,
      status: 'queued',
      parsed: mods.length,
      added: queued.added,
      updated: queued.updated,
      totalQueued: queued.items.length,
      mods
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || 'queue_failed' });
  }
};
