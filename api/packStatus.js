const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const WORK = path.join(ROOT, 'RU_PACK_WORK');

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return fallback; }
}

module.exports = function packStatus(req, res) {
  const progress = readJson(path.join(WORK, 'progress.json'), {
    running: false,
    status: 'unknown'
  });

  const results = readJson(path.join(WORK, 'ru_results.json'), []);
  const items = Array.isArray(results) ? results : [];

  res.json({
    ok: true,
    progress,
    summary: {
      total: items.length,
      built: items.filter(x => x.status === 'built').length,
      errors: items.filter(x => x.status === 'error').length,
      translations: items.filter(x => x.translationId).length
    },
    ready: items.filter(x => x.status === 'built').map(x => ({
      name: x.name,
      output: x.output,
      sha256: x.sha256
    }))
  });
};
