const assert = require('assert');
const { parseInput, parseNexusUrl } = require('../lib/input-parser');
const { createProvider } = require('../providers/base-provider');
const { registerProvider, getProvider } = require('../providers/provider-registry');
const { runPipeline } = require('../lib/pipeline-runner');
const { createValidatorStep } = require('../lib/pipeline-steps');

async function run() {
  const url = parseNexusUrl('https://www.nexusmods.com/skyrimspecialedition/mods/12345');
  assert.strictEqual(url.game, 'skyrimspecialedition');
  assert.strictEqual(url.nexusModId, '12345');
  const csv = parseInput('name,author,game\nExample Mod,Example Author,fallout4\nExample Mod,Example Author,fallout4');
  assert.strictEqual(csv.length, 1);
  assert.strictEqual(csv[0].game, 'fallout4');
  const urls = parseInput('https://www.nexusmods.com/cyberpunk2077/mods/42');
  assert.strictEqual(urls[0].game, 'cyberpunk2077');
  assert.strictEqual(urls[0].nexusModId, '42');
  const provider = createProvider({ id: 'test', async search() { return [{ modId: '1' }]; } });
  registerProvider(provider);
  assert.strictEqual(getProvider('test').capabilities.search, true);
  assert.strictEqual(getProvider('test').capabilities.download, false);
  const context = { steps: [], fail(error) { this.status = 'error'; this.errors = [error.message]; } };
  await assert.rejects(() => runPipeline(context, [createValidatorStep(async () => ({ valid: false, error: 'bad mod' }))]), /bad mod/);
  assert.strictEqual(context.status, 'error');
  assert.strictEqual(context.steps[0].status, 'error');
}

if (require.main === module) {
  run().then(() => console.log('core architecture test passed')).catch(error => { console.error(error); process.exitCode = 1; });
}
module.exports = run;
