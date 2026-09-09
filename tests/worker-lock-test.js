const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

async function run() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-loader-lock-test-'));
  const file = path.join(root, 'worker.lock');
  process.env.NEXUS_LOADER_WORKER_LOCK_FILE = file;
  const { acquireWorkerLock } = require('../lib/worker-lock');
  try {
    const first = acquireWorkerLock({ file, ttlMs: 60_000 });
    assert.strictEqual(fs.existsSync(file), true);
    assert.throws(() => acquireWorkerLock({ file, ttlMs: 60_000 }), error => error?.code === 'WORKER_BUSY');
    assert.strictEqual(first.touch(), true);
    assert.strictEqual(first.release(), true);
    assert.strictEqual(fs.existsSync(file), false);

    fs.writeFileSync(file, JSON.stringify({ token: 'dead', pid: 1, acquiredAt: '2000-01-01T00:00:00.000Z', heartbeatAt: '2000-01-01T00:00:00.000Z' }));
    const recovered = acquireWorkerLock({ file, ttlMs: 1000 });
    assert.notStrictEqual(recovered.token, 'dead');
    assert.strictEqual(recovered.release(), true);
  } finally {
    delete process.env.NEXUS_LOADER_WORKER_LOCK_FILE;
    fs.rmSync(root, { recursive: true, force: true });
  }
}

if (require.main === module) run().then(() => console.log('worker lock test passed')).catch(error => { console.error(error); process.exitCode = 1; });
module.exports = run;
