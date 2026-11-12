const fs = require('fs');
const crypto = require('crypto');
const paths = require('../config/paths');
const { getDriveConfig } = require('../config/storage');
const { readJson, writeJson } = require('./file-store');
const { acquireWorkerLock } = require('./worker-lock');

const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';
const TOKEN = 'https://oauth2.googleapis.com/token';
const MARKER = 'blob-v1';
const FIELDS = 'id,size,md5Checksum,sha256Checksum,appProperties,parents,trashed,mimeType';
const ID = /^[A-Za-z0-9_-]{1,200}$/;
const SHA = /^[a-f0-9]{64}$/;

function fail(code, message, retryable = false, statusCode = undefined) {
  const error = new Error(message);
  Object.assign(error, { code, retryable, statusCode });
  return error;
}
function fileId(value) {
  if (typeof value !== 'string' || !ID.test(value)) throw fail('DRIVE_INVALID_ID', 'Invalid Google Drive file ID');
  return value;
}
function sessionUrl(value) {
  let url;
  try { url = new URL(value); } catch (_) { throw fail('DRIVE_INVALID_SESSION', 'Invalid Drive upload session'); }
  if (url.origin !== 'https://www.googleapis.com' || url.pathname !== '/upload/drive/v3/files' || url.username || url.password || url.hash) {
    throw fail('DRIVE_INVALID_SESSION', 'Untrusted Drive upload session rejected');
  }
  return url.href;
}
async function fingerprint(file) {
  const before = await fs.promises.lstat(file);
  if (!before.isFile()) throw fail('DRIVE_INVALID_SOURCE', 'Upload source must be a regular file, not a symlink');
  const sha256 = crypto.createHash('sha256');
  const md5 = crypto.createHash('md5');
  let size = 0;
  for await (const chunk of fs.createReadStream(file)) { sha256.update(chunk); md5.update(chunk); size += chunk.length; }
  const after = await fs.promises.lstat(file);
  if (before.size !== size || after.size !== size || before.mtimeMs !== after.mtimeMs || before.ino !== after.ino || !after.isFile()) {
    throw fail('DRIVE_SOURCE_CHANGED', 'Upload source changed while being hashed');
  }
  return { size, sha256: sha256.digest('hex'), md5: md5.digest('hex') };
}
function validObject(metadata, expected, folderId) {
  return metadata && ID.test(metadata.id || '') && metadata.trashed === false &&
    metadata.parents?.includes(folderId) && metadata.appProperties?.nexusLoader === MARKER &&
    metadata.appProperties?.sha256 === expected.sha256 && String(metadata.size) === String(expected.size) &&
    /^[a-f0-9]{32}$/.test(metadata.md5Checksum || '') &&
    (!expected.md5 || metadata.md5Checksum === expected.md5) &&
    (!metadata.sha256Checksum || metadata.sha256Checksum === expected.sha256);
}

// An immutable blob transport, not a distributed queue or automatic workspace mirror.
function createDriveStore(options = {}) {
  const config = options.config || getDriveConfig();
  fileId(config.folderId);
  if (!Number.isSafeInteger(config.chunkBytes) || config.chunkBytes < 262144 || config.chunkBytes > 8388608 || config.chunkBytes % 262144) {
    throw fail('DRIVE_INVALID_CONFIG', 'Drive chunks must be multiples of 256 KiB, at most 8 MiB');
  }
  const transport = options.fetch || globalThis.fetch;
  const sleep = options.sleep || (ms => new Promise(resolve => setTimeout(resolve, ms)));
  const now = options.now || Date.now;
  const random = options.random || Math.random;
  let token = null;
  let refreshing = null;

  async function wire(url, init = {}, consume = async response => response) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.timeoutMs);
    try {
      const response = await transport(url, { ...init, redirect: 'manual', signal: controller.signal });
      return await consume(response);
    } catch (error) {
      if (error.code?.startsWith('DRIVE_')) throw error;
      if (['ENOSPC', 'EROFS', 'EACCES', 'EPERM', 'EIO', 'EMFILE'].includes(error.code)) {
        throw fail('DRIVE_LOCAL_IO', 'Local disk operation failed during Google Drive transfer');
      }
      // Provider/transport errors can include tokens and session URLs. Do not attach causes or raw bodies.
      throw fail('DRIVE_NETWORK', 'Google Drive request failed or timed out', true);
    } finally { clearTimeout(timer); }
  }

  async function httpError(response) {
    const payload = await response.json().catch(() => null);
    const reasons = payload?.error?.errors?.map(error => error.reason) || [];
    let code = 'DRIVE_HTTP';
    let message = 'Google Drive request rejected';
    let retryable = response.status === 429 || [500, 502, 503, 504].includes(response.status);
    if (response.status === 401) { code = 'DRIVE_AUTH_REQUIRED'; message = 'Google Drive authorization must be renewed'; }
    if (response.status === 404) { code = 'DRIVE_NOT_FOUND'; message = 'Google Drive file is missing or not accessible to this app'; }
    if (response.status === 403) {
      code = 'DRIVE_FORBIDDEN'; message = 'Google Drive access denied';
      if (reasons.some(reason => ['rateLimitExceeded', 'userRateLimitExceeded'].includes(reason))) {
        code = 'DRIVE_RATE_LIMIT'; message = 'Google Drive rate limit reached'; retryable = true;
      }
      if (reasons.includes('storageQuotaExceeded')) {
        code = 'DRIVE_QUOTA_EXCEEDED'; message = 'Google Drive storage is full; no files were deleted and no paid upgrade was requested'; retryable = false;
      }
    }
    if (response.status >= 300 && response.status < 400) { code = 'DRIVE_REDIRECT_REJECTED'; message = 'Unexpected Google Drive redirect rejected'; }
    const error = fail(code, message, retryable, response.status);
    const seconds = Number(response.headers.get('retry-after'));
    if (Number.isFinite(seconds) && seconds > 0) error.retryAfterMs = Math.min(seconds * 1000, 60000);
    return error;
  }

  async function retry(operation) {
    for (let attempt = 0; attempt < config.attempts; attempt += 1) {
      try { return await operation(); }
      catch (error) {
        if (!error.retryable || attempt + 1 === config.attempts) throw error;
        await sleep(Math.max(error.retryAfterMs || 0, Math.min(32000, 1000 * 2 ** attempt + Math.floor(random() * 500))));
      }
    }
  }

  async function accessToken() {
    if (token && token.expiresAt > now() + 30000) return token.value;
    // Callers own the retry budget; nesting another retry loop here would multiply attempts.
    if (!refreshing) refreshing = wire(TOKEN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, refresh_token: config.refreshToken, grant_type: 'refresh_token' }).toString()
    }, async response => {
      if (!response.ok) {
        if (response.status === 400 || response.status === 401) throw fail('DRIVE_AUTH_REQUIRED', 'Google Drive authorization must be renewed');
        throw await httpError(response);
      }
      const data = await response.json().catch(() => null);
      if (typeof data?.access_token !== 'string' || !data.access_token || !Number.isFinite(data.expires_in) || data.expires_in <= 0) {
        throw fail('DRIVE_AUTH_INVALID', 'Google returned an invalid token response');
      }
      token = { value: data.access_token, expiresAt: now() + data.expires_in * 1000 };
      return token.value;
    }).finally(() => { refreshing = null; });
    return refreshing;
  }

  async function authorized(url, init, consume, allow = []) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const usedToken = await accessToken();
      const response = await wire(url, { ...init, headers: { ...init?.headers, Authorization: 'Bearer ' + usedToken } }, async response => {
        if (response.status === 401 && attempt === 0) { await response.body?.cancel(); return null; }
        if (!response.ok && !allow.includes(response.status)) throw await httpError(response);
        return { value: await consume(response) };
      });
      if (response) return response.value;
      if (token?.value === usedToken) token = null;
    }
  }
  const json = (url, init = {}) => retry(() => authorized(url, init, async response => {
    try { return await response.json(); } catch (_) { throw fail('DRIVE_INVALID_RESPONSE', 'Google Drive returned invalid JSON'); }
  }));
  const metadata = id => json(API + '/files/' + fileId(id) + '?' + new URLSearchParams({ fields: FIELDS, supportsAllDrives: 'true' }));

  async function probe() {
    const folder = await json(API + '/files/' + config.folderId + '?' + new URLSearchParams({ fields: 'id,mimeType,trashed,capabilities(canAddChildren)', supportsAllDrives: 'true' }));
    if (folder.mimeType !== 'application/vnd.google-apps.folder' || folder.trashed !== false) {
      throw fail('DRIVE_INVALID_FOLDER', 'Configured Google Drive destination is not an available folder');
    }
    if (folder.capabilities?.canAddChildren !== true) throw fail('DRIVE_FORBIDDEN', 'Google Drive destination folder is not writable');
    const about = await json(API + '/about?fields=storageQuota');
    const quota = about.storageQuota || {};
    let remaining = null;
    if (/^\d+$/.test(quota.limit || '') && /^\d+$/.test(quota.usage || '')) {
      const bytes = BigInt(quota.limit) - BigInt(quota.usage);
      remaining = (bytes > 0n ? bytes : 0n).toString();
    }
    return { ok: true, provider: 'google-drive', folderWritable: true, quota: { limit: quota.limit || null, usage: quota.usage || null, remaining }, runtimeIntegration: false };
  }

  async function findObjects(sha256) {
    const matches = [];
    const seen = new Set();
    let pageToken = '';
    do {
      const params = new URLSearchParams({
        q: "'" + config.folderId + "' in parents and trashed = false and appProperties has { key='nexusLoader' and value='" + MARKER + "' } and appProperties has { key='sha256' and value='" + sha256 + "' }",
        fields: 'nextPageToken,incompleteSearch,files(' + FIELDS + ')', pageSize: '100', spaces: 'drive', pageToken,
        supportsAllDrives: 'true', includeItemsFromAllDrives: 'true'
      });
      const data = await json(API + '/files?' + params);
      if (!Array.isArray(data.files) || data.incompleteSearch) throw fail('DRIVE_INCOMPLETE_SEARCH', 'Drive object lookup was incomplete; no upload started');
      matches.push(...data.files);
      pageToken = data.nextPageToken || '';
      if (pageToken && (seen.has(pageToken) || seen.size >= 100)) throw fail('DRIVE_INVALID_RESPONSE', 'Drive object pagination did not finish');
      seen.add(pageToken);
    } while (pageToken);
    return matches;
  }

  function offset(response, total) {
    const range = response.headers.get('range');
    if (!range) return 0;
    const match = /^bytes=0-(\d+)$/.exec(range);
    const received = match ? Number(match[1]) + 1 : NaN;
    if (!Number.isSafeInteger(received) || received < 0 || received > total) throw fail('DRIVE_INVALID_RESPONSE', 'Drive returned an invalid upload offset');
    return received;
  }

  async function putFile(file) {
    const hash = await fingerprint(file);
    if (hash.size > config.maxFileBytes) throw fail('DRIVE_FILE_TOO_LARGE', 'File exceeds the configured Drive upload limit');
    if (!hash.size) throw fail('DRIVE_EMPTY_FILE', 'Empty files are not accepted as archive/state blobs');
    const key = crypto.createHash('sha256').update(config.folderId + ':' + hash.sha256).digest('hex');
    const journalFile = paths.driveTransferFile(key);
    const lease = acquireWorkerLock({ file: paths.driveTransferLockFile(key) });
    const descriptor = value => ({ fileId: value.id, sha256: hash.sha256, md5: hash.md5, size: hash.size });
    try {
      const existing = (await findObjects(hash.sha256)).find(value => validObject(value, hash, config.folderId));
      if (existing) return { ...descriptor(existing), cached: true };
      const preflight = await probe();
      if (preflight.quota.remaining !== null && BigInt(preflight.quota.remaining) < BigInt(hash.size)) {
        throw fail('DRIVE_QUOTA_EXCEEDED', 'Insufficient Google Drive space; no paid upgrade was requested');
      }
      let journal = readJson(journalFile, null, value => value?.version === 1 && ID.test(value.id || '') &&
        value.folderId === config.folderId && value.sha256 === hash.sha256 && value.md5 === hash.md5 && value.size === hash.size &&
        (value.session === null || typeof value.session === 'string'));
      if (!journal) {
        const generated = await json(API + '/files/generateIds?count=1&space=drive&type=files');
        journal = { version: 1, id: fileId(generated.ids?.[0]), folderId: config.folderId, ...hash, session: null };
        writeJson(journalFile, journal);
      }
      async function existingById() {
        try {
          const remote = await metadata(journal.id);
          if (!validObject(remote, hash, config.folderId)) throw fail('DRIVE_INTEGRITY', 'Existing Drive object failed checksum verification; preserved for inspection');
          return remote;
        } catch (error) { if (error.code === 'DRIVE_NOT_FOUND') return null; throw error; }
      }
      async function initiate() {
        const remote = await existingById();
        if (remote) return remote;
        const body = JSON.stringify({ id: journal.id, name: hash.sha256 + '.blob', parents: [config.folderId], mimeType: 'application/octet-stream', appProperties: { nexusLoader: MARKER, sha256: hash.sha256 } });
        try {
          journal.session = await retry(() => authorized(UPLOAD + '?uploadType=resumable&supportsAllDrives=true&fields=' + encodeURIComponent(FIELDS), {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Upload-Content-Type': 'application/octet-stream', 'X-Upload-Content-Length': String(hash.size) }, body
          }, async response => sessionUrl(response.headers.get('location'))));
          writeJson(journalFile, journal);
          return null;
        } catch (error) {
          if (error.statusCode !== 409) throw error;
          const completed = await existingById();
          if (!completed) throw error;
          return completed;
        }
      }
      async function uploadRequest(body, range) {
        return authorized(sessionUrl(journal.session), { method: 'PUT', headers: { 'Content-Length': String(body.length), 'Content-Range': range, 'Content-Type': 'application/octet-stream' }, body }, async response => {
          if (response.status === 404) { await response.body?.cancel(); return { expired: true }; }
          if (response.status === 308) { await response.body?.cancel(); return { offset: offset(response, hash.size) }; }
          // The final response is not authoritative until a separate metadata read verifies the object.
          await response.body?.cancel();
          return { completed: true };
        }, [308, 404]);
      }
      let complete = journal.session ? null : await initiate();
      let position = 0;
      let failures = 0;
      let queryStatus = Boolean(journal.session);
      const source = await fs.promises.open(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
      try {
        while (!complete) {
          lease.touch();
          let result;
          try {
            if (queryStatus) result = await uploadRequest(Buffer.alloc(0), 'bytes */' + hash.size);
            else {
              const length = Math.min(config.chunkBytes, hash.size - position);
              if (length <= 0) throw fail('DRIVE_INVALID_RESPONSE', 'Drive acknowledged all bytes without completing the upload');
              const chunk = Buffer.alloc(length);
              const { bytesRead } = await source.read(chunk, 0, length, position);
              if (bytesRead !== length) throw fail('DRIVE_SOURCE_CHANGED', 'Upload source changed during transfer');
              result = await uploadRequest(chunk, 'bytes ' + position + '-' + (position + length - 1) + '/' + hash.size);
            }
          } catch (error) {
            if (!error.retryable || ++failures >= config.attempts) throw error;
            await sleep(Math.max(error.retryAfterMs || 0, Math.min(32000, 1000 * 2 ** (failures - 1))));
            queryStatus = true;
            continue;
          }
          if (result.expired) {
            if (++failures >= config.attempts) throw fail('DRIVE_SESSION_EXPIRED', 'Drive upload session repeatedly expired; journal preserved');
            journal.session = null;
            writeJson(journalFile, journal);
            complete = await initiate();
            position = 0;
            queryStatus = true;
            continue;
          }
          if (result.completed) { complete = await metadata(journal.id); break; }
          if (!queryStatus && result.offset <= position) {
            if (++failures >= config.attempts) throw fail('DRIVE_UPLOAD_STALLED', 'Drive upload made no progress; journal preserved');
            await sleep(Math.min(32000, 1000 * 2 ** (failures - 1)));
          }
          if (result.offset > position) failures = 0;
          position = result.offset;
          queryStatus = false;
        }
      } finally { await source.close(); }
      if (!validObject(complete, hash, config.folderId)) throw fail('DRIVE_INTEGRITY', 'Uploaded Drive object failed checksum verification; sources and journal preserved');
      return { ...descriptor(complete), cached: false };
    } finally { lease.release(); }
  }

  async function getFile(object, destination) {
    fileId(object?.fileId);
    if (!SHA.test(object.sha256 || '') || !Number.isSafeInteger(object.size) || object.size < 1 || object.size > config.maxFileBytes) {
      throw fail('DRIVE_INVALID_OBJECT', 'Invalid Drive object descriptor');
    }
    try {
      const local = await fingerprint(destination);
      if (local.size === object.size && local.sha256 === object.sha256) return { path: destination, cached: true, ...local };
      throw fail('DRIVE_DESTINATION_EXISTS', 'Destination already exists with different contents; original preserved');
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
    const remote = await metadata(object.fileId);
    if (!validObject(remote, object, config.folderId)) throw fail('DRIVE_INTEGRITY', 'Drive object metadata failed verification');
    return retry(async () => {
      const { partial, directory } = paths.driveRestorePaths(destination, crypto.randomUUID());
      let created = false;
      try {
        const handle = await fs.promises.open(partial, 'wx', 0o600);
        created = true;
        const hash = crypto.createHash('sha256');
        let size = 0;
        try {
          await authorized(API + '/files/' + object.fileId + '?alt=media&supportsAllDrives=true', {}, async response => {
            if (!response.body) throw fail('DRIVE_DOWNLOAD_TRUNCATED', 'Drive download had no body', true);
            for await (const chunk of response.body) {
              size += chunk.length;
              if (size > object.size) throw fail('DRIVE_INTEGRITY', 'Drive download exceeded its declared size');
              hash.update(chunk);
              let written = 0;
              while (written < chunk.length) {
                const result = await handle.write(chunk, written, chunk.length - written);
                if (!result.bytesWritten) throw fail('DRIVE_LOCAL_IO', 'Drive restore could not write to disk');
                written += result.bytesWritten;
              }
            }
          });
          if (size !== object.size) throw fail('DRIVE_DOWNLOAD_TRUNCATED', 'Drive download was truncated', true);
          if (hash.digest('hex') !== object.sha256) throw fail('DRIVE_INTEGRITY', 'Drive download checksum mismatch; destination was not published');
          await handle.sync();
        } finally { await handle.close(); }
        // Same-filesystem hard link publishes atomically and refuses to overwrite a raced-in destination.
        await fs.promises.link(partial, destination);
        if (process.platform !== 'win32') {
          const parent = await fs.promises.open(directory, 'r');
          try { await parent.sync(); } finally { await parent.close(); }
        }
        return { path: destination, cached: false, sha256: object.sha256, size };
      } finally {
        if (created) await fs.promises.unlink(partial);
      }
    });
  }

  return { probe, putFile, getFile };
}

module.exports = { createDriveStore, fingerprint, validObject };
