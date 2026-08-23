const fs = require('fs');
const path = require('path');
const { downloadMod, ensure } = require('./nexus-downloader');
const { run: importQueue } = require('./import_mod_queue');

const ROOT = path.join(__dirname, '..');
const WORK = path.join(ROOT, 'RU_PACK_WORK');
const PROGRESS = path.join(WORK, 'progress.json');
const QUEUE = path.join(ROOT, 'data', 'queue', 'ru-pack-queue.json');
const LOCK = path.join(WORK, 'worker.lock');

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

function loadQueue() {
  if (!fs.existsSync(QUEUE)) {
    importQueue();
  }
  const q = readJson(QUEUE, { items: [] });
  if (Array.isArray(q)) return q;
  if (Array.isArray(q.items)) return q.items;
  if (Array.isArray(q.mods)) return q.mods;
  return [];
}

function loadProgress() {
  return readJson(PROGRESS, { total:0, processed:0, remaining:0, downloaded:0, failed:0, current:null, running:false });
}

function saveProgress(progress) {
  writeJson(PROGRESS, { ...progress, updatedAt: new Date().toISOString() });
}

async function processQueue(items) {
  if (!items.length) {
    const p = loadProgress();
    p.running = false;
    p.status = 'empty_queue';
    saveProgress(p);
    return p;
  }
  if (fs.existsSync(LOCK)) return loadProgress();
  fs.mkdirSync(WORK, {recursive:true});
  fs.writeFileSync(LOCK, Date.now().toString());
  try {
    ensure();
    const progress = loadProgress();
    progress.total = items.length;
    progress.running = true;
    progress.status = 'processing';
    saveProgress(progress);
    for (let i = progress.processed || 0; i < items.length; i++) {
      progress.current = items[i].modId || items[i].name || String(i);
      saveProgress(progress);
      try {
        const result = await downloadMod(items[i]);
        if (result) progress.downloaded = (progress.downloaded || 0) + 1;
        else progress.noTranslations = (progress.noTranslations || 0) + 1;
      } catch(e) {
        progress.failed = (progress.failed || 0) + 1;
        progress.lastError = e.message;
      }
      progress.processed = i + 1;
      progress.remaining = progress.total - progress.processed;
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

async function start(options={}) {
  return processQueue(options.queue && options.queue.length ? options.queue : loadQueue());
}

module.exports = { start, processQueue, loadProgress, saveProgress };
