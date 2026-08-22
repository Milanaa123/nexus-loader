const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PROGRESS = path.join(ROOT, 'RU_PACK_WORK', 'progress.json');

function loadProgress() {
  try {
    return JSON.parse(fs.readFileSync(PROGRESS, 'utf8'));
  } catch {
    return {
      total: 535,
      ready: 1,
      remaining: 534,
      updated: 0,
      fixed: 0,
      createdTranslations: 0,
      withoutTranslation: 0
    };
  }
}

function saveProgress(data) {
  fs.mkdirSync(path.dirname(PROGRESS), { recursive: true });
  fs.writeFileSync(PROGRESS, JSON.stringify(data, null, 2), 'utf8');
}

module.exports = async function (req, res) {
  const action = (req.body && req.body.action) || (req.query && req.query.action);

  if (action === 'status') {
    return res.json({ ok: true, data: loadProgress() });
  }

  if (action === 'start') {
    const p = loadProgress();
    p.worker = 'started';
    p.lastRun = new Date().toISOString();
    saveProgress(p);
    return res.json({ ok: true, data: p });
  }

  return res.status(400).json({ ok: false, error: 'Unknown action' });
};
