const assert = require('assert');
const path = require('path');

function smokeTest() {
  const root = path.join(__dirname, '..');

  const status = require(path.join(root, 'lib', 'mod-status'));
  const state = require(path.join(root, 'lib', 'state-store'));
  const builder = require(path.join(root, 'lib', 'mod-archive-builder'));
  const downloader = require(path.join(root, 'scripts', 'nexus-downloader'));
  const translator = require(path.join(root, 'scripts', 'find-translation'));

  assert.strictEqual(typeof status.createPipelineResult, 'function');
  assert.strictEqual(typeof status.setStatus, 'function');
  assert.strictEqual(typeof state.getProgress, 'function');
  assert.strictEqual(typeof state.saveProgress, 'function');
  assert.strictEqual(typeof builder.mergeDirectories, 'function');
  assert.strictEqual(typeof builder.validateModFolder, 'function');
  assert.strictEqual(typeof downloader.downloadMod, 'function');
  assert.strictEqual(typeof translator.findTranslation, 'function');

  const record = status.createPipelineResult({ name: 'test-mod' });
  const updated = status.setStatus(record, status.STATUSES.BUILT);

  assert.strictEqual(updated.status, 'built');
  assert.strictEqual(Array.isArray(updated.history), true);
  assert.strictEqual(updated.history.length > 0, true);

  return true;
}

if (require.main === module) {
  smokeTest();
  console.log('pipeline smoke test passed');
}

module.exports = smokeTest;
