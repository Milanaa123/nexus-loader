const worker = require('./ru-pack-worker');
const state = require('../lib/state-store');
const health = require('../lib/runtime-health');

let active = false;

async function main() {
  if (active) return;
  active = true;
  health.mark('starting');

  const shutdown = (signal) => {
    health.mark('stopped', { signal });
    active = false;
  };

  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));

  try {
    health.mark('running');
    await worker.start();
    health.mark('finished');
  } catch (e) {
    const p = state.getProgress();
    state.saveProgress({
      ...p,
      running: false,
      status: 'error',
      lastError: e.message,
      updatedAt: new Date().toISOString()
    });
    state.appendError(e);
    health.mark('error', { error: e.message });
  } finally {
    active = false;
  }
}

main();
