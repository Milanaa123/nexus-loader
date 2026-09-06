const worker = require('./ru-pack-worker');
const state = require('../lib/state-store');

let active = false;

async function main() {
  if (active) return;
  active = true;
  try {
    await worker.start();
  } catch (e) {
    const p = state.getProgress();
    state.saveProgress({
      ...p,
      running: false,
      status: 'error',
      lastError: e.message,
      updatedAt: new Date().toISOString()
    });
  } finally {
    active = false;
  }
}

main();
