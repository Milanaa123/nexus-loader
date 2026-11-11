const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { registerGame, getGame, resolveGame } = require('../lib/game-registry');
const { buildReadyMod } = require('../lib/build-pipeline');

async function run() {
  assert.strictEqual(getGame('unknown-domain').id, 'generic');
  assert.strictEqual(resolveGame('unknown-domain').fallback, true);
  let validations = 0;
  registerGame({
    id: 'testgame',
    name: 'Test Game',
    mergeStrategy: 'overlay',
    validateSource({ files }) { validations += 1; return { valid: files.length > 0 }; },
    outputName({ name }) { return `custom-${name.replace(/\s+/g, '_')}.zip`; }
  });
  assert.strictEqual(resolveGame('testgame').fallback, false);

  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-loader-game-test-'));
  try {
    const original = path.join(root, 'original');
    const translation = path.join(root, 'translation');
    const output = path.join(root, 'output');
    fs.mkdirSync(original);
    fs.mkdirSync(translation);
    fs.writeFileSync(path.join(original, 'a.txt'), 'a');
    fs.writeFileSync(path.join(translation, 'b.txt'), 'b');
    const built = await buildReadyMod({ game: 'testgame', name: 'My Mod', originalPath: original, translationPath: translation, outputDir: output });
    assert.strictEqual(built.gameAdapter, 'testgame');
    assert.strictEqual(built.gameAdapterFallback, false);
    assert.strictEqual(path.basename(built.output), 'custom-My_Mod.zip');
    assert.strictEqual(validations, 3, 'adapter must validate the merged result too');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

if (require.main === module) run().then(() => console.log('game adapter test passed')).catch(error => { console.error(error); process.exitCode = 1; });
module.exports = run;
