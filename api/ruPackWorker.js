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

async function runWorker() {
  const queue = load(QUEUE, { mods: [] });
  const items = queue.mods || [];
  const progress = load(PROGRESS, { total: items.length });
  progress.total = items.length || progress.total || 535;
  progress.running = true;
  progress.status = 'processing';

  for (let i = progress.processed || 0; i < items.length; i++) {
    progress.current = items[i];
    progress.processed = i + 1;
    progress.remaining = items.length - progress.processed;
    save(PROGRESS, progress);
    await new Promise(r => setTimeout(r, 200));
  }

  progress.running = false;
  progress.current = null;
  progress.status = 'finished';
  save(PROGRESS, progress);
  save(RESULT, { finished: new Date().toISOString(), progress });
}

module.exports = async function (req, res) {
  const action = (req.body && req.body.action) || (req.query && req.query.action);

  if (action === 'status') {
    return res.json({ ok: true, data: load(PROGRESS, { total: 0 }) });
  }

  if (action === 'start') {
    runWorker();
    return res.json({ ok: true, message: 'RU pack worker started' });
  }

  return res.status(400).json({ ok: false, error: 'Unknown action' });
};
