const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

async function run() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-resolution-'));
  process.env.NEXUS_LOADER_ROOT = root;
  process.env.RU_PACK_WORK = path.join(root, 'work');
  const client = require('../providers/nexus-client');
  const { selectMatch, verifyModIdentity } = require('../lib/mod-matcher');
  const { createTranslationFinder, linksOriginal, ruMarker, variants } = require('../scripts/find-translation');
  const { createModProcessingPipeline } = require('../lib/mod-processing-pipeline');
  const { downloadMod, chooseFile } = require('../scripts/nexus-downloader');
  const original = { getMod: client.getMod, searchMods: client.searchMods, getFiles: client.getFiles, getDownloadLinks: client.getDownloadLinks, getCapabilities: client.getCapabilities, request: client.request };
  const game = 'stardewvalley';
  const input = { game, modName: 'Good Mod', author: 'Original', modId: '1' };
  const candidate = overrides => ({ modId: '2', game, name: 'Good Mod Russian', author: 'Translator', status: 'published', ...overrides });
  const metadata = overrides => ({ mod_id: 2, game, name: 'Good Mod Russian', author: 'Translator', status: 'published', description: 'Original: [url=https://www.nexusmods.com/stardewvalley/mods/1]Good Mod[/url]', ...overrides });
  const finder = (rows, extra = {}) => createTranslationFinder({ searchMods: async () => rows, getMod: async () => metadata(), ...extra });
  let scenarios = 0;
  const check = async (name, fn) => { await fn(); scenarios += 1; console.log('  Nexus resolution: ' + name); };
  try {
    await check('wrong authors, uploader aliases and high fuzzy scores cannot authorize a mod', async () => {
      const wanted = { game, name: 'Good Mod', author: 'Original' };
      assert.strictEqual(selectMatch(wanted, [candidate({ modId: '1', name: 'Good Mod', author: 'Other', score: 99999 })]).status, 'not_found');
      assert.strictEqual(selectMatch(wanted, [candidate({ modId: '1', name: 'Good Mod', author: '', uploader: 'Original', score: 99999 })]).status, 'not_found');
      assert.strictEqual(selectMatch(wanted, [candidate({ modId: '1', name: 'Good Mod Expanded', author: 'Original', score: 99999 })]).status, 'multiple_matches');
      assert.strictEqual(selectMatch(wanted, [candidate({ modId: '1', name: ' Good  Mod ', author: 'original' })]).status, 'found');
      assert.strictEqual(selectMatch(wanted, [candidate({ modId: '1', name: 'Good Mod', author: 'Original', game: 'fallout4' })]).status, 'not_found');
    });
    await check('duplicates, conflicting identities and incomplete pages are distinguished', async () => {
      const row = candidate({ name: 'Good Mod', author: 'Original' });
      assert.strictEqual(selectMatch({ game, name: 'Good Mod', author: 'Original' }, [row, row]).status, 'found');
      assert.strictEqual(selectMatch({ name: 'Good Mod' }, [row, { ...row, author: 'Other' }]).reason, 'conflicting_metadata');
      assert.strictEqual(selectMatch({ name: 'Good Mod' }, Object.assign([row], { search: { complete: false } })).reason, 'search_incomplete');
      assert.strictEqual(selectMatch({ name: 'Good Mod' }, Object.assign([], { search: { complete: false } })).reason, 'search_incomplete');
    });
    await check('an explicit mod ID does not override contradictory metadata', async () => {
      const wanted = { game, nexusModId: '1', name: 'Good Mod', author: 'Original' };
      assert.strictEqual(verifyModIdentity(wanted, { mod_id: 1, name: 'Wrong', author: 'Other', game }).reason, 'identity_conflict');
      assert.strictEqual(verifyModIdentity(wanted, { mod_id: 1, name: 'Good Mod', author: 'Original', status: 'hidden' }).reason, 'mod_unavailable');
      assert.strictEqual(verifyModIdentity(wanted, null).status, 'needs_review');
    });
    await check('a unique translation requires an exact core name and original-page evidence', async () => {
      const found = await finder([candidate()])(input);
      assert.strictEqual(found.status, 'translation_found');
      assert.strictEqual(found.translationId, '2');
      assert.deepStrictEqual(found.evidence, { exactCoreName: true, originalLink: true, source: 'nexus_description', compatibilityVerified: false });
      assert.strictEqual((await finder([candidate()], { getMod: async () => metadata({ description: 'No original link' }) })(input)).reason, 'translation_link_unverified');
      assert.strictEqual((await finder([candidate({ name: 'Good Mod Extended Russian' })])(input)).reason, 'translation_name_requires_confirmation');
      assert.strictEqual((await finder([candidate()], { getMod: async () => metadata({ author: 'Changed' }) })(input)).reason, 'translation_metadata_changed');
    });
    await check('two plausible translations never silently choose the first one', async () => {
      const result = await finder([candidate(), candidate({ modId: '3', author: 'Original' })])(input);
      assert.strictEqual(result.status, 'needs_review');
      assert.strictEqual(result.reason, 'translation_ambiguous');
      assert.strictEqual(result.candidates.length, 2);
    });
    await check('partial failures and truncated searches cannot become translation_missing', async () => {
      let calls = 0;
      const partial = createTranslationFinder({ searchMods: async () => { calls += 1; if (calls === 1) throw client.failure('NEXUS_NETWORK', 'Network unavailable', true, { retryAfterMs: 3600000 }); return []; } });
      await assert.rejects(() => partial(input), error => error.code === 'NEXUS_SEARCH_INCOMPLETE' && error.retryable && error.search.failed === 1 && error.retryAfterMs === 3600000);
      assert.strictEqual(calls, variants(input.modName).length);
      const truncated = await finder(Object.assign([], { search: { complete: false } }))(input);
      assert.strictEqual(truncated.reason, 'translation_search_incomplete');
      assert.strictEqual(await finder([])(input), null);
      let denied = 0;
      await assert.rejects(() => createTranslationFinder({ searchMods: async () => { denied += 1; throw client.failure('NEXUS_AUTH_REQUIRED', 'Nexus HTTP 401'); } })(input), { code: 'NEXUS_AUTH_REQUIRED' });
      assert.strictEqual(denied, 1);
      let limited = 0;
      await assert.rejects(() => createTranslationFinder({ searchMods: async () => { limited += 1; throw client.failure('NEXUS_RATE_LIMIT', 'Nexus HTTP 429', true); } })(input), { code: 'NEXUS_RATE_LIMIT' });
      assert.strictEqual(limited, 1, 'rate limits must stop the remaining query variants');
    });
    await check('self matches, wrong games and false Russian markers are excluded', async () => {
      assert.strictEqual(await finder([candidate({ modId: '1' }), candidate({ game: 'fallout4' })])(input), null);
      assert.strictEqual(ruMarker('Ruslan Mod'), false);
      assert.strictEqual(ruMarker('Mod - Русский перевод'), true);
      for (const description of ['https://www.nexusmods.com.evil.invalid/stardewvalley/mods/1', 'https://evil.invalid/?url=https://www.nexusmods.com/stardewvalley/mods/1', 'https://www.nexusmods.com/stardewvalley/mods/10', 'https://www.nexusmods.com/fallout4/mods/1']) assert.strictEqual(linksOriginal(description, game, '1'), false);
    });
    await check('pipeline stops before downloads on identity conflicts, review or invalid translation IDs', async () => {
      const provider = { id: 'fixture', capabilities: { getMod: true }, getMod: async () => ({ mod_id: 1, name: 'Good Mod', author: 'Original' }), download: async () => assert.fail('must not download') };
      const pipeline = translationFinder => createModProcessingPipeline({ provider, translationFinder, builder: async () => assert.fail('must not build'), outputDir: '/fixture' });
      assert.strictEqual((await pipeline(async () => assert.fail('must not search'))({ game, nexusModId: '1', name: 'Wrong' })).result.error, 'identity_conflict');
      assert.strictEqual((await pipeline(async () => ({ status: 'needs_review', reason: 'translation_ambiguous', candidates: [candidate()] }))({ game, nexusModId: '1', name: 'Good Mod' })).result.status, 'needs_review');
      assert.strictEqual((await pipeline(async () => ({ translationId: '1' }))({ game, nexusModId: '1', name: 'Good Mod' })).result.error, 'invalid_translation_identity');
    });
    await check('legacy translation checkpoints are revalidated and old references are retained', async () => {
      let searches = 0; let downloads = 0;
      const pipeline = createModProcessingPipeline({ provider: { id: 'fixture', capabilities: {}, validate: async () => true, download: async () => { downloads += 1; return { path: '/fixture/new.zip' }; } }, translationFinder: async () => { searches += 1; return { translationId: '2' }; }, builder: async () => ({ output: '/fixture/built.zip' }), outputDir: '/fixture' });
      const result = (await pipeline({ game, nexusModId: '1', name: 'Good Mod' }, { translationId: '9', translationFile: '/fixture/old.zip', remoteAssets: { translationFile: { fixture: 'retained' } } })).result;
      assert.strictEqual(searches, 1); assert.strictEqual(downloads, 2);
      assert.strictEqual(result.retainedTranslations[0].translationId, '9');
      assert.strictEqual(result.retainedTranslations[0].remoteAssets.translationFile.fixture, 'retained');
      assert.deepStrictEqual(result.translationSelection, { schema: 1, game, originalModId: '1', translationId: '2' });
      await pipeline({ game, nexusModId: '1', name: 'Good Mod' }, result);
      assert.strictEqual(searches, 1, 'a new bound checkpoint should resume without another search');
    });
    await check('ambiguous, archived and nonexistent files cannot be silently selected', async () => {
      client.getFiles = async () => [{ file_id: 10, category_name: 'MAIN' }, { file_id: 11, category_name: 'MAIN' }, { file_id: 12, category_name: 'ARCHIVED', is_primary: true }];
      await assert.rejects(() => chooseFile(game, '1'), error => error.code === 'NEXUS_FILE_SELECTION' && error.action.candidates.length === 2);
      await assert.rejects(() => downloadMod({ game, modId: '1', fileId: '999' }), { code: 'NEXUS_FILE_UNAVAILABLE' });
      await assert.rejects(() => downloadMod({ game, modId: '1', fileId: '12' }), { code: 'NEXUS_FILE_UNAVAILABLE' });
      client.getFiles = async () => [{ file_id: 10, category_name: 'MAIN' }, { file_id: 11, category_name: 'MAIN', is_primary: true }];
      assert.strictEqual((await chooseFile(game, '1')).file_id, 11);
    });
    await check('explicit file IDs survive import/queue normalization and prevent stale-cache reuse', async () => {
      const parsed = require('../lib/input-parser').parseInput('name,author,game,modid,originalfileid,translationfileid\nGood Mod,Original,stardewvalley,1,501,202')[0];
      const doc = { version: 3, items: [] };
      require('../lib/job-queue').mergeJobs(doc, [parsed]);
      assert.strictEqual(doc.items[0].originalFileId, '501'); assert.strictEqual(doc.items[0].translationFileId, '202');
      assert.throws(() => require('../lib/job-queue').mergeJobs({ items: [] }, [{ ...parsed, originalFileId: '../escape' }]), error => error.statusCode === 400);
      const downloads = [];
      const processMod = createModProcessingPipeline({ provider: { id: 'fixture', capabilities: {}, validate: async () => true, download: async options => { downloads.push(options); return { ...options, path: '/fixture/' + options.fileId + '.zip' }; } }, translationFinder: async () => assert.fail('bound selection must resume'), builder: async () => ({ output: '/fixture/built.zip' }), outputDir: '/fixture' });
      await processMod(parsed, { translationId: '2', translationSelection: { schema: 1, game, originalModId: '1', translationId: '2' }, originalFile: '/fixture/stale.zip', originalDownload: { game: 'fallout4', modId: '1', fileId: '501' }, translationFile: '/fixture/old-translation.zip', translationDownload: { game, modId: '2', fileId: '201' } });
      assert.deepStrictEqual(downloads.map(item => item.fileId), ['501', '202']);
    });
    await check('worker persists permanent authorization actions without consuming retries', async () => {
      const queue = require('../lib/job-queue'); const state = require('../lib/state-store'); const { createWorker } = require('../scripts/ru-pack-worker');
      let downloads = 0;
      queue.addJobs([{ game, nexusModId: '1', name: 'Good Mod', author: 'Original' }]);
      const worker = createWorker({ provider: { id: 'nexus', capabilities: {}, download: async () => { downloads += 1; throw client.failure('NEXUS_DOWNLOAD_AUTHORIZATION', 'Website authorization required', false, { action: { type: 'authorize_nexus_download', url: 'https://www.nexusmods.com/stardewvalley/mods/1?tab=files' } }); } }, translationFinder: async () => ({ translationId: '2' }) });
      await worker.start(); await worker.start();
      const result = state.getResults()[0];
      assert.strictEqual(result.status, 'needs_review'); assert.strictEqual(result.attempts, 1); assert.strictEqual(result.nextAttemptAt, null); assert.strictEqual(downloads, 1);
      assert.strictEqual(queue.load()[0].action.type, 'authorize_nexus_download');
    });
    await check('worker retry checkpoint respects a provider cooldown after restart', async () => {
      const queue = require('../lib/job-queue'); const state = require('../lib/state-store'); const { createWorker } = require('../scripts/ru-pack-worker');
      let clock = Date.now(); let searches = 0;
      queue.addJobs([{ game, nexusModId: '3', name: 'Rate Fixture' }]);
      const settings = { now: () => clock, retryBaseMs: 1000, provider: { id: 'nexus', capabilities: {}, download: async () => assert.fail('must wait') }, translationFinder: async () => { searches += 1; throw client.failure('NEXUS_RATE_LIMIT', 'Nexus HTTP 429', true, { retryAfterMs: 3600000 }); } };
      await createWorker(settings).start();
      const retry = state.getResults().find(row => row.nexusModId === '3');
      assert.strictEqual(Date.parse(retry.nextAttemptAt), clock + 3600000);
      clock += 1001; await createWorker(settings).start();
      assert.strictEqual(searches, 1);
    });
    await check('HTTP previews share identity decisions and never enqueue or download', async () => {
      client.getMod = async ({ modId }) => String(modId) === '1' ? { mod_id: 1, game, name: 'Good Mod', author: 'Original' } : metadata();
      client.searchMods = async () => [candidate({ modId: '1', name: 'Good Mod', author: 'Other' })];
      const { createServer } = require('../render-server'); const paths = require('../config/paths');
      const before = fs.readFileSync(paths.queueFile, 'utf8');
      const server = createServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
      const base = 'http://127.0.0.1:' + server.address().port;
      const post = (route, body) => fetch(base + route, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      try {
        const wrong = await (await post('/api/bulkModSearch', { game, text: 'name,author\nGood Mod,Original' })).json();
        assert.strictEqual(wrong.results[0].status, 'not_found');
        const conflict = await (await post('/api/bulkModSearch', { game, text: 'name,author,modid\nGood Mod,Wrong,1' })).json();
        assert.strictEqual(conflict.results[0].reason, 'identity_conflict');
        client.searchMods = async () => [candidate()];
        const translation = await (await post('/api/translationSearch', { game, modId: '1' })).json();
        assert.strictEqual(translation.status, 'translation_found');
        const mismatch = await (await post('/api/translationSearch', { game, modId: '1', author: 'Wrong' })).json();
        assert.strictEqual(mismatch.reason, 'identity_conflict');
        assert.strictEqual((await fetch(base + '/api/translationSearch')).status, 405);
        client.getCapabilities = async () => ({ authenticated: true, directDownloads: false, requiresWebsiteAuthorization: true, key: 'private-fixture-must-not-escape' });
        const capabilities = await post('/api/nexusCapabilities', {});
        assert.strictEqual(capabilities.headers.get('cache-control'), 'no-store');
        assert.deepStrictEqual(await capabilities.json(), { ok: true, authenticated: true, directDownloads: false, requiresWebsiteAuthorization: true });
        assert.strictEqual((await post('/api/translationSearch', { game, modId: '../escape' })).status, 400);
        assert.strictEqual((await post('/api/bulkModSearch', { game, text: Array.from({ length: 26 }, (_, i) => 'Mod' + i).join('\n') })).status, 413);
        let limited = 0;
        client.searchMods = async () => { limited += 1; throw client.failure('NEXUS_RATE_LIMIT', 'Nexus HTTP 429', true); };
        const limit = await (await post('/api/bulkModSearch', { game, text: 'First Mod A\nSecond Mod A' })).json();
        assert.strictEqual(limit.errors, 2); assert.strictEqual(limited, 1, 'a blocked account must not be queried for every mod in the batch');
        client.searchMods = async () => { throw client.failure('NEXUS_NETWORK', 'Nexus request failed', true); };
        assert.strictEqual((await post('/api/translationSearch', { game, modId: '1' })).status, 503);
        assert.strictEqual(fs.readFileSync(paths.queueFile, 'utf8'), before);
      } finally { await new Promise(resolve => server.close(resolve)); }
    });
    console.log('Nexus resolution test passed (' + scenarios + ' scenarios; mock Nexus, real HTTP/worker/state)');
  } finally { Object.assign(client, original); fs.rmSync(root, { recursive: true, force: true }); }
}
if (require.main === module) run().catch(error => { console.error(error); process.exitCode = 1; });
module.exports = run;
