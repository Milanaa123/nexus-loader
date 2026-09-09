const assert = require('assert');
const path = require('path');

async function smokeTest() {
  const root = path.join(__dirname, '..');
  const status = require(path.join(root, 'lib', 'mod-status'));
  const state = require(path.join(root, 'lib', 'state-store'));
  const builder = require(path.join(root, 'lib', 'mod-archive-builder'));
  const downloader = require(path.join(root, 'scripts', 'nexus-downloader'));
  const translator = require(path.join(root, 'scripts', 'find-translation'));
  const { runPipeline, createStep } = require(path.join(root, 'lib', 'pipeline-runner'));
  assert.strictEqual(typeof status.createPipelineResult, 'function');
  assert.strictEqual(typeof state.getProgress, 'function');
  assert.strictEqual(typeof builder.mergeDirectories, 'function');
  assert.strictEqual(typeof downloader.downloadMod, 'function');
  assert.strictEqual(typeof translator.findTranslation, 'function');
  const record = status.createPipelineResult({ name: 'test-mod' });
  const updated = status.setStatus(record, status.STATUSES.BUILT);
  assert.strictEqual(updated.status, 'built');
  assert.ok(updated.history.length > 0);
  const context = { steps: [] };
  await runPipeline(context, [createStep('one', async value => { value.ok = true; return value; })]);
  assert.strictEqual(context.ok, true);
  assert.strictEqual(context.steps[0].status, 'completed');
  return true;
}

if (require.main === module) {
  smokeTest().then(() => console.log('pipeline smoke test passed')).catch(error => { console.error(error); process.exitCode = 1; });
}
module.exports = smokeTest;
