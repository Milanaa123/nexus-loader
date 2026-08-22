const fs = require('fs');
const path = require('path');
const { downloadMod, ensure } = require('./nexus-downloader');

const ROOT = path.join(__dirname, '..');
const WORK = path.join(ROOT, 'RU_PACK_WORK');
const PROGRESS = path.join(WORK, 'progress.json');

const DEFAULT = {
  total: 535,
  ready: 1,
  remaining: 534,
  updated: 0,
  fixed: 0,
  createdTranslations: 0,
  withoutTranslation: 534,
  processed: 1,
  running: false,
  queueSize: 0,
  current: null,
  downloaded: 0,
  failed: 0
};

function loadProgress() {
  if (!fs.existsSync(PROGRESS)) return { ...DEFAULT };
  return { ...DEFAULT, ...JSON.parse(fs.readFileSync(PROGRESS, 'utf8')) };
}

function saveProgress(data) {
  fs.mkdirSync(WORK, { recursive: true });
  fs.writeFileSync(PROGRESS, JSON.stringify(data, null, 2));
}

async function processQueue(items = []) {
  ensure();
  const progress = loadProgress();
  progress.running = true;
  progress.queueSize = items.length;
  saveProgress(progress);

  for (const item of items) {
    try {
      progress.current = item.modId;
      const link = await downloadMod(item);
      progress.lastDownload = link ? 'ready' : 'missing';
      if (link) progress.downloaded++;
    } catch (e) {
      progress.failed++;
      progress.lastError = e.message;
    }
    progress.lastRun = new Date().toISOString();
    saveProgress(progress);
  }

  progress.running = false;
  progress.current = null;
  saveProgress(progress);
  return progress;
}

async function start(options = {}) {
  return processQueue(Array.isArray(options.queue) ? options.queue : []);
}

module.exports = { start, processQueue, loadProgress, saveProgress };
