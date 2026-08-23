const fs = require('fs');
const path = require('path');
const { downloadMod } = require('../scripts/nexus-downloader');

const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, 'RU_PACK_WORK');
const PROGRESS = path.join(DIR, 'progress.json');
const QUEUE = path.join(ROOT, 'data', 'queue', 'ru-pack-queue.json');
const RESULT = path.join(DIR, 'ready.json');

function load(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return fallback; }
}

function save(file, data) {
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

async function runWorker() {
  const queue = load(QUEUE, { items: [] });
  const items = queue.items || [];
  const progress = load(PROGRESS, { processed: 0 });
  const result = load(RESULT, { found: [], missing: [], failed: [] });

  progress.total = items.length;
  progress.running = true;
  progress.status = 'processing';
  save(PROGRESS, progress);

  for (let i = progress.processed || 0; i < items.length; i++) {
    const item = items[i];
    progress.current = item;
    save(PROGRESS, progress);

    try {
      if (!item.modId || !item.fileId) {
        result.missing.push(item);
        progress.noTranslations = (progress.noTranslations || 0) + 1;
      } else {
        const file = await downloadMod({ modId: item.modId, fileId: item.fileId });
        result.found.push({ item, file });
        progress.downloaded = (progress.downloaded || 0) + 1;
      }
    } catch (e) {
      result.failed.push({ item, error: e.message });
      progress.failed = (progress.failed || 0) + 1;
    }

    progress.processed = i + 1;
    progress.remaining = items.length - progress.processed;
    progress.updatedAt = new Date().toISOString();
    save(RESULT, result);
    save(PROGRESS, progress);
  }

  progress.current = null;
  progress.running = false;
  progress.status = 'finished';
  save(PROGRESS, progress);
}

module.exports = async function(req, res) {
  const action = (req.body && req.body.action) || (req.query && req.query.action);
  if (action === 'status') return res.json({ ok: true, data: load(PROGRESS, { total: 0 }) });
  if (action === 'start') {
    runWorker().catch(err => {
      const p = load(PROGRESS, {});
      p.running = false;
      p.status = 'error';
      p.error = err.message;
      save(PROGRESS, p);
    });
    return res.json({ ok: true, message: 'RU pack worker started' });
  }
  return res.status(400).json({ ok: false, error: 'Unknown action' });
};
