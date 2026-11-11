const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

async function run() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-loader-download-test-'));
  process.env.NEXUS_LOADER_ROOT = root;
  process.env.RU_PACK_WORK = path.join(root, 'work');
  process.env.RU_PACK_OUTPUT = path.join(root, 'work', 'output');
  const output = process.env.RU_PACK_OUTPUT;
  fs.mkdirSync(output, { recursive: true });
  fs.writeFileSync(path.join(output, 'ready.zip'), Buffer.from('PK-test'));
  const { createServer } = require('../render-server');
  const server = createServer();
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const ok = await fetch(`${base}/api/downloadReady?name=ready.zip`);
    assert.strictEqual(ok.status, 200);
    assert.strictEqual(ok.headers.get('content-type'), 'application/zip');
    assert.strictEqual((await ok.arrayBuffer()).byteLength > 0, true);
    const traversal = await fetch(`${base}/api/downloadReady?name=../ready.zip`);
    assert.strictEqual(traversal.status, 400);
    const wrongType = await fetch(`${base}/api/downloadReady?name=ready.txt`);
    assert.strictEqual(wrongType.status, 400);
    const legacyDir = require('../config/paths').legacyOutputDir;
    fs.mkdirSync(legacyDir, { recursive: true });
    fs.writeFileSync(path.join(legacyDir, 'legacy.zip'), 'PK-legacy');
    assert.strictEqual((await fetch(`${base}/api/downloadReady?name=legacy.zip`)).status, 200);
    fs.symlinkSync(path.join(root, 'private.zip'), path.join(output, 'link.zip'));
    fs.writeFileSync(path.join(root, 'private.zip'), 'private');
    assert.strictEqual((await fetch(`${base}/api/downloadReady?name=link.zip`)).status, 404);
  } finally {
    await new Promise(resolve => server.close(resolve));
    fs.rmSync(root, { recursive: true, force: true });
    delete process.env.NEXUS_LOADER_ROOT;
    delete process.env.RU_PACK_WORK;
    delete process.env.RU_PACK_OUTPUT;
  }
}

if (require.main === module) run().then(() => console.log('download ready test passed')).catch(error => { console.error(error); process.exitCode = 1; });
module.exports = run;
