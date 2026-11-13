const assert = require('assert');
const { createNexusClient } = require('../providers/nexus-client');
const { configuration } = require('../config/nexus');

async function run() {
  const secret = 'fixture-api-secret-never-a-real-key';
  const env = { NEXUS_API_KEY: secret };
  const mod = { game: 'stardewvalley', modId: '1' };
  const metadata = { mod_id: 1, name: 'Example', author: 'Author' };
  const json = (data, init) => new Response(JSON.stringify(data), init);
  let scenarios = 0;
  const check = async (label, fn) => { await fn(); scenarios += 1; console.log('  nexus client: ' + label); };
  const safe = (code, extra = () => true) => error => error.code === code && !String(error.stack).includes(secret) && error.cause === undefined && extra(error);

  await check('public GraphQL search works without a key and preserves pagination evidence', async () => {
    const client = createNexusClient({ env: {}, fetch: async (url, options) => {
      assert.ok(url.endsWith('/v2/graphql'));
      assert.strictEqual(options.headers.APIKEY, undefined);
      assert.strictEqual(options.redirect, 'manual');
      const body = JSON.parse(options.body);
      assert.deepStrictEqual(body.variables.filter.gameDomainName, [{ value: 'stardewvalley', op: 'EQUALS' }]);
      assert.strictEqual(body.variables.count, 100);
      return json({ data: { mods: { totalCount: 2, nodes: [{ modId: 1, name: 'Example', author: '', uploader: { name: 'Uploader' }, game: { domainName: 'stardewvalley' } }] } } });
    } });
    const found = await client.searchMods({ game: 'stardewvalley', name: 'Example', limit: 999 });
    assert.strictEqual(found[0].author, '', 'uploader is not proof of authorship');
    assert.strictEqual(found[0].uploader, 'Uploader');
    assert.deepStrictEqual(found.search, { complete: false, totalCount: 2 });
    await assert.rejects(() => client.getMod(mod), safe('NEXUS_AUTH_REQUIRED'));
    await createNexusClient({ env, fetch: async (url, options) => { assert.strictEqual(options.headers.APIKEY, undefined); return json({ data: { mods: { nodes: [], totalCount: 0 } } }); } }).searchMods({ game: mod.game, name: 'Example' });
  });
  await check('permanent HTTP errors never retry or echo provider bodies', async () => {
    for (const [status, code] of [[401, 'NEXUS_AUTH_REQUIRED'], [403, 'NEXUS_FORBIDDEN'], [404, 'NEXUS_NOT_FOUND']]) {
      let calls = 0;
      const client = createNexusClient({ env, fetch: async () => { calls += 1; return new Response(secret, { status }); } });
      await assert.rejects(() => client.getMod(mod), safe(code, error => !error.retryable));
      assert.strictEqual(calls, 1);
    }
  });
  await check('transient errors and short Retry-After use bounded retries', async () => {
    let calls = 0; const waits = [];
    const client = createNexusClient({ env, sleep: async ms => waits.push(ms), fetch: async () => {
      calls += 1;
      if (calls === 1) return new Response(secret, { status: 429, headers: { 'retry-after': '2' } });
      if (calls === 2) return new Response(secret, { status: 503 });
      return json(metadata);
    } });
    assert.strictEqual((await client.getMod(mod)).name, 'Example');
    assert.strictEqual(calls, 3); assert.deepStrictEqual(waits, [2000, 500]);
  });
  await check('a long rate limit is surfaced without immediate retries or a blocking sleep', async () => {
    for (const header of ['3600', 'Thu, 01 Jan 1970 01:00:00 GMT']) {
      let calls = 0;
      const client = createNexusClient({ env, now: () => 0, sleep: async () => assert.fail('must not sleep'), fetch: async () => { calls += 1; return new Response(secret, { status: 429, headers: { 'retry-after': header } }); } });
      await assert.rejects(() => client.getMod(mod), safe('NEXUS_RATE_LIMIT', error => error.retryAfterMs === 3600000));
      assert.strictEqual(calls, 1);
    }
  });
  await check('transport failures have a bounded count and sanitized errors', async () => {
    let calls = 0;
    const client = createNexusClient({ env, sleep: async () => {}, fetch: async () => { calls += 1; throw new Error(secret + ' https://cdn.invalid/?key=' + secret); } });
    await assert.rejects(() => client.getMod(mod), safe('NEXUS_NETWORK'));
    assert.strictEqual(calls, 3);
  });
  await check('an interrupted successful JSON body retries the whole request', async () => {
    let calls = 0;
    const client = createNexusClient({ env, sleep: async () => {}, fetch: async () => {
      calls += 1;
      if (calls === 1) return new Response(new ReadableStream({ start(controller) { controller.error(new Error(secret)); } }));
      return json(metadata);
    } });
    assert.strictEqual((await client.getMod(mod)).mod_id, 1);
    assert.strictEqual(calls, 2);
  });
  await check('invalid JSON and partial GraphQL responses are not reported as empty search', async () => {
    const malformed = createNexusClient({ env, fetch: async () => new Response(secret) });
    await assert.rejects(() => malformed.getMod(mod), safe('NEXUS_RESPONSE_INVALID'));
    const partial = createNexusClient({ env: {}, fetch: async () => json({ data: { mods: { nodes: [], totalCount: 0 } }, errors: [{ message: secret }] }) });
    await assert.rejects(() => partial.searchMods({ game: mod.game, name: 'Example' }), safe('NEXUS_GRAPHQL'));
  });
  await check('malformed pages, foreign-game nodes and conflicting REST IDs fail closed', async () => {
    for (const page of [{ nodes: [], totalCount: -1 }, { nodes: null, totalCount: 0 }, { nodes: [{ modId: 1, name: 'Example', game: { domainName: 'fallout4' } }], totalCount: 1 }]) {
      const client = createNexusClient({ env: {}, fetch: async () => json({ data: { mods: page } }) });
      await assert.rejects(() => client.searchMods({ game: mod.game, name: 'Example' }), safe('NEXUS_RESPONSE_INVALID'));
    }
    const wrong = createNexusClient({ env, fetch: async () => json({ ...metadata, mod_id: 2 }) });
    await assert.rejects(() => wrong.getMod(mod), safe('NEXUS_RESPONSE_INVALID'));
  });
  await check('redirects never forward API credentials and CDN requests do not receive them', async () => {
    let calls = 0;
    const client = createNexusClient({ env, fetch: async (url, options) => {
      calls += 1; assert.strictEqual(options.redirect, 'manual');
      if (url.includes('/v1/')) return new Response(secret, { status: 302, headers: { location: 'https://attacker.invalid/?token=' + secret } });
      assert.strictEqual(options.headers, undefined);
      return new Response('fixture');
    } });
    await assert.rejects(() => client.getMod(mod), safe('NEXUS_REDIRECT'));
    assert.strictEqual(calls, 1);
    await (await client.request('https://cdn.invalid/file?token=' + secret)).body.cancel();
    assert.strictEqual(calls, 2);
  });
  await check('download authorization returns only a public manual-action URL', async () => {
    const client = createNexusClient({ env, fetch: async () => new Response(secret, { status: 403 }) });
    await assert.rejects(() => client.getDownloadLinks({ ...mod, fileId: '2' }), safe('NEXUS_DOWNLOAD_AUTHORIZATION', error => error.action.type === 'authorize_nexus_download' && error.action.url === 'https://www.nexusmods.com/stardewvalley/mods/1?tab=files' && !JSON.stringify(error.action).includes(secret)));
  });
  await check('timeouts include body reads and caller cancellation is permanent', async () => {
    const keeper = setTimeout(() => {}, 200);
    let calls = 0;
    try {
      const client = createNexusClient({ env: { ...env, NEXUS_LOADER_REQUEST_TIMEOUT_MS: '5' }, sleep: async () => {}, fetch: async (url, options) => {
        calls += 1;
        return new Response(new ReadableStream({ start(controller) { options.signal.addEventListener('abort', () => controller.error(new Error(secret)), { once: true }); } }));
      } });
      await assert.rejects(() => client.getMod(mod), safe('NEXUS_NETWORK'));
      assert.strictEqual(calls, 3);
      const abort = new AbortController(); abort.abort();
      const cancelled = createNexusClient({ env, fetch: async () => { throw new Error(secret); } });
      await assert.rejects(() => cancelled.getMod({ ...mod, signal: abort.signal }), safe('NEXUS_CANCELLED', error => !error.retryable));
    } finally { clearTimeout(keeper); }
  });
  await check('account validation returns only capability booleans, never identity or credentials', async () => {
    for (const premium of [false, true]) {
      const client = createNexusClient({ env, fetch: async url => { assert.ok(url.endsWith('/users/validate')); return json({ key: secret, name: 'Private Fixture', email: 'private@example.invalid', user_id: 123, is_premium: premium }); } });
      const result = await client.getCapabilities();
      assert.deepStrictEqual(result, { authenticated: true, directDownloads: premium, requiresWebsiteAuthorization: !premium });
      assert.ok(!JSON.stringify(result).includes(secret));
    }
  });
  await check('invalid configuration and request identities reject without exposing values', async () => {
    for (const settings of [{ NEXUS_API_V1: 'http://example.invalid' }, { NEXUS_GRAPHQL: 'https://user:' + secret + '@example.invalid' }, { NEXUS_LOADER_REQUEST_TIMEOUT_MS: 'Infinity' }]) assert.throws(() => configuration(settings), safe('NEXUS_CONFIG'));
    const client = createNexusClient({ env, fetch: async () => assert.fail('invalid identity must not send requests') });
    await assert.rejects(() => client.getMod({ game: '../escape', modId: '1' }), safe('NEXUS_INPUT'));
    await assert.rejects(() => client.getFiles({ game: mod.game, modId: '0' }), safe('NEXUS_INPUT'));
    await assert.rejects(() => client.getDownloadLinks(mod), safe('NEXUS_INPUT'));
  });
  console.log('Nexus client test passed (' + scenarios + ' scenarios; mock HTTP)');
}
if (require.main === module) run().catch(error => { console.error(error); process.exitCode = 1; });
module.exports = run;
