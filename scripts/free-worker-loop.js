const worker = require('./ru-pack-worker');
const state = require('../lib/state-store');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const QUEUE = path.join(ROOT, 'data', 'queue', 'ru-pack-queue.json');

let busy = false;

async function tick() {
  if (busy) return;
  try {
    const progress = state.getProgress();
    if (progress.running) return;
    if (!fs.existsSync(QUEUE)) return;

    const queue = JSON.parse(fs.readFileSync(QUEUE, 'utf8'));
    const items = queue.items || queue.mods || [];
    if (!items.length) return;

    busy = true;
    await worker.start({ queue: items });
  } catch (e) {
    console.error('Free worker loop error:', e.message);
  } finally {
    busy = false;
  }
}

console.log('Free worker loop started');
setInterval(tick, 5000);
tick();
