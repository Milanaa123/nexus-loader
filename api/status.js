const fs = require('fs');
const path = require('path');

module.exports = async function(req, res) {
  const root = path.join(__dirname, '..');
  const stateFile = path.join(root, 'RU_PACK_WORK', 'generator_status.json');
  const queueFile = path.join(root, 'queue.json');

  let data = {};
  let queue = [];

  try { data = JSON.parse(fs.readFileSync(stateFile, 'utf8')); } catch (_) {}
  try { queue = JSON.parse(fs.readFileSync(queueFile, 'utf8')); } catch (_) {}

  const total = data.total || queue.length || 0;
  const processed = data.processed || queue.filter(x => x.status && x.status !== 'waiting').length;

  return res.json({
    ok: true,
    running: Boolean(data.running),
    total,
    processed,
    remaining: Math.max(0, total - processed),
    foundTranslations: queue.filter(x => x.status === 'translation_found').length,
    noTranslations: queue.filter(x => x.status === 'no_translation_found').length,
    current: data.current || null
  });
};
