const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

async function run() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-loader-server-test-'));
  process.env.NEXUS_LOADER_ROOT = root;
  process.env.RU_PACK_WORK = path.join(root, 'work');
  process.env.RU_PACK_QUEUE = path.join(root, 'data', 'queue');
  process.env.RU_PACK_QUEUE_FILE = path.join(root, 'data', 'queue', 'queue.json');
  const { createServer } = require('../render-server');
  const server = createServer();
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const address = server.address();
  const base = `http://127.0.0.1:${address.port}`;
  try {
    const healthResponse = await fetch(`${base}/health`);
    assert.strictEqual(healthResponse.status, 200);
    const health = await healthResponse.json();
    assert.strictEqual(health.ok, true);
    assert.ok(health.providers.includes('nexus'));

    const queuedResponse = await fetch(`${base}/api/startFromInput`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: 'name,author,game\nExample Mod,Example Author,fallout4' })
    });
    assert.strictEqual(queuedResponse.status, 202);
    const queued = await queuedResponse.json();
    assert.strictEqual(queued.added, 1);

    const statusResponse = await fetch(`${base}/api/status`);
    const status = await statusResponse.json();
    assert.strictEqual(status.ok, true);
    assert.strictEqual(status.queue.total, 1);

    const badJson = await fetch(`${base}/api/status`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{' });
    assert.strictEqual(badJson.status, 400);
  } finally {
    await new Promise(resolve => server.close(resolve));
    fs.rmSync(root, { recursive: true, force: true });
  }
}

if (require.main === module) run().then(() => console.log('server api test passed')).catch(error => { console.error(error); process.exitCode = 1; });
module.exports = run;
