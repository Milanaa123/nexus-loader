const { configuration } = require('../config/nexus');
const { version } = require('../package.json');

function failure(code, message, retryable = false, extra = {}) {
  return Object.assign(new Error(message), { code, retryable, ...extra });
}
function identity(game, modId, fileId) {
  if (!/^[a-z0-9_-]+$/i.test(String(game || '')) || !/^[1-9]\d*$/.test(String(modId || '')) || (fileId !== undefined && !/^[1-9]\d*$/.test(String(fileId)))) {
    throw failure('NEXUS_INPUT', 'A valid Nexus game, mod ID and file ID are required');
  }
}
function createNexusClient(options = {}) {
  const env = options.env || process.env;
  const transport = options.fetch || ((...args) => globalThis.fetch(...args));
  const sleep = options.sleep || (ms => new Promise(resolve => setTimeout(resolve, ms)));
  const now = options.now || Date.now;
  const config = () => configuration(env);
  function headers(extra = {}, requireKey = true) {
    if (requireKey && !env.NEXUS_API_KEY) throw failure('NEXUS_AUTH_REQUIRED', 'NEXUS_API_KEY is not configured', false, { action: { type: 'configure_nexus_api_key' } });
    return {
      ...(requireKey && env.NEXUS_API_KEY ? { APIKEY: env.NEXUS_API_KEY } : {}),
      'User-Agent': 'nexus-loader/' + version,
      'Application-Name': 'nexus-loader', 'Application-Version': version, ...extra
    };
  }
  function httpError(response) {
    const statusCode = response.status;
    const rawDelay = response.headers.get('retry-after');
    const delay = rawDelay === null ? 0 : /^\d+$/.test(rawDelay) ? Number(rawDelay) * 1000 : Date.parse(rawDelay) - now();
    const retryAfterMs = Number.isFinite(delay) ? Math.max(0, Math.min(delay, 86400000)) : 0;
    const codes = { 401: 'NEXUS_AUTH_REQUIRED', 403: 'NEXUS_FORBIDDEN', 404: 'NEXUS_NOT_FOUND', 429: 'NEXUS_RATE_LIMIT' };
    return failure(codes[statusCode] || (statusCode >= 300 && statusCode < 400 ? 'NEXUS_REDIRECT' : 'NEXUS_HTTP'),
      'Nexus HTTP ' + statusCode, [429, 500, 502, 503, 504].includes(statusCode), { statusCode, retryAfterMs });
  }
  async function execute(url, options = {}, retries, consume = response => response) {
    const settings = config();
    const attempts = Math.max(1, Math.min(settings.attempts, Number(retries) || settings.attempts));
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      let response;
      try {
        const timeout = AbortSignal.timeout(settings.timeoutMs);
        response = await transport(url, { ...options, redirect: 'manual', signal: options.signal ? AbortSignal.any([options.signal, timeout]) : timeout });
        if (!response.ok) throw httpError(response);
        return await consume(response, settings);
      } catch (error) {
        try { await response?.body?.cancel(); } catch { /* A consumer may already have closed it. */ }
        const safe = options.signal?.aborted ? failure('NEXUS_CANCELLED', 'Nexus request was cancelled')
          : error.code?.startsWith('NEXUS_') ? error : failure('NEXUS_NETWORK', 'Nexus request failed or timed out', true);
        // Provider bodies, signed URLs, transport messages and causes must not reach state/logs.
        if (!safe.retryable || attempt + 1 >= attempts || safe.retryAfterMs > settings.maxRetryDelayMs) throw safe;
        await sleep(Math.max(250 * 2 ** attempt, safe.retryAfterMs || 0));
      }
    }
  }
  const request = (url, options, retries) => execute(url, options, retries);
  async function json(url, options = {}, retries) {
    return execute(url, options, retries, async (response, settings) => {
      const reader = response.body?.getReader();
      const chunks = []; let size = 0;
      if (reader) {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            size += value.byteLength;
            if (size > settings.maxJsonBytes) { await reader.cancel(); throw failure('NEXUS_RESPONSE_INVALID', 'Nexus JSON response exceeds the safety limit'); }
            chunks.push(Buffer.from(value));
          }
        } finally { reader.releaseLock(); }
      }
      try { return JSON.parse(Buffer.concat(chunks, size).toString('utf8')); }
      catch { throw failure('NEXUS_RESPONSE_INVALID', 'Nexus returned invalid JSON'); }
    });
  }
  async function graphql(query, variables, signal) {
    // Public search does not require a personal API key. REST metadata/downloads do.
    const payload = await json(config().graphql, { method: 'POST', headers: headers({ 'Content-Type': 'application/json' }, false), body: JSON.stringify({ query, variables }), signal });
    if (!payload || typeof payload !== 'object' || (Array.isArray(payload.errors) && payload.errors.length)) throw failure('NEXUS_GRAPHQL', 'Nexus search query was rejected or incomplete');
    if (!payload.data || typeof payload.data !== 'object') throw failure('NEXUS_RESPONSE_INVALID', 'Nexus search response has no data');
    return payload.data;
  }
  async function searchMods({ game, name, limit = 40, signal }) {
    if (!/^[a-z0-9_-]+$/i.test(String(game || ''))) throw failure('NEXUS_INPUT', 'Nexus game domain is required for search');
    if (!name) return Object.assign([], { search: { complete: true, totalCount: 0 } });
    const query = 'query NexusLoaderSearch($filter: ModsFilter, $count: Int) { mods(filter: $filter, count: $count) { totalCount nodes { modId name author version status uploader { name memberId } game { id domainName name } } } }';
    const data = await graphql(query, {
      filter: { gameDomainName: [{ value: String(game).toLowerCase(), op: 'EQUALS' }], name: [{ value: String(name), op: 'WILDCARD' }] },
      count: Math.max(1, Math.min(Math.floor(Number(limit) || 40), 100))
    }, signal);
    const page = data.mods;
    if (!Array.isArray(page?.nodes) || !Number.isSafeInteger(page.totalCount) || page.totalCount < page.nodes.length) throw failure('NEXUS_RESPONSE_INVALID', 'Nexus search page is malformed');
    const nodes = page.nodes.map(node => {
      if (!/^[1-9]\d*$/.test(String(node?.modId || '')) || typeof node.name !== 'string' || !node.name.trim() || (node.author != null && typeof node.author !== 'string') || node.game?.domainName !== String(game).toLowerCase()) throw failure('NEXUS_RESPONSE_INVALID', 'Nexus search returned an invalid mod identity');
      return { modId: String(node.modId), name: node.name, author: node.author || '', uploader: node.uploader?.name || null, version: node.version || null, status: node.status || null, game: node.game.domainName, gameName: node.game.name || null };
    });
    return Object.assign(nodes, { search: { complete: page.totalCount === nodes.length, totalCount: page.totalCount } });
  }
  async function getMod({ game, modId, signal }) {
    identity(game, modId);
    const data = await json(config().apiV1 + '/games/' + encodeURIComponent(game) + '/mods/' + modId + '.json', { headers: headers(), signal });
    if (!data || String(data.mod_id) !== String(modId) || typeof data.name !== 'string' || !data.name.trim() || (data.author != null && typeof data.author !== 'string')) throw failure('NEXUS_RESPONSE_INVALID', 'Nexus mod metadata has an invalid identity');
    return { ...data, game };
  }
  async function getFiles({ game, modId }) {
    identity(game, modId);
    const data = await json(config().apiV1 + '/games/' + encodeURIComponent(game) + '/mods/' + modId + '/files.json', { headers: headers() });
    const files = Array.isArray(data) ? data : data?.files;
    if (!Array.isArray(files) || files.some(file => !/^[1-9]\d*$/.test(String(file?.file_id || '')))) throw failure('NEXUS_RESPONSE_INVALID', 'Nexus file list is malformed');
    return files;
  }
  async function getDownloadLinks({ game, modId, fileId }) {
    if (fileId === undefined) throw failure('NEXUS_INPUT', 'A Nexus file ID is required for download links');
    identity(game, modId, fileId);
    let data;
    try { data = await json(config().apiV1 + '/games/' + encodeURIComponent(game) + '/mods/' + modId + '/files/' + fileId + '/download_link.json', { headers: headers() }); }
    catch (error) {
      if (error.code !== 'NEXUS_FORBIDDEN') throw error;
      throw failure('NEXUS_DOWNLOAD_AUTHORIZATION', 'Nexus did not authorize this download; confirm access on the file page', false, { action: { type: 'authorize_nexus_download', url: 'https://www.nexusmods.com/' + game + '/mods/' + modId + '?tab=files', game, modId: String(modId), fileId: String(fileId) } });
    }
    if (!Array.isArray(data) || !data.length || data.some(link => typeof (link?.URI || link?.uri) !== 'string')) throw failure('NEXUS_RESPONSE_INVALID', 'Nexus download response is malformed');
    return data;
  }
  async function getCapabilities({ signal } = {}) {
    const data = await json(config().apiV1 + '/users/validate', { headers: headers(), signal });
    if (typeof data?.is_premium !== 'boolean') throw failure('NEXUS_RESPONSE_INVALID', 'Nexus account capabilities are malformed');
    // The raw validation response can contain the key, email and identity. Return only capabilities.
    return { authenticated: true, directDownloads: data.is_premium, requiresWebsiteAuthorization: !data.is_premium };
  }
  return { headers, request, searchMods, getMod, getFiles, getDownloadLinks, getCapabilities };
}
module.exports = { ...createNexusClient(), createNexusClient, failure };
