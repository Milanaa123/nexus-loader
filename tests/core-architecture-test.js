const assert = require('assert');
const { parseInput, parseNexusUrl } = require('../lib/input-parser');
const { createProvider } = require('../providers/base-provider');
const { registerProvider, getProvider } = require('../providers/provider-registry');
const { runPipeline } = require('../lib/pipeline-runner');
const { createValidatorStep } = require('../lib/pipeline-steps');
const { createModProcessingPipeline, processingKey } = require('../lib/mod-processing-pipeline');
const { selectMatch } = require('../lib/mod-matcher');
const { STATUSES } = require('../lib/mod-status');
const { findTranslation } = require('../scripts/find-translation');

async function run() {
  const url = parseNexusUrl('https://www.nexusmods.com/skyrimspecialedition/mods/12345');
  assert.strictEqual(url.game, 'skyrimspecialedition');
  assert.strictEqual(url.nexusModId, '12345');
  const csv = parseInput('name,author,game\nExample Mod,Example Author,fallout4\nExample Mod,Example Author,fallout4');
  assert.strictEqual(csv.length, 1);
  assert.strictEqual(csv[0].game, 'fallout4');
  const urls = parseInput('https://www.nexusmods.com/cyberpunk2077/mods/42');
  assert.strictEqual(urls[0].game, 'cyberpunk2077');

  const ambiguous = selectMatch({ name: 'Example', author: '' }, [{ modId: '1', name: 'Example A', score: 70 }, { modId: '2', name: 'Example B', score: 68 }]);
  assert.strictEqual(ambiguous.status, 'multiple_matches');
  const exact = selectMatch({ name: 'Example', author: 'Author' }, [{ modId: '1', name: 'Example', author: 'Author', score: 180 }]);
  assert.strictEqual(exact.status, 'found');

  const provider = createProvider({ id: 'test', async search() { return [{ modId: '1' }]; } });
  registerProvider(provider);
  assert.strictEqual(getProvider('test').capabilities.search, true);
  assert.strictEqual(getProvider('test').capabilities.download, false);

  const invalid = { steps: [], fail(error) { this.status = 'error'; this.errors = [error.message]; } };
  await assert.rejects(() => runPipeline(invalid, [createValidatorStep(async () => ({ valid: false, error: 'bad mod' }))]), /bad mod/);
  assert.strictEqual(invalid.status, 'error');
  await assert.rejects(() => findTranslation({ modName: 'Anything' }), /game is required/);

  const downloads = [];
  const fakeProvider = {
    id: 'fake',
    capabilities: { getMod: true, search: true },
    async getMod() { return { name: 'Resolved By Id', author: 'Author' }; },
    async search() { return [{ modId: '10', name: 'Example', author: 'Author', score: 180 }]; },
    async download(options) { downloads.push(options); return { path: `/persistent/${options.game}-${options.modId}.zip` }; }
  };
  const processMod = createModProcessingPipeline({
    provider: fakeProvider,
    translationFinder: async input => ({ translationId: '99', game: input.game }),
    builder: async input => ({ output: `/persistent/${input.name}.zip`, sha256: 'abc', validation: { ok: true } }),
    outputDir: '/persistent/output'
  });
  const context = await processMod({ game: 'skyrimspecialedition', name: 'Example', author: 'Author' });
  assert.strictEqual(context.result.status, STATUSES.BUILT);
  assert.strictEqual(context.result.nexusModId, '10');
  assert.strictEqual(downloads[0].modId, '10');
  assert.strictEqual(downloads[0].game, 'skyrimspecialedition');
  assert.strictEqual(processingKey({ game: 'fallout4', nexusModId: '10' }, 'nexus'), 'nexus:fallout4:id:10');

  const byId = await processMod({ game: 'fallout4', nexusModId: '12' });
  assert.strictEqual(byId.result.name, 'Resolved By Id');
  const noGame = await processMod({ nexusModId: '10', name: 'Example' });
  assert.strictEqual(noGame.result.status, STATUSES.NEEDS_REVIEW);

  const noTranslation = createModProcessingPipeline({ provider: fakeProvider, translationFinder: async () => null, builder: async () => { throw new Error('must not build'); }, outputDir: '/persistent/output' });
  const missing = await noTranslation({ game: 'fallout4', nexusModId: '11', name: 'No Translation' });
  assert.strictEqual(missing.result.status, STATUSES.TRANSLATION_MISSING);
  assert.strictEqual(missing.halted, true);
}

if (require.main === module) run().then(() => console.log('core architecture test passed')).catch(error => { console.error(error); process.exitCode = 1; });
module.exports = run;
