const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const WORK = path.join(ROOT, 'RU_PACK_WORK');
const PROGRESS = path.join(WORK, 'progress.json');

function loadProgress() {
  if (!fs.existsSync(PROGRESS)) {
    return {
      total: 535,
      ready: 1,
      remaining: 534,
      updated: 0,
      fixed: 0,
      createdTranslations: 0,
      withoutTranslation: 534
    };
  }
  return JSON.parse(fs.readFileSync(PROGRESS, 'utf8'));
}

function saveProgress(data) {
  fs.mkdirSync(WORK, { recursive: true });
  fs.writeFileSync(PROGRESS, JSON.stringify(data, null, 2));
}

async function runBatch(ids = []) {
  const progress = loadProgress();
  progress.lastRun = new Date().toISOString();
  progress.queuePrepared = ids.length;
  saveProgress(progress);
  return progress;
}

module.exports = { runBatch, loadProgress, saveProgress };
