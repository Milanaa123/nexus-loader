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
  queueSize: 0
};

function loadProgress() {
  if (!fs.existsSync(PROGRESS)) return { ...DEFAULT };
  return { ...DEFAULT, ...JSON.parse(fs.readFileSync(PROGRESS, 'utf8')) };
}

function saveProgress(data) {
  fs.mkdirSync(WORK, { recursive: true });
  fs.writeFileSync(PROGRESS, JSON.stringify(data, null, 2));
}

async function start(options = {}) {
  const progress = loadProgress();
  progress.running = true;
  progress.startedAt = new Date().toISOString();
  progress.queueSize = Array.isArray(options.modIds) ? options.modIds.length : 0;
  saveProgress(progress);
  return progress;
}

async function runBatch(ids = []) {
  const progress = loadProgress();
  progress.lastRun = new Date().toISOString();
  progress.queueSize = ids.length;
  saveProgress(progress);
  return progress;
}

module.exports = { start, runBatch, loadProgress, saveProgress };
