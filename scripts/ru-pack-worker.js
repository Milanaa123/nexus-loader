const fs = require('fs');
const path = require('path');

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
  current: null
};

function loadProgress() {
  if (!fs.existsSync(PROGRESS)) return { ...DEFAULT };
  return { ...DEFAULT, ...JSON.parse(fs.readFileSync(PROGRESS, 'utf8')) };
}

function saveProgress(data) {
  fs.mkdirSync(WORK, { recursive: true });
  fs.writeFileSync(PROGRESS, JSON.stringify(data, null, 2));
}

async function processQueue(modIds = []) {
  const progress = loadProgress();
  progress.running = true;
  progress.queueSize = modIds.length;

  for (const modId of modIds) {
    progress.current = modId;
    progress.lastRun = new Date().toISOString();
    saveProgress(progress);
  }

  progress.running = false;
  progress.current = null;
  saveProgress(progress);
  return progress;
}

async function start(options = {}) {
  const ids = Array.isArray(options.modIds) ? options.modIds : [];
  return processQueue(ids);
}

async function runBatch(ids = []) {
  return processQueue(ids);
}

module.exports = { start, runBatch, loadProgress, saveProgress, processQueue };
