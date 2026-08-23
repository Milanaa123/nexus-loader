const worker = require('./ru-pack-worker');

let active = false;

async function main() {
  if (active) return;
  active = true;
  try {
    await worker.start();
  } catch (e) {
    const p = worker.loadProgress();
    worker.saveProgress({ ...p, running:false, status:'error', lastError:e.message });
  } finally {
    active = false;
  }
}

main();
