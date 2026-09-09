const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

function fresh(modulePath) {
  delete require.cache[require.resolve(modulePath)];
  return require(modulePath);
}

function run() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-loader-queue-test-'));
  process.env.NEXUS_LOADER_ROOT = root;
  process.env.RU_PACK_QUEUE = path.join(root, 'data', 'queue');
  process.env.RU_PACK_QUEUE_FILE = path.join(root, 'data', 'queue', 'queue.json');
  try {
    fresh('../config/paths');
    const queue = fresh('../lib/job-queue');
    const added = queue.addJobs([{ name: 'Example', author: 'Author', game: 'fallout4' }]);
    assert.strictEqual(added.added, 1);
    const key = added.items[0].key;
    const updated = queue.updateJob(key, { status: 'built', attempts: 1 });
    assert.strictEqual(updated.status, 'built');
    assert.strictEqual(queue.stats().statuses.built, 1);
    const duplicate = queue.addJobs([{ name: 'Example', author: 'Author', game: 'fallout4' }]);
    assert.strictEqual(duplicate.added, 0);
    assert.strictEqual(duplicate.updated, 1);
  } finally {
    delete process.env.NEXUS_LOADER_ROOT;
    delete process.env.RU_PACK_QUEUE;
    delete process.env.RU_PACK_QUEUE_FILE;
    fs.rmSync(root, { recursive: true, force: true });
  }
}

if (require.main === module) {
  try { run(); console.log('job queue test passed'); }
  catch (error) { console.error(error); process.exitCode = 1; }
}
module.exports = run;
