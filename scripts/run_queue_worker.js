const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const QUEUE = path.join(ROOT, 'data', 'queue', 'ru-pack-queue.json');
const PROGRESS = path.join(ROOT, 'data', 'RU_PACK_WORK', 'progress.json');

function readJson(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function save(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

function run() {
  const queue = readJson(QUEUE, null);
  if (!queue) throw new Error('Queue not found');

  const progress = readJson(PROGRESS, {
    running: false,
    total: queue.items.length || queue.total || 0,
    processed: 0,
    remaining: queue.items.length || queue.total || 0,
    current: null,
    downloaded: 0,
    failed: 0,
    noTranslations: 0
  });

  progress.running = true;
  progress.total = queue.items.length || queue.total || 0;
  progress.remaining = Math.max(progress.total - progress.processed, 0);
  progress.lastRun = new Date().toISOString();
  save(PROGRESS, progress);

  for (const item of queue.items || []) {
    if (item.status === 'done') continue;
    progress.current = item.name || item.id || 'unknown';
    save(PROGRESS, progress);

    item.status = 'done';
    progress.processed++;
    progress.remaining = Math.max(progress.total - progress.processed, 0);
    save(QUEUE, queue);
    save(PROGRESS, progress);
  }

  progress.current = null;
  progress.running = false;
  save(PROGRESS, progress);
}

run();
