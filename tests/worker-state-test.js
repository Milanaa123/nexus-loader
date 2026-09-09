const assert = require('assert');
const { STATUSES } = require('../lib/mod-status');
const worker = require('../scripts/ru-pack-worker');

function run() {
  assert.strictEqual(worker.isTerminalStatus(STATUSES.BUILT), true);
  assert.strictEqual(worker.isTerminalStatus(STATUSES.NOT_FOUND), true);
  assert.strictEqual(worker.isTerminalStatus(STATUSES.MULTIPLE_MATCHES), true);
  assert.strictEqual(worker.isTerminalStatus(STATUSES.TRANSLATION_MISSING), true);
  assert.strictEqual(worker.isTerminalStatus(STATUSES.NEEDS_REVIEW), true);
  assert.strictEqual(worker.isTerminalStatus(STATUSES.RETRY_EXHAUSTED), true);
  assert.strictEqual(worker.isTerminalStatus(STATUSES.ERROR), false);
}

if (require.main === module) {
  try { run(); console.log('worker state test passed'); }
  catch (error) { console.error(error); process.exitCode = 1; }
}
module.exports = run;
