const fs = require('fs');
const path = require('path');
const { downloadMod, ensure } = require('./nexus-downloader');

const ROOT = path.join(__dirname, '..');
const WORK = path.join(ROOT, 'RU_PACK_WORK');
const PROGRESS = path.join(WORK, 'progress.json');
const QUEUE = path.join(WORK, 'queue.json');

function loadProgress() {
  try { return JSON.parse(fs.readFileSync(PROGRESS, 'utf8')); }
  catch { return { total: 535, downloaded: 0, failed: 0 }; }
}

function saveProgress(data) {
  fs.mkdirSync(WORK, { recursive: true });
  fs.writeFileSync(PROGRESS, JSON.stringify(data, null, 2), 'utf8');
}

function loadQueue() {
  try {
    const q = JSON.parse(fs.readFileSync(QUEUE, 'utf8'));
    return Array.isArray(q) ? q : (q.mods || []);
  } catch { return []; }
}

async function processQueue(items = []) {
  ensure();
  const progress = loadProgress();
  progress.running = true;
  progress.queueSize = items.length;
  saveProgress(progress);

  for (const item of items) {
    try {
      progress.current = item.modId || item.name;
      const link = await downloadMod(item);
      if (link) progress.downloaded = (progress.downloaded || 0) + 1;
    } catch (e) {
      progress.failed = (progress.failed || 0) + 1;
      progress.lastError = e.message;
    }
    saveProgress(progress);
  }

  progress.running = false;
  progress.current = null;
  saveProgress(progress);
  return progress;
}

async function start(options = {}) {
  const queue = Array.isArray(options.queue) && options.queue.length ? options.queue : loadQueue();
  return processQueue(queue);
}

module.exports = { start, processQueue, loadProgress, saveProgress };
