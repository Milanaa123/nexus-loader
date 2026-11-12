const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const AdmZip = require('adm-zip');

async function run() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-supabase-'));
  process.env.NEXUS_LOADER_ROOT = root;
  process.env.RU_PACK_WORK = path.join(root, 'work');
  const paths = require('../config/paths');
  const { cloudConfig, selectedBackend } = require('../config/cloud');
  const { createSupabaseStore } = require('../lib/supabase-store');
  const { createHandler, sha256 } = await import('../supabase/functions/nexus-storage/handler.mjs');
  const token = 'fixture_' + 'x'.repeat(56);
  const tokenHash = await sha256(Buffer.from(token));
  const config = { url: 'https://aaaaaaaaaaaaaaaaaaaa.supabase.co/functions/v1/nexus-storage', token, chunkBytes: 2097152, maxFileBytes: 838860800, timeoutMs: 1000, attempts: 3 };
  const docs = new Map(Object.entries({ queue: { version: 3, items: [] }, progress: {}, processed: [], results: [], errors: [], verification: {} }).map(([name, value]) => [name, { name, value, revision: 0, mutation: null }]));
  const chunks = new Map(); const events = []; const calls = [];
  let clock = 0; let held = { owner: null, fence: 0, until: 0 };
  const modes = {};
  const repository = {
    authorize: async hash => hash === tokenHash,
    read: async name => structuredClone(docs.get(name)),
    cas: async (name, body) => {
      if ((name !== 'queue' && name !== 'verification') || body.owner) {
        if (held.owner !== body.owner || held.fence !== body.fence || held.until <= clock) throw { code: '55P03' };
      }
      const old = docs.get(name);
      if (old.mutation === body.mutation) { assert.deepStrictEqual(old.value, body.value); return structuredClone(old); }
      if (modes.conflict) { modes.conflict = false; old.revision += 1; return null; }
      if (old.revision !== body.revision) return null;
      const next = { name, value: structuredClone(body.value), revision: old.revision + 1, mutation: body.mutation };
      docs.set(name, next);
      return structuredClone(next);
    },
    lease: async body => {
      if (body.action === 'claim') {
        if (held.until > clock && held.owner !== body.owner) return null;
        held = { owner: body.owner, fence: held.owner === body.owner && held.until > clock ? held.fence : held.fence + 1, until: clock + 120000 };
      } else if (held.owner !== body.owner || held.fence !== body.fence || held.until <= clock) return null;
      else if (body.action === 'release') held = { ...held, owner: null, until: clock };
      else held.until = clock + 120000;
      return { owner: held.owner, fence: held.fence };
    },
    upload: async (hash, bytes) => {
      if (modes.quota) throw { code: '53100' };
      if (!chunks.has(hash)) chunks.set(hash, Buffer.from(bytes));
    },
    download: async hash => modes.corrupt ? Buffer.from('damaged') : chunks.get(hash) || null,
    event: async entry => { events.push(entry); }
  };
  const handler = createHandler(repository);
  async function transport(url, init = {}) {
    calls.push({ url, method: init.method || 'GET' });
    assert.strictEqual(init.redirect, 'manual');
    assert.ok(init.signal);
    if (modes.network) throw new Error('secret transport error ' + token);
    const response = await handler(new Request(url, init));
    if (modes.dropCommit && init.method === 'PUT' && url.includes('/documents/')) { modes.dropCommit = false; throw new Error('response lost ' + token); }
    return response;
  }
  const store = extra => createSupabaseStore({ config, fetch: transport, sleep: async () => {}, ...extra });
  let scenarios = 0;
  async function check(name, fn) { await fn(); scenarios += 1; console.log('  supabase: ' + name); }
  async function rejectsCode(fn, code) { await assert.rejects(fn, e => e.code === code); }
  try {
    await check('configuration fails closed, without echoing values', async () => {
      assert.strictEqual(selectedBackend({}), 'local');
      assert.throws(() => selectedBackend({ NEXUS_LOADER_STORAGE_BACKEND: 'typo' }), { code: 'STORAGE_CONFIG' });
      assert.throws(() => cloudConfig({}), { code: 'STORAGE_CONFIG' });
      assert.throws(() => cloudConfig({ NEXUS_LOADER_SUPABASE_URL: 'https://attacker.invalid', NEXUS_LOADER_STORAGE_TOKEN: token }), { code: 'STORAGE_CONFIG' });
    });
    await check('custom authentication rejects missing/wrong tokens before touching data', async () => {
      assert.strictEqual((await handler(new Request(config.url + '/health'))).status, 401);
      assert.strictEqual((await handler(new Request(config.url + '/health', { headers: { Authorization: 'Bearer ' + 'z'.repeat(64) } }))).status, 401);
      assert.strictEqual((await store().health()).schema, 1);
    });
    await check('queue deduplication and CAS contention reuse existing domain logic', async () => {
      const client = store();
      modes.conflict = true;
      assert.strictEqual((await client.queue.addJobs([{ name: 'Cloud Fixture', author: 'Example', game: 'fallout4', nexusModId: '1' }])).added, 1);
      assert.strictEqual((await store().queue.addJobs([{ name: 'Cloud Fixture', author: 'Example', game: 'fallout4', nexusModId: '1' }])).added, 0);
      assert.strictEqual((await client.queue.load()).length, 1);
    });
    await check('a lost commit response cannot append an error twice', async () => {
      const client = store(); const lease = await client.acquireLock();
      modes.dropCommit = true;
      await client.state.appendError(new Error('fixture error'));
      assert.strictEqual((await client.state.getErrors()).length, 1);
      await lease.release();
    });
    await check('leases reject simultaneous writers and fence expired workers', async () => {
      const old = store(); const current = store();
      const first = await old.acquireLock();
      await rejectsCode(() => current.acquireLock(), 'WORKER_BUSY');
      clock += 121000;
      const next = await current.acquireLock();
      await rejectsCode(() => first.touch(), 'WORKER_BUSY');
      await rejectsCode(() => old.state.saveProgress({ old: true }), 'WORKER_BUSY');
      await current.state.saveProgress({ current: true });
      await first.release();
      await next.touch();
      await next.release();
    });
    await check('immutable multi-chunk files restore after loss of the local cache', async () => {
      fs.mkdirSync(paths.originalsDir, { recursive: true });
      const source = paths.cloudAssetPath('originals', 'large-fixture.zip');
      const data = crypto.randomBytes(config.chunkBytes + 71);
      fs.writeFileSync(source, data);
      const client = store();
      const asset = await client.uploadFile(source);
      assert.strictEqual(asset.chunks.length, 2);
      fs.unlinkSync(source);
      assert.strictEqual(await store().restoreFile(asset), source);
      assert.deepStrictEqual(fs.readFileSync(source), data);
      const requests = calls.length;
      await store().restoreFile(asset);
      assert.strictEqual(calls.length, requests, 'a verified local copy must not download again');
      fs.writeFileSync(source, 'user-owned corrupt file');
      await rejectsCode(() => store().restoreFile(asset), 'STORAGE_ARTIFACT_EXISTS');
      assert.strictEqual(fs.readFileSync(source, 'utf8'), 'user-owned corrupt file');
      fs.unlinkSync(source);
      modes.corrupt = true;
      await rejectsCode(() => store().restoreFile(asset), 'STORAGE_HTTP');
      modes.corrupt = false;
      assert.ok(!fs.existsSync(source));
      assert.ok(!fs.readdirSync(paths.originalsDir).some(name => name.endsWith('.partial')));
      await assert.rejects(() => store().restoreFile({ ...asset, name: '../escape' }), /Invalid cloud artifact path/);
    });
    await check('quota, invalid checksums and unsafe paths are actionable errors', async () => {
      const source = paths.cloudAssetPath('originals', 'quota.zip'); fs.writeFileSync(source, 'quota fixture');
      modes.quota = true;
      await rejectsCode(() => store().uploadFile(source), 'STORAGE_QUOTA');
      modes.quota = false;
      const bad = await handler(new Request(config.url + '/chunks/' + '0'.repeat(64), { method: 'PUT', headers: { Authorization: 'Bearer ' + token }, body: 'wrong bytes' }));
      assert.strictEqual(bad.status, 400);
      assert.throws(() => paths.cloudAssetPath('builds', '../outside.zip'));
      assert.throws(() => paths.cloudAssetPath('unknown', 'file.zip'));
      await rejectsCode(() => store().restoreFile({ sha256: 'bad', size: 1, chunks: [] }), 'STORAGE_CORRUPT');
      if (process.platform !== 'win32') {
        const outside = path.join(root, 'outside'); fs.mkdirSync(outside);
        fs.symlinkSync(outside, paths.cloudAssetPath('originals', 'unsafe-parent'));
        const chunk = Buffer.from('symlink fixture'); const hash = await sha256(chunk); chunks.set(hash, chunk);
        await rejectsCode(() => store().restoreFile({ area: 'originals', name: 'unsafe-parent/test.zip', sha256: hash, size: chunk.length, chunks: [{ sha256: hash, size: chunk.length }] }), 'STORAGE_PATH');
        assert.deepStrictEqual(fs.readdirSync(outside), []);
        fs.writeFileSync(path.join(outside, 'test.zip'), chunk);
        await rejectsCode(() => store().restoreFile({ area: 'originals', name: 'unsafe-parent/test.zip', sha256: hash, size: chunk.length, chunks: [{ sha256: hash, size: chunk.length }] }, { repair: true }), 'STORAGE_PATH');
        assert.deepStrictEqual(fs.readFileSync(path.join(outside, 'test.zip')), chunk);
      }
    });
    await check('network failures are bounded and never expose tokens or underlying messages', async () => {
      modes.network = true;
      const before = calls.length;
      await assert.rejects(() => store().health(), e => e.code === 'STORAGE_NETWORK' && !String(e.stack).includes(token) && e.cause === undefined);
      assert.strictEqual(calls.length - before, config.attempts);
      modes.network = false;
    });
    await check('the existing worker checkpoints files remotely and resumes without redownloading', async () => {
      fs.mkdirSync(paths.translationsDir, { recursive: true });
      const original = paths.cloudAssetPath('originals', 'mod.zip');
      const translation = paths.cloudAssetPath('translations', 'mod-ru.zip');
      const zip = new AdmZip(); zip.addFile('Mod/manifest.json', Buffer.from(JSON.stringify({ Name: 'Cloud Fixture', UniqueID: 'Example.CloudFixture', Version: '1.0' }))); zip.addFile('Mod/text.txt', Buffer.from('English'));
      zip.writeZip(original);
      const ru = new AdmZip(); ru.addFile('Mod/text.txt', Buffer.from('Русский')); ru.writeZip(translation);
      let downloads = 0;
      const provider = { id: 'nexus', capabilities: {}, download: async ({ role }) => { downloads += 1; return { path: role === 'original' ? original : translation }; }, validate: async ({ path: file }) => fs.existsSync(file) };
      const { createWorker } = require('../scripts/ru-pack-worker');
      const first = createWorker({ stores: store(), provider, translationFinder: async () => ({ translationId: '2' }) });
      const results = await first.start();
      assert.strictEqual(results[0].status, 'built');
      assert.strictEqual(downloads, 2);
      const output = results[0].outputFile;
      const outputBytes = fs.readFileSync(output);
      assert.ok(docs.get('results').value[0].remoteAssets.outputFile);
      fs.writeFileSync(output, 'corrupt cache fixture');
      await createWorker({ stores: store(), provider, translationFinder: async () => { throw new Error('must reuse built result'); } }).start();
      assert.deepStrictEqual(fs.readFileSync(output), outputBytes);
      assert.ok(fs.readdirSync(paths.outputDir).some(file => file.includes('.corrupt-')));
      fs.rmSync(paths.workDir, { recursive: true, force: true }); // Isolated fixture cache only.
      const second = createWorker({ stores: store(), provider, translationFinder: async () => { throw new Error('must resume'); } });
      const resumed = await second.start();
      assert.strictEqual(resumed[0].status, 'built');
      assert.deepStrictEqual(fs.readFileSync(output), outputBytes);
      assert.strictEqual(downloads, 2);
      assert.ok(events.some(event => event.message === 'Job checkpoint committed'));
    });
    await check('worker-loop ticks cannot overlap while a remote queue read is pending', async () => {
      const localQueue = require('../lib/job-queue');
      const loop = require('../scripts/free-worker-loop');
      const originalLoad = localQueue.load;
      let release; let reads = 0;
      const gate = new Promise(resolve => { release = resolve; });
      localQueue.load = async () => { reads += 1; await gate; return []; };
      try {
        const first = loop.tick(); const second = loop.tick();
        await Promise.resolve();
        assert.strictEqual(reads, 1);
        release(); await Promise.all([first, second]);
      } finally { release(); localQueue.load = originalLoad; }
    });
    await check('HTTP import/status/download use remote storage and never fall back on outage', async () => {
      const nativeFetch = globalThis.fetch;
      const beforeEnv = { backend: process.env.NEXUS_LOADER_STORAGE_BACKEND, url: process.env.NEXUS_LOADER_SUPABASE_URL, token: process.env.NEXUS_LOADER_STORAGE_TOKEN };
      process.env.NEXUS_LOADER_STORAGE_BACKEND = 'supabase';
      process.env.NEXUS_LOADER_SUPABASE_URL = 'https://aaaaaaaaaaaaaaaaaaaa.supabase.co';
      process.env.NEXUS_LOADER_STORAGE_TOKEN = token;
      globalThis.fetch = (url, init) => String(url).startsWith(config.url) ? transport(url, init) : nativeFetch(url, init);
      const { createServer } = require('../render-server');
      const server = createServer();
      await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
      const base = 'http://127.0.0.1:' + server.address().port;
      try {
        const input = { text: 'name,author,game\nAPI Queue Fixture,Example,fallout4' };
        const imported = await nativeFetch(base + '/api/startFromInput', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) });
        assert.strictEqual(imported.status, 202);
        assert.strictEqual((await imported.json()).added, 1);
        const status = await (await nativeFetch(base + '/api/status')).json();
        assert.strictEqual(status.storage.workspace, 'supabase');
        assert.strictEqual(status.queue.total, 2);
        assert.ok(!JSON.stringify(status).includes(token));
        const downloaded = await nativeFetch(base + '/api/downloadReady?name=' + encodeURIComponent(status.ready[0].file));
        assert.strictEqual(downloaded.status, 200);
        assert.strictEqual(crypto.createHash('sha256').update(Buffer.from(await downloaded.arrayBuffer())).digest('hex'), status.ready[0].sha256);
        const savedQueue = structuredClone(docs.get('queue'));
        const localQueueBefore = fs.existsSync(paths.queueFile) ? fs.readFileSync(paths.queueFile, 'utf8') : null;
        modes.network = true;
        const failed = await nativeFetch(base + '/api/startFromInput', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) });
        assert.strictEqual(failed.status, 503);
        assert.deepStrictEqual(docs.get('queue'), savedQueue);
        assert.strictEqual(fs.existsSync(paths.queueFile) ? fs.readFileSync(paths.queueFile, 'utf8') : null, localQueueBefore);
      } finally {
        modes.network = false;
        await new Promise(resolve => server.close(resolve));
        globalThis.fetch = nativeFetch;
        for (const [key, value] of Object.entries({ NEXUS_LOADER_STORAGE_BACKEND: beforeEnv.backend, NEXUS_LOADER_SUPABASE_URL: beforeEnv.url, NEXUS_LOADER_STORAGE_TOKEN: beforeEnv.token })) {
          if (value === undefined) delete process.env[key]; else process.env[key] = value;
        }
      }
    });
    console.log('supabase storage test passed (' + scenarios + ' scenarios; mock gateway, real worker/archive/local-cache loss)');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
}
if (require.main === module) run().catch(e => { console.error(e); process.exitCode = 1; });
module.exports = run;
