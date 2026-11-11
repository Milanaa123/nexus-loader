const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const AdmZip = require('adm-zip');

function manifest(id = 'Author.Example') {
  return { Name: 'Example', Author: 'Author', Version: '1.0.0', UniqueID: id, ContentPackFor: { UniqueID: 'Pathoschild.ContentPatcher' } };
}
function writeTree(root, name, entries) {
  const directory = path.join(root, name);
  for (const [relative, value] of Object.entries(entries)) {
    const file = path.join(directory, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value));
  }
  return directory;
}

async function run() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-stardew-'));
  process.env.NEXUS_LOADER_ROOT = root;
  process.env.RU_PACK_WORK = path.join(root, 'work');
  const { buildReadyMod } = require('../lib/build-pipeline');
  const { createModProcessingPipeline } = require('../lib/mod-processing-pipeline');
  const { resolveGame } = require('../lib/game-registry');
  const paths = require('../config/paths');
  try {
    assert.strictEqual(resolveGame('stardewvalley').adapter.id, 'stardewvalley');
    assert.strictEqual(resolveGame('fallout4').adapter.id, 'generic');
    const content = '// comments and trailing commas must be accepted\n{"Format":"2.0.0","Changes":[{"Action":"EditData","Target":"Data/Objects","Entries":{"Text":"first line\nsecond line"}},],}';
    const original = writeTree(root, 'original', {
      '[CP] Original/manifest.json': manifest(),
      '[CP] Original/content.json': content,
      '[CP] Original/i18n/default.json': { hello: 'Hello {{name}}', 'gmcm.title': 'Settings' }
    });
    const translation = writeTree(root, 'translation', {
      'Renamed Russian Mod/manifest.json': manifest(),
      'Renamed Russian Mod/i18n/ru.json': { hello: 'Привет {{name}}', 'gmcm.title': 'Настройки' }
    });
    const build = inputs => buildReadyMod({ game: 'stardewvalley', name: 'Example', originalPath: original, translationPath: translation, outputDir: paths.outputDir, ...inputs });
    const built = await build();
    assert.strictEqual(built.validation.needsReview, false);
    const zip = new AdmZip(built.output);
    assert.strictEqual(zip.getEntries().filter(entry => entry.entryName.endsWith('manifest.json')).length, 1);
    assert.ok(zip.getEntry('[CP] Original/i18n/ru.json'));
    assert.ok(!zip.getEntries().some(entry => entry.entryName.startsWith('Renamed')));
    assert.strictEqual(zip.readAsText('[CP] Original/content.json'), content, 'validator must not rewrite mod source JSON');
    assert.strictEqual(built.validation.merged.adapter.localization[0].translatedKeys, 2);

    const incomplete = writeTree(root, 'incomplete', { 'i18n/ru.json': { hello: 'Привет {{name}}' } });
    const partial = await build({ translationPath: incomplete });
    assert.strictEqual(partial.validation.needsReview, true);
    assert.deepStrictEqual(partial.validation.merged.adapter.localization[0].missingKeys, ['gmcm.title']);

    const provider = {
      id: 'test', capabilities: {},
      async download({ role }) { return { path: role === 'original' ? original : incomplete }; }
    };
    const processMod = createModProcessingPipeline({ provider, translationFinder: async () => ({ translationId: '99' }), builder: buildReadyMod, outputDir: paths.outputDir });
    const reviewed = await processMod({ name: 'Example', game: 'stardewvalley', nexusModId: '10' });
    assert.strictEqual(reviewed.result.status, 'needs_review');
    assert.strictEqual(reviewed.result.error, 'incomplete_russian_i18n_coverage');

    const badJson = writeTree(root, 'bad-json', { 'i18n/ru.json': '{"broken":' });
    await assert.rejects(() => build({ translationPath: badJson }), error => error.code === 'NEEDS_REVIEW' && /JSON/.test(error.message));
    const noManifest = writeTree(root, 'no-manifest', { 'a.txt': 'not a SMAPI mod' });
    await assert.rejects(() => build({ originalPath: noManifest }), error => error.code === 'NEEDS_REVIEW');
    const noContent = writeTree(root, 'no-content', { 'Example/manifest.json': manifest() });
    await assert.rejects(() => build({ originalPath: noContent }), /content.json/);
    const missingDll = writeTree(root, 'no-dll', { 'Example/manifest.json': { Name: 'Code', Version: '1.0.0', UniqueID: 'Author.Code', EntryDll: 'Missing.dll' } });
    await assert.rejects(() => build({ originalPath: missingDll }), /EntryDll/);
    const badReference = writeTree(root, 'bad-reference', {
      'Example/manifest.json': manifest(),
      'Example/content.json': { Format: '2.0.0', Changes: [{ Action: 'Include', FromFile: 'missing.json' }] }
    });
    await assert.rejects(() => build({ originalPath: badReference }), /FromFile is missing/);
    const mismatched = writeTree(root, 'mismatched', {
      'Translated/manifest.json': { ...manifest(), Version: '0.9.0' },
      'Translated/content.json': { Format: '2.0.0', Changes: [] }
    });
    await assert.rejects(() => build({ translationPath: mismatched }), /version differs/);

    const multiple = writeTree(root, 'multi', {
      'A/manifest.json': manifest('Author.A'), 'A/content.json': { Format: '2.0.0', Changes: [] },
      'B/manifest.json': manifest('Author.B'), 'B/content.json': { Format: '2.0.0', Changes: [] }
    });
    await assert.rejects(() => build({ originalPath: multiple, translationPath: incomplete }), /ambiguous/);
    const duplicate = writeTree(root, 'duplicate', {
      'A/manifest.json': manifest(), 'A/content.json': { Format: '2.0.0', Changes: [] },
      'B/manifest.json': manifest(), 'B/content.json': { Format: '2.0.0', Changes: [] }
    });
    await assert.rejects(() => build({ originalPath: duplicate }), /Duplicate manifest/);

    const rootMod = writeTree(root, 'root-mod', {
      'manifest.json': manifest(), 'content.json': { Format: '2.0.0', Changes: [] },
      'i18n/default.json': { hello: 'Hello' }
    });
    const rootBuilt = await build({ originalPath: rootMod, translationPath: incomplete });
    assert.ok(new AdmZip(rootBuilt.output).getEntry('Author.Example/manifest.json'), 'root manifests must be wrapped in a Mods subfolder');
    assert.ok(new AdmZip(rootBuilt.output).getEntry('Author.Example/i18n/ru.json'));
    assert.ok(fs.existsSync(original));
    assert.deepStrictEqual(fs.readdirSync(paths.tempDir), [], 'all extraction folders must be cleaned');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}
if (require.main === module) run().then(() => console.log('Stardew build test passed (SMAPI, CP, JSONC, UID overlays, coverage, ambiguity)')).catch(error => { console.error(error); process.exitCode = 1; });
module.exports = run;
