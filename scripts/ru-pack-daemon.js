const worker = require('./ru-pack-worker');
const health = require('../lib/runtime-health');

async function main() {
  try {
    health.mark('starting');
    await worker.start();
    health.mark('finished');
  } catch (error) {
    if (error.code === 'WORKER_BUSY') {
      // Never overwrite the progress owned by the active worker.
      health.mark('standby', { owner: error.details || null });
      return;
    }
    health.mark('error', { error: error.message });
    throw error;
  }
}
if (require.main === module) main().catch(error => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
module.exports = { main };
