const fs = require('fs');
const path = require('path');
const { downloadMod, ensure } = require('./nexus-downloader');

const ROOT = path.join(__dirname, '..');
const WORK = path.join(ROOT, 'RU_PACK_WORK');
const PROGRESS = path.join(WORK, 'progress.json');
const QUEUE = path.join(WORK, 'queue.json');
const LOCK = path.join(WORK, 'worker.lock');

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return fallback; }
}

function writeJson(file, data) {
  fs.mkdirSync(WORK, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

function loadQueue() {
  const q = readJson(QUEUE, { mods: [] });
  return Array.isArray(q) ? q : (q.mods || []);
}

function loadProgress() {
  return readJson(PROGRESS, {
    total: 0,
    processed: 0,
    remaining: 0,
    downloaded: 0,
    failed: 0,
    foundTranslations: 0,
    noTranslations: 0,
    current: null,
    running: false
  });
}

function saveProgress(progress) {
  writeJson(PROGRESS, {
    ...progress,
    updatedAt: new Date().toISOString()
  });
}

async function processQueue(items) {
  if (fs.existsSync(LOCK)) return loadProgress();
  fs.mkdirSync(WORK, { recursive: true });
  fs.writeFileSync(LOCK, String(Date.now()));

  try {
    ensure();
    const progress = loadProgress();

    progress.total = items.length || progress.total;
    progress.running = true;
    progress.status = 'processing';
    saveProgress(progress);

    for (let i = progress.processed || 0; i < items.length; i++) {
      const item = items[i];
      progress.current = item.modId || item.name || item;
      progress.remaining = progress.total - progress.processed;
      saveProgress(progress);

      try {
        const result = await downloadMod(item);
        if (result) progress.downloaded = (progress.downloaded || 0) + 1;
        else progress.noTranslations = (progress.noTranslations || 0) + 1;
      } catch (e) {
        progress.failed = (progress.failed || 0) + 1;
        progress.lastError = e.message;
      }

      progress.processed = i + 1;
      progress.remaining = Math.max(0, progress.total - progress.processed);
      saveProgress(progress);
    }

    progress.running = false;
    progress.status = 'finished';
    progress.current = null;
    saveProgress(progress);
    return progress;
  } finally {
    try { fs.unlinkSync(LOCK); } catch {}
  }
}

async function start(options = {}) {
  const queue = Array.isArray(options.queue) && options.queue.length ? options.queue : loadQueue();
  return processQueue(queue);
}

module.exports = { start, processQueue, loadProgress, saveProgress };
