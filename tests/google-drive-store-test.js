const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

function mockDrive() {
  const files = new Map();
  const sessions = new Map();
  const calls = [];
  const modes = { limit: '100000000000', usage: '0', writable: true };
  let serial = 0;
  let tokenCalls = 0;
  const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });
  const httpError = (status, reason = 'untrusted-provider-message') => json({ error: { message: 'secret-provider-message', errors: [{ reason }] } }, status, { 'retry-after': modes.retryAfter || '0' });
  function complete(session) {
    const bytes = session.bytes;
    const value = { ...session.metadata, size: String(bytes.length), trashed: false,
      md5Checksum: crypto.createHash('md5').update(bytes).digest('hex'), sha256Checksum: crypto.createHash('sha256').update(bytes).digest('hex') };
    if (modes.badUploadHash) value.md5Checksum = '0'.repeat(32);
    files.set(value.id, { metadata: value, bytes });
    session.completed = true;
    return value;
  }
  async function fetch(url, init = {}) {
    const u = new URL(url);
    calls.push({ url: u, method: init.method || 'GET', range: init.headers?.['Content-Range'], bodyLength: init.body?.length || 0 });
    assert.strictEqual(init.redirect, 'manual');
    assert.ok(init.signal, 'all HTTP requests, including media, need a timeout');
    if (u.origin === 'https://oauth2.googleapis.com') {
      tokenCalls += 1;
      assert.ok(new URLSearchParams(init.body).get('refresh_token'));
      if (modes.authError) return httpError(400);
      return json({ access_token: 'fake-access-token-' + tokenCalls, expires_in: 3600 });
    }
    assert.strictEqual(u.origin, 'https://www.googleapis.com', 'never send bearer tokens to untrusted URLs');
    assert.match(init.headers.Authorization, /^Bearer fake-access-token-\d+$/);
    if (modes.unauthorized) { modes.unauthorized -= 1; return httpError(401); }
    if (modes.network) throw new Error('network error: fake-client-secret fake-refresh-token https://private-session.invalid');
    if (modes.httpStatus) {
      const status = modes.httpStatus;
      if (modes.httpCount !== Infinity && --modes.httpCount <= 0) modes.httpStatus = null;
      return httpError(status, modes.reason);
    }
    if (u.pathname === '/drive/v3/files/folder') return json({ id: 'folder', mimeType: 'application/vnd.google-apps.folder', trashed: false, capabilities: { canAddChildren: modes.writable } });
    if (u.pathname === '/drive/v3/about') return json({ storageQuota: { limit: modes.limit, usage: modes.usage } });
    if (u.pathname === '/drive/v3/files/generateIds') return json({ ids: ['file-' + (++serial)] });
    if (u.pathname === '/drive/v3/files') {
      const q = u.searchParams.get('q');
      assert.ok(q.includes("'folder' in parents"));
      const wanted = /key='sha256' and value='([a-f0-9]+)'/.exec(q)?.[1];
      const candidates = [...files.values()].map(file => file.metadata).filter(file => file.appProperties?.sha256 === wanted);
      if (modes.pagination && !u.searchParams.get('pageToken')) return json({ files: [], nextPageToken: 'page-two', incompleteSearch: false });
      return json({ files: candidates, incompleteSearch: Boolean(modes.incompleteSearch) });
    }
    if (u.pathname.startsWith('/drive/v3/files/')) {
      const entry = files.get(u.pathname.split('/').pop());
      if (!entry) return httpError(404);
      if (u.searchParams.get('alt') !== 'media') return json(entry.metadata);
      if (modes.badDownload) return new Response(Buffer.alloc(entry.bytes.length, 7));
      if (modes.shortDownloads) { modes.shortDownloads -= 1; return new Response(entry.bytes.subarray(0, 1)); }
      if (modes.raceDestination) { fs.writeFileSync(modes.raceDestination, 'raced-in-user-file'); modes.raceDestination = null; }
      return new Response(entry.bytes, { headers: { 'Content-Length': String(entry.bytes.length) } });
    }
    assert.strictEqual(u.pathname, '/upload/drive/v3/files');
    if (init.method === 'POST') {
      const metadata = JSON.parse(init.body);
      if (files.has(metadata.id)) return httpError(409);
      if (modes.ambiguousInitiation) {
        modes.ambiguousInitiation = false;
        complete({ metadata, bytes: modes.cannedBytes });
        return httpError(503);
      }
      if (modes.unsafeLocation) return new Response(null, { headers: { Location: modes.unsafeLocation } });
      const sessionId = 'session-' + metadata.id;
      sessions.set(sessionId, { metadata, bytes: Buffer.alloc(0), total: Number(init.headers['X-Upload-Content-Length']) });
      return new Response(null, { headers: { Location: 'https://www.googleapis.com/upload/drive/v3/files?upload_id=' + sessionId } });
    }
    const session = sessions.get(u.searchParams.get('upload_id'));
    if (!session || modes.expired) { modes.expired = false; return httpError(404); }
    if (session.completed) return json(files.get(session.metadata.id).metadata);
    const range = init.headers['Content-Range'];
    if (range.startsWith('bytes */')) {
      if (modes.queryFailure && session.bytes.length) throw new Error('private-session-token');
      return new Response(null, { status: 308, headers: session.bytes.length ? { Range: 'bytes=0-' + (session.bytes.length - 1) } : {} });
    }
    const parts = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(range);
    assert.ok(parts);
    assert.strictEqual(Number(parts[1]), session.bytes.length, 'always resume at the acknowledged server offset');
    assert.strictEqual(init.body.length, Number(parts[2]) - Number(parts[1]) + 1);
    if (!modes.stalled) {
      const accepted = modes.partialAck ? init.body.subarray(0, 262144) : init.body;
      session.bytes = Buffer.concat([session.bytes, accepted]);
      modes.partialAck = false;
    }
    const finished = session.bytes.length === session.total ? complete(session) : null;
    if (modes.dropAfterAccept) { modes.dropAfterAccept = false; throw new Error('fake-refresh-token'); }
    if (finished) return json(finished, 201);
    return new Response(null, { status: 308, headers: session.bytes.length ? { Range: 'bytes=0-' + (session.bytes.length - 1) } : {} });
  }
  return { fetch, files, sessions, modes, calls, tokenCalls: () => tokenCalls, httpError };
}

async function run() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-drive-store-'));
  process.env.NEXUS_LOADER_ROOT = root;
  process.env.RU_PACK_WORK = path.join(root, 'work');
  const { createDriveStore, fingerprint } = require('../lib/google-drive-store');
  const { getDriveConfig, configurationStatus } = require('../config/storage');
  const { main } = require('../scripts/drive-storage');
  const paths = require('../config/paths');
  const env = { GOOGLE_DRIVE_CLIENT_ID: 'fake-client', GOOGLE_DRIVE_CLIENT_SECRET: 'fake-client-secret', GOOGLE_DRIVE_REFRESH_TOKEN: 'fake-refresh-token', GOOGLE_DRIVE_FOLDER_ID: 'folder' };
  const config = getDriveConfig(env);
  let checks = 0;
  function store(mock, extra = {}) {
    return createDriveStore({ config, fetch: mock.fetch, sleep: async () => {}, random: () => 0, ...extra });
  }
  async function check(name, test) {
    fs.rmSync(paths.driveTransfersDir, { recursive: true, force: true }); // This suite owns its isolated fixture root.
    await test(); checks += 1; console.log('  drive: ' + name);
  }
  async function rejectsCode(fn, code) { await assert.rejects(fn, error => error.code === code); }
  const source = path.join(root, 'source.zip');
  const bytes = crypto.randomBytes(1024 * 1024 + 512);
  fs.writeFileSync(source, bytes);
  try {
    await check('configuration reports presence, never credentials', async () => {
      assert.strictEqual(configurationStatus({}).configured, false);
      const report = configurationStatus(env);
      assert.strictEqual(report.configured, true);
      assert.strictEqual(report.runtimeIntegration, false);
      assert.ok(!JSON.stringify(report).includes('fake-'));
      assert.throws(() => getDriveConfig({}), { code: 'DRIVE_NOT_CONFIGURED' });
      assert.throws(() => getDriveConfig({ ...env, GOOGLE_DRIVE_MAX_ATTEMPTS: 'NaN' }), { code: 'DRIVE_INVALID_CONFIG' });
      assert.throws(() => createDriveStore({ config: { ...config, chunkBytes: 300000 } }), { code: 'DRIVE_INVALID_CONFIG' });
      assert.strictEqual((await main(['status'])).runtimeIntegration, false);
      await rejectsCode(() => main(['unknown']), 'DRIVE_USAGE');
    });
    await check('probe reads only folder capabilities and quota; concurrent calls share a token refresh', async () => {
      const mock = mockDrive();
      const client = store(mock);
      const result = await Promise.all([client.probe(), client.probe()]);
      assert.strictEqual(result[0].quota.remaining, mock.modes.limit);
      assert.strictEqual(mock.tokenCalls(), 1);
      assert.ok(!mock.calls.some(call => call.method !== 'GET' && call.url.origin !== 'https://oauth2.googleapis.com'));
    });
    await check('401 refreshes once; repeated rejection stops', async () => {
      const mock = mockDrive();
      mock.modes.unauthorized = 1;
      await store(mock).probe();
      assert.strictEqual(mock.tokenCalls(), 2);
      mock.modes.unauthorized = 20;
      await rejectsCode(() => store(mock).probe(), 'DRIVE_AUTH_REQUIRED');
      assert.strictEqual(mock.tokenCalls(), 4);
    });
    await check('authorization failure and network errors never echo provider bodies or tokens', async () => {
      const mock = mockDrive();
      mock.modes.authError = true;
      await rejectsCode(() => store(mock).probe(), 'DRIVE_AUTH_REQUIRED');
      mock.modes.authError = false;
      mock.modes.network = true;
      await assert.rejects(() => store(mock).probe(), error => {
        assert.strictEqual(error.code, 'DRIVE_NETWORK');
        assert.ok(!String(error.stack).includes('fake-'));
        assert.strictEqual(error.cause, undefined);
        return true;
      });
    });
    await check('timeouts abort and have bounded attempts', async () => {
      let attempts = 0;
      const client = store(mockDrive(), { config: { ...config, timeoutMs: 10, attempts: 2 }, fetch: async (_, init) => {
        attempts += 1;
        return new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(new Error('secret'))));
      } });
      await rejectsCode(() => client.probe(), 'DRIVE_NETWORK');
      assert.strictEqual(attempts, 2);
    });
    await check('transient rate limits back off; permission and quota failures do not retry', async () => {
      for (const [status, reason, expected, attempts] of [[429, 'rateLimitExceeded', null, 2], [403, 'userRateLimitExceeded', null, 2], [503, 'backendError', null, 2], [403, 'insufficientFilePermissions', 'DRIVE_FORBIDDEN', 1], [403, 'storageQuotaExceeded', 'DRIVE_QUOTA_EXCEEDED', 1], [302, 'other', 'DRIVE_REDIRECT_REJECTED', 1]]) {
        const mock = mockDrive();
        Object.assign(mock.modes, { httpStatus: status, httpCount: 1, reason });
        const pauses = [];
        const client = store(mock, { sleep: async ms => pauses.push(ms) });
        if (expected) await rejectsCode(() => client.probe(), expected); else await client.probe();
        assert.strictEqual(mock.calls.filter(call => call.url.pathname === '/drive/v3/files/folder').length, attempts);
        assert.strictEqual(pauses.length, attempts - 1);
      }
    });
    await check('Retry-After is respected without unbounded waits', async () => {
      const mock = mockDrive();
      Object.assign(mock.modes, { httpStatus: 429, httpCount: 1, retryAfter: '999999' });
      const pauses = [];
      await store(mock, { sleep: async ms => pauses.push(ms) }).probe();
      assert.deepStrictEqual(pauses, [60000]);
    });
    await check('chunked upload, partial acknowledgement, dropped response and metadata verification', async () => {
      const mock = mockDrive();
      Object.assign(mock.modes, { partialAck: true, dropAfterAccept: true, pagination: true });
      const client = store(mock);
      const result = await client.putFile(source);
      assert.strictEqual(result.size, bytes.length);
      assert.strictEqual(result.cached, false);
      assert.deepStrictEqual(mock.files.get(result.fileId).bytes, bytes);
      assert.ok(mock.calls.some(call => call.range?.startsWith('bytes 262144-')));
      const repeat = await store(mock).putFile(source);
      assert.strictEqual(repeat.cached, true);
      assert.strictEqual(repeat.fileId, result.fileId);
      assert.strictEqual(mock.files.size, 1);
      assert.strictEqual(mock.calls.filter(call => call.url.pathname === '/drive/v3/files/generateIds').length, 1);
    });
    await check('a new store resumes the persisted session without creating another remote ID', async () => {
      const mock = mockDrive();
      Object.assign(mock.modes, { partialAck: true, dropAfterAccept: true, queryFailure: true });
      await rejectsCode(() => store(mock).putFile(source), 'DRIVE_NETWORK');
      assert.strictEqual([...mock.sessions.values()][0].bytes.length, 262144);
      mock.modes.queryFailure = false;
      const result = await store(mock).putFile(source);
      assert.deepStrictEqual(mock.files.get(result.fileId).bytes, bytes);
      assert.strictEqual(mock.calls.filter(call => call.url.pathname === '/drive/v3/files/generateIds').length, 1);
      assert.strictEqual(mock.calls.filter(call => call.method === 'POST' && call.url.pathname === '/upload/drive/v3/files').length, 1);
      const journals = fs.readdirSync(paths.driveTransfersDir).filter(file => file.endsWith('.json'));
      assert.ok(journals.length);
      const journal = fs.readFileSync(path.join(paths.driveTransfersDir, journals[0]), 'utf8');
      assert.ok(!journal.includes('fake-refresh-token') && !journal.includes('fake-access-token'));
      if (process.platform !== 'win32') assert.strictEqual(fs.statSync(path.join(paths.driveTransfersDir, journals[0])).mode & 0o777, 0o600);
    });
    await check('a lost final response is recovered from server status, without another file', async () => {
      const file = path.join(root, 'last-response.zip'); fs.writeFileSync(file, 'last response fixture');
      const mock = mockDrive(); mock.modes.dropAfterAccept = true;
      const result = await store(mock).putFile(file);
      assert.strictEqual(mock.files.size, 1);
      assert.deepStrictEqual(mock.files.get(result.fileId).bytes, fs.readFileSync(file));
      assert.strictEqual(mock.calls.filter(call => call.method === 'POST' && call.url.pathname === '/upload/drive/v3/files').length, 1);
    });
    await check('ambiguous creation retries use the same ID and verify a 409 conflict', async () => {
      const file = path.join(root, 'creation.zip'); fs.writeFileSync(file, 'creation fixture');
      const mock = mockDrive();
      Object.assign(mock.modes, { ambiguousInitiation: true, cannedBytes: fs.readFileSync(file) });
      const result = await store(mock).putFile(file);
      assert.strictEqual(mock.files.size, 1);
      assert.strictEqual(mock.calls.filter(call => call.url.pathname === '/drive/v3/files/generateIds').length, 1);
      assert.deepStrictEqual(mock.files.get(result.fileId).bytes, fs.readFileSync(file));
    });
    await check('expired sessions reinitiate with the same generated ID', async () => {
      // Use separate blob contents so the existing journal cannot refer to another mock account.
      const file = path.join(root, 'expired.zip'); fs.writeFileSync(file, 'expired session fixture');
      const mock = mockDrive(); mock.modes.expired = true;
      const result = await store(mock).putFile(file);
      assert.ok(mock.files.has(result.fileId));
      assert.strictEqual(mock.calls.filter(call => call.url.pathname === '/drive/v3/files/generateIds').length, 1);
      assert.strictEqual(mock.calls.filter(call => call.method === 'POST' && call.url.pathname === '/upload/drive/v3/files').length, 2);
    });
    await check('stalled uploads stop and keep the durable journal', async () => {
      const file = path.join(root, 'stalled.zip'); fs.writeFileSync(file, 'stalled fixture');
      const mock = mockDrive(); mock.modes.stalled = true;
      await rejectsCode(() => store(mock).putFile(file), 'DRIVE_UPLOAD_STALLED');
      assert.strictEqual(mock.calls.filter(call => call.range?.startsWith('bytes 0-')).length, config.attempts);
    });
    await check('unsafe upload URLs are never followed with bearer credentials', async () => {
      const file = path.join(root, 'redirect.zip'); fs.writeFileSync(file, 'redirect fixture');
      const mock = mockDrive(); mock.modes.unsafeLocation = 'https://attacker.invalid/upload?secret=1';
      await rejectsCode(() => store(mock).putFile(file), 'DRIVE_INVALID_SESSION');
      assert.ok(mock.calls.every(call => ['www.googleapis.com', 'oauth2.googleapis.com'].includes(call.url.hostname)));
    });
    await check('corrupt journals are retained and never silently reset', async () => {
      const file = path.join(root, 'journal.zip'); fs.writeFileSync(file, 'journal fixture');
      const hash = await fingerprint(file);
      const key = crypto.createHash('sha256').update('folder:' + hash.sha256).digest('hex');
      fs.mkdirSync(paths.driveTransfersDir, { recursive: true });
      fs.writeFileSync(paths.driveTransferFile(key), '{broken');
      const mock = mockDrive();
      await rejectsCode(() => store(mock).putFile(file), 'STORAGE_CORRUPT');
      assert.strictEqual(fs.readFileSync(paths.driveTransferFile(key), 'utf8'), '{broken');
      assert.strictEqual(mock.files.size, 0);
      assert.ok(!mock.calls.some(call => call.method === 'POST' && call.url.pathname === '/upload/drive/v3/files'));
    });
    await check('quota preflight and permissions stop before upload; lookup must be complete', async () => {
      for (const [mode, code] of [[{ limit: '1' }, 'DRIVE_QUOTA_EXCEEDED'], [{ writable: false }, 'DRIVE_FORBIDDEN'], [{ incompleteSearch: true }, 'DRIVE_INCOMPLETE_SEARCH']]) {
        const mock = mockDrive(); Object.assign(mock.modes, mode);
        await rejectsCode(() => store(mock).putFile(source), code);
        assert.ok(!mock.calls.some(call => call.url.pathname === '/upload/drive/v3/files'));
      }
    });
    await check('checksum mismatch is not reported as uploaded', async () => {
      const file = path.join(root, 'bad-hash.zip'); fs.writeFileSync(file, 'bad hash fixture');
      const mock = mockDrive(); mock.modes.badUploadHash = true;
      await rejectsCode(() => store(mock).putFile(file), 'DRIVE_INTEGRITY');
      assert.strictEqual(mock.files.size, 1, 'do not delete a suspicious remote object automatically');
      assert.strictEqual(fs.readFileSync(file, 'utf8'), 'bad hash fixture');
    });
    await check('changed remote objects are not reused or overwritten', async () => {
      const file = path.join(root, 'remote-change.zip'); fs.writeFileSync(file, 'remote change fixture');
      const mock = mockDrive();
      const result = await store(mock).putFile(file);
      mock.files.get(result.fileId).metadata.md5Checksum = '0'.repeat(32);
      await rejectsCode(() => store(mock).putFile(file), 'DRIVE_INTEGRITY');
      assert.strictEqual(mock.files.size, 1);
      assert.deepStrictEqual(mock.files.get(result.fileId).bytes, fs.readFileSync(file));
    });
    await check('restore verifies bytes, retries truncation, caches only verified files and never overwrites', async () => {
      const mock = mockDrive();
      const file = path.join(root, 'restore-source.zip'); fs.writeFileSync(file, 'restore fixture');
      const object = await store(mock).putFile(file);
      const target = path.join(root, 'restored.zip');
      mock.modes.shortDownloads = 1;
      const restored = await store(mock).getFile(object, target);
      assert.strictEqual(restored.cached, false);
      assert.deepStrictEqual(fs.readFileSync(target), fs.readFileSync(file));
      const before = mock.calls.length;
      assert.strictEqual((await store(mock).getFile(object, target)).cached, true);
      assert.strictEqual(mock.calls.length, before, 'verified local bytes need no download');
      fs.writeFileSync(target, 'user contents');
      await rejectsCode(() => store(mock).getFile(object, target), 'DRIVE_DESTINATION_EXISTS');
      assert.strictEqual(fs.readFileSync(target, 'utf8'), 'user contents');
      mock.modes.badDownload = true;
      const broken = path.join(root, 'bad-restore.zip');
      await rejectsCode(() => store(mock).getFile(object, broken), 'DRIVE_INTEGRITY');
      assert.ok(!fs.existsSync(broken));
      assert.ok(!fs.readdirSync(root).some(name => name.endsWith('.partial')));
    });
    await check('raced-in destinations and invalid descriptors are preserved/rejected', async () => {
      const mock = mockDrive();
      const file = path.join(root, 'race-source.zip'); fs.writeFileSync(file, 'race fixture');
      const object = await store(mock).putFile(file);
      const target = path.join(root, 'raced.zip');
      mock.modes.raceDestination = target;
      await assert.rejects(() => store(mock).getFile(object, target), { code: 'EEXIST' });
      assert.strictEqual(fs.readFileSync(target, 'utf8'), 'raced-in-user-file');
      await rejectsCode(() => store(mock).getFile({ ...object, fileId: '../escape' }, target), 'DRIVE_INVALID_ID');
      await rejectsCode(() => store(mock).getFile({ ...object, size: -1 }, target), 'DRIVE_INVALID_OBJECT');
      await rejectsCode(() => store(mock).getFile({ ...object, sha256: 'invalid' }, target), 'DRIVE_INVALID_OBJECT');
      if (process.platform !== 'win32') {
        const link = path.join(root, 'link.zip'); fs.symlinkSync(file, link);
        await rejectsCode(() => fingerprint(link), 'DRIVE_INVALID_SOURCE');
      }
    });
    console.log('google drive store test passed (' + checks + ' scenarios; mock HTTP, not live Google Drive)');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
}

if (require.main === module) run().catch(error => { console.error(error); process.exitCode = 1; });
module.exports = run;
