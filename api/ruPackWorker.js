const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PROGRESS = path.join(ROOT, 'RU_PACK_WORK', 'progress.json');
const QUEUE = path.join(ROOT, 'RU_PACK_WORK', 'queue.json');
const RESULT = path.join(ROOT, 'RU_PACK_WORK', 'ready.json');

function load(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return fallback; }
}

function save(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

module.exports = async function (req, res) {
  const action = (req.body && req.body.action) || (req.query && req.query.action);
  const progress = load(PROGRESS, { total: 535, ready: 0, remaining: 535, status: 'queue_ready' });

  if (action === 'status') {
    return res.json({ ok: true, data: progress });
  }

  if (action === 'start') {
    const queue = load(QUEUE, { mods: [] });
    const items = queue.mods || [];
    progress.worker = 'started';
    progress.queueSize = items.length;
    progress.status = 'processing';
    progress.lastRun = new Date().toISOString();
    save(PROGRESS, progress);
    save(RESULT, { started: progress.lastRun, queue: items });
    return res.json({ ok: true, data: progress });
  }

  return res.status(400).json({ ok: false, error: 'Unknown action' });
};
