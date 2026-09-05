const { parseModList } = require('../lib/input-parser');
const worker = require('../scripts/ru-pack-worker');

module.exports = async function(req, res) {
  try {
    const body = req.body || {};
    const text = typeof body.text === 'string' ? body.text : '';
    if (!text.trim()) {
      return res.status(400).json({ ok:false, error:'Input text is empty' });
    }

    const mods = parseModList(text, body.format || null);
    if (!mods.length) {
      return res.status(400).json({ ok:false, error:'No valid mods found' });
    }

    worker.processQueue(mods).catch(err => {
      console.error('startFromInput worker error', err.message);
    });

    return res.json({
      ok:true,
      status:'started',
      count:mods.length,
      mods
    });
  } catch (e) {
    return res.status(500).json({ ok:false, error:e.message });
  }
};
