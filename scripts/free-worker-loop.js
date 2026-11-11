const worker = require('./ru-pack-worker');
const queue = require('../lib/job-queue');
const health = require('../lib/runtime-health');

const INTERVAL_MS = Math.max(1000, Number(process.env.NEXUS_LOADER_WORKER_INTERVAL_MS || 5000));
let busy = false;
let timer = null;
let stopping = false;
let verifyOnNextPass = true;

async function tick() {
  if (busy || stopping) return;
  const items = queue.load();
  if (!items.length) {
    health.mark('idle', { queued: 0 });
    return;
  }
  const runnable = items.some(item => !worker.isTerminalStatus(item.status) && (!item.nextAttemptAt || Date.parse(item.nextAttemptAt) <= Date.now()));
  if (!verifyOnNextPass && !runnable) {
    health.mark(items.some(item => item.nextAttemptAt) ? 'waiting_retry' : 'idle', { queued: items.length });
    return;
  }
  busy = true;
  health.mark('working', { queued: items.length });
  try {
    await worker.start({ queue: items });
    verifyOnNextPass = false;
    health.mark('idle', { queued: items.length });
  } catch (error) {
    if (error?.code === 'WORKER_BUSY') {
      health.mark('standby', { queued: items.length, owner: error.details || null });
      return;
    }
    health.mark('error', { error: error.message || String(error) });
    console.error('Worker loop error:', error.stack || error.message || error);
  } finally {
    busy = false;
  }
}

function startLoop() {
  if (timer) return timer;
  stopping = false;
  verifyOnNextPass = true;
  health.mark('starting');
  timer = setInterval(() => { tick().catch(error => console.error('Worker tick fatal:', error)); }, INTERVAL_MS);
  tick().catch(error => console.error('Worker initial tick fatal:', error));
  return timer;
}

function stopLoop() {
  stopping = true;
  if (timer) clearInterval(timer);
  timer = null;
  health.mark('stopped');
}

if (require.main === module) {
  console.log(`Nexus Loader worker loop started, interval=${INTERVAL_MS}ms`);
  startLoop();
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { stopLoop(); process.exitCode = 0; });
}

module.exports = { tick, startLoop, stopLoop };
