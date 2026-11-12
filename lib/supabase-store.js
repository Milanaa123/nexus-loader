const fs = require('fs');
const crypto = require('crypto');
const paths = require('../config/paths');
const { cloudConfig } = require('../config/cloud');
const { digestFile } = require('./file-integrity');
const { mergeJobs, patchJob, validDocument } = require('./job-queue');

const FIELDS = ['originalFile', 'translationFile', 'outputFile'];
const SHA = /^[a-f0-9]{64}$/;
function error(code, message, statusCode = 503) { return Object.assign(new Error(message), { code, statusCode }); }
function localize(row) {
  const result = structuredClone(row);
  for (const field of FIELDS) {
    const asset = result.remoteAssets?.[field];
    if (!asset) continue;
    result[field] = paths.cloudAssetPath(asset.area, asset.name);
    const download = field === 'originalFile' ? 'originalDownload' : field === 'translationFile' ? 'translationDownload' : null;
    if (download && result[download]) result[download].path = result[field];
  }
  return result;
}
function createSupabaseStore(options = {}) {
  const config = options.config || cloudConfig();
  const transport = options.fetch || globalThis.fetch;
  const sleep = options.sleep || (ms => new Promise(resolve => setTimeout(resolve, ms)));
  let lease = null;
  async function request(route, method = 'GET', body = undefined, binary = false) {
    for (let attempt = 0; attempt < config.attempts; attempt += 1) {
      try {
        const res = await transport(config.url + route, {
          method, redirect: 'manual', signal: AbortSignal.timeout(config.timeoutMs),
          headers: { Authorization: 'Bearer ' + config.token, 'Content-Type': body instanceof Uint8Array ? 'application/octet-stream' : 'application/json' },
          body: body === undefined ? undefined : body instanceof Uint8Array ? body : JSON.stringify(body)
        });
        if (!res.ok) {
          await res.body?.cancel();
          if (res.status === 409) throw error('STORAGE_CONFLICT', 'Storage revision changed', 409);
          if (res.status === 423) throw error('WORKER_BUSY', 'Cloud worker lease is busy or was lost', 423);
          if (res.status === 401 || res.status === 403) throw error('STORAGE_AUTH', 'Cloud storage authorization failed');
          if (res.status === 507) throw error('STORAGE_QUOTA', 'Free storage safety budget reached; no data deleted and no paid upgrade requested', 507);
          const failure = error('STORAGE_HTTP', 'Cloud storage request rejected');
          failure.retryable = [429, 500, 502, 503, 504].includes(res.status);
          throw failure;
        }
        // Body reads are part of the timed request. Never return a truncated successful JSON.
        return binary ? Buffer.from(await res.arrayBuffer()) : await res.json();
      } catch (failure) {
        const known = failure.code?.startsWith('STORAGE_') || failure.code === 'WORKER_BUSY';
        const retryable = known ? failure.retryable : true;
        if (!retryable || attempt + 1 === config.attempts) throw known ? failure : error('STORAGE_NETWORK', 'Cloud storage transfer failed or timed out');
        await sleep(250 * 2 ** attempt);
      }
    }
  }
  function validate(name, value) {
    const valid = name === 'queue' ? validDocument(value) : ['results', 'processed', 'errors'].includes(name) ? Array.isArray(value) : value !== null && typeof value === 'object' && !Array.isArray(value);
    if (!valid) throw error('STORAGE_CORRUPT', 'Cloud document has an invalid shape: ' + name);
    return value;
  }
  async function read(name) {
    const doc = await request('/documents/' + name);
    if (doc.name !== name || !Number.isSafeInteger(doc.revision) || doc.revision < 0) throw error('STORAGE_CORRUPT', 'Invalid cloud document revision');
    validate(name, doc.value);
    return doc;
  }
  async function update(name, transform) {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const doc = await read(name);
      const draft = structuredClone(doc.value);
      const result = transform(draft);
      validate(name, draft);
      const body = { revision: doc.revision, value: draft, mutation: crypto.randomUUID(), ...(lease ? { owner: lease.owner, fence: lease.fence } : {}) };
      try { await request('/documents/' + name, 'PUT', body); return result; }
      catch (failure) {
        if (failure.code !== 'STORAGE_CONFLICT') throw failure;
        await sleep(20 + attempt * 10);
      }
    }
    throw error('STORAGE_CONFLICT', 'Cloud storage is busy; retry the operation');
  }
  async function replace(name, value) {
    validate(name, value);
    await update(name, draft => {
      if (Array.isArray(draft)) { draft.length = 0; for (const row of value) draft.push(row); }
      else { for (const key of Object.keys(draft)) delete draft[key]; Object.assign(draft, value); }
    });
    return value;
  }
  async function acquireLock() {
    if (lease) throw error('WORKER_BUSY', 'This cloud store already owns a worker lease', 423);
    const owner = crypto.randomUUID();
    lease = await request('/lease', 'POST', { action: 'claim', owner });
    const held = { owner, fence: lease.fence };
    return {
      token: owner,
      async touch() { await request('/lease', 'POST', { action: 'touch', ...held }); },
      async release() {
        try { await request('/lease', 'POST', { action: 'release', ...held }); }
        catch (failure) { if (failure.code !== 'WORKER_BUSY') throw failure; }
        finally { if (lease?.owner === owner) lease = null; }
      }
    };
  }
  async function uploadFile(file) {
    const reference = paths.cloudAssetReference(file);
    const info = await fs.promises.lstat(file);
    if (!info.isFile() || info.size <= 0 || info.size > config.maxFileBytes) throw error('STORAGE_ARTIFACT', 'Archive is missing, empty, unsafe or exceeds the storage budget');
    const chunks = [];
    const hash = crypto.createHash('sha256');
    const handle = await fs.promises.open(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
    try {
      let position = 0;
      while (position < info.size) {
        const chunk = Buffer.alloc(Math.min(config.chunkBytes, info.size - position));
        let offset = 0;
        while (offset < chunk.length) {
          const { bytesRead } = await handle.read(chunk, offset, chunk.length - offset, position + offset);
          if (!bytesRead) throw error('STORAGE_ARTIFACT', 'Archive changed during upload');
          offset += bytesRead;
        }
        hash.update(chunk);
        const sha256 = crypto.createHash('sha256').update(chunk).digest('hex');
        await request('/chunks/' + sha256, 'PUT', chunk);
        chunks.push({ sha256, size: chunk.length });
        position += chunk.length;
      }
    } finally { await handle.close(); }
    const after = await fs.promises.lstat(file);
    if (!after.isFile() || after.size !== info.size || after.mtimeMs !== info.mtimeMs || after.ino !== info.ino) throw error('STORAGE_ARTIFACT', 'Archive changed during upload');
    return { ...reference, sha256: hash.digest('hex'), size: info.size, chunks };
  }
  async function restoreFile(asset, options = {}) {
    if (!asset || !SHA.test(asset.sha256 || '') || !Number.isSafeInteger(asset.size) || asset.size <= 0 || asset.size > config.maxFileBytes || !Array.isArray(asset.chunks) || !asset.chunks.length || asset.chunks.length > Math.ceil(config.maxFileBytes / config.chunkBytes)) throw error('STORAGE_CORRUPT', 'Invalid cloud archive descriptor');
    if (asset.chunks.some(chunk => !SHA.test(chunk.sha256 || '') || !Number.isSafeInteger(chunk.size) || chunk.size <= 0 || chunk.size > config.chunkBytes) || asset.chunks.reduce((sum, chunk) => sum + chunk.size, 0) !== asset.size) throw error('STORAGE_CORRUPT', 'Invalid cloud archive chunks');
    const target = paths.cloudAssetPath(asset.area, asset.name);
    // Validate parents before reading or quarantining an existing cache entry too.
    const parents = paths.cloudAssetDirectories(asset.area, asset.name);
    await fs.promises.mkdir(parents.root, { recursive: true });
    for (const parent of [parents.root, ...parents.directories]) {
      if (parent !== parents.root) {
        try { await fs.promises.mkdir(parent); } catch (failure) { if (failure.code !== 'EEXIST') throw failure; }
      }
      const stat = await fs.promises.lstat(parent);
      if (!stat.isDirectory() || stat.isSymbolicLink()) throw error('STORAGE_PATH', 'Cloud archive parent is not a safe directory');
    }
    try {
      const stat = await fs.promises.lstat(target);
      if (stat.isFile() && stat.size === asset.size && await digestFile(target) === asset.sha256) return target;
      if (!options.repair || !stat.isFile()) throw error('STORAGE_ARTIFACT_EXISTS', 'Existing archive failed checksum verification; preserved for inspection');
      const preserved = paths.cacheQuarantineFile(target, crypto.randomUUID());
      await fs.promises.rename(target, preserved);
      await state.appendLog('warn', 'Corrupt local archive preserved before restoring the verified cloud copy', { file: preserved });
    } catch (failure) { if (failure.code !== 'ENOENT') throw failure; }
    const { directory, partial } = paths.restorePaths(target, crypto.randomUUID());
    const handle = await fs.promises.open(partial, 'wx', 0o600);
    const hash = crypto.createHash('sha256');
    try {
      try {
        for (const chunk of asset.chunks) {
          const bytes = await request('/chunks/' + chunk.sha256, 'GET', undefined, true);
          if (bytes.length !== chunk.size || crypto.createHash('sha256').update(bytes).digest('hex') !== chunk.sha256) throw error('STORAGE_INTEGRITY', 'Cloud archive chunk failed verification');
          hash.update(bytes);
          await handle.writeFile(bytes);
        }
        if (hash.digest('hex') !== asset.sha256) throw error('STORAGE_INTEGRITY', 'Cloud archive failed SHA-256 verification');
        await handle.sync();
      } finally { await handle.close(); }
      await fs.promises.link(partial, target);
      if (process.platform !== 'win32') {
        const parent = await fs.promises.open(directory, 'r');
        try { await parent.sync(); } finally { await parent.close(); }
      }
      return target;
    } finally { await fs.promises.unlink(partial); }
  }
  async function prepareResults(rows) {
    for (const row of rows) {
      row.remoteAssets = { ...row.remoteAssets };
      for (const field of FIELDS) {
        if (!row[field]) continue;
        const known = row.remoteAssets[field];
        const expected = field === 'outputFile' ? row.sha256 : row[field === 'originalFile' ? 'originalDownload' : 'translationDownload']?.sha256;
        if (known && row[field] === paths.cloudAssetPath(known.area, known.name) && (!expected || expected === known.sha256)) continue;
        const uploaded = await uploadFile(row[field]);
        if (expected && uploaded.sha256 !== expected) throw error('STORAGE_INTEGRITY', 'Archive changed before its cloud checkpoint');
        row.remoteAssets[field] = uploaded;
      }
    }
    return rows;
  }
  async function hydrateResult(row) {
    for (const field of FIELDS) if (row?.remoteAssets?.[field]) await restoreFile(row.remoteAssets[field], { repair: true });
    return row;
  }
  const queue = {
    async loadDocument() { return (await read('queue')).value; },
    async load() { return (await queue.loadDocument()).items; },
    async addJobs(mods, provider = 'nexus') { return update('queue', doc => { const result = mergeJobs(doc, mods, provider); doc.updatedAt = new Date().toISOString(); return result; }); },
    async updateJob(key, patch) { return update('queue', doc => patchJob(doc, key, patch)); },
    async stats() { const items = await queue.load(); const statuses = {}; for (const job of items) statuses[job.status || 'queued'] = (statuses[job.status || 'queued'] || 0) + 1; return { total: items.length, statuses }; }
  };
  const state = {
    getProgress: async () => (await read('progress')).value,
    saveProgress: value => replace('progress', value),
    getProcessed: async () => (await read('processed')).value.map(localize),
    saveProcessed: value => replace('processed', value),
    getResults: async () => (await read('results')).value.map(localize),
    saveResults: async value => replace('results', await prepareResults(value)),
    getErrors: async () => (await read('errors')).value,
    saveErrors: value => replace('errors', value),
    appendError: (failure, details = {}) => update('errors', rows => rows.push({ ...details, message: failure.message, code: failure.code || null, date: new Date().toISOString() })),
    appendLog: (level, message, details = {}) => request('/events', 'POST', { ...details, level, message, at: new Date().toISOString() })
  };
  return { queue, state, acquireLock, hydrateResult, uploadFile, restoreFile, request, read, update, health: () => request('/health') };
}
module.exports = { createSupabaseStore, localize };
