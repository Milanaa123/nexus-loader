export const CHUNK_BYTES = 2 * 1024 * 1024;
const DOCUMENTS = new Set(['queue', 'progress', 'processed', 'results', 'errors', 'verification']);
const SHA = /^[a-f0-9]{64}$/;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
export async function sha256(bytes) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), byte => byte.toString(16).padStart(2, '0')).join('');
}
async function boundedBody(req, limit) {
  if (Number(req.headers.get('content-length')) > limit) throw Object.assign(new Error('payload_too_large'), { status: 413 });
  const reader = req.body?.getReader();
  const chunks = []; let size = 0;
  if (reader) {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > limit) { await reader.cancel(); throw Object.assign(new Error('payload_too_large'), { status: 413 }); }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
  }
  const result = new Uint8Array(size); let position = 0;
  for (const chunk of chunks) { result.set(chunk, position); position += chunk.length; }
  return result;
}
export function createHandler(repository) {
  return async req => {
    try {
      const bearer = /^Bearer ([A-Za-z0-9_-]{43,128})$/.exec(req.headers.get('authorization') || '');
      if (!bearer || !await repository.authorize(await sha256(new TextEncoder().encode(bearer[1])))) return json({ error: 'unauthorized' }, 401);
      const segments = new URL(req.url).pathname.split('/').filter(Boolean);
      const root = segments.indexOf('nexus-storage');
      const [kind = 'health', key, extra] = segments.slice(root + 1);
      if (extra) return json({ error: 'not_found' }, 404);
      if (kind === 'health' && req.method === 'GET') return json({ ok: true, schema: 1, chunkBytes: CHUNK_BYTES, artifactBudgetBytes: 838860800 });
      if (kind === 'documents' && DOCUMENTS.has(key)) {
        if (req.method === 'GET') return json(await repository.read(key));
        if (req.method === 'PUT') {
          const body = JSON.parse(new TextDecoder().decode(await boundedBody(req, 8 * 1024 * 1024)));
          if (!Number.isSafeInteger(body.revision) || body.revision < 0 || !UUID.test(body.mutation || '') || body.value === undefined) return json({ error: 'invalid_document' }, 400);
          const result = await repository.cas(key, body);
          return result ? json(result) : json({ error: 'revision_conflict' }, 409);
        }
      }
      if (kind === 'lease' && req.method === 'POST') {
        const body = JSON.parse(new TextDecoder().decode(await boundedBody(req, 4096)));
        if (!['claim', 'touch', 'release'].includes(body.action) || !UUID.test(body.owner || '') || (body.action !== 'claim' && !Number.isSafeInteger(body.fence))) return json({ error: 'invalid_lease' }, 400);
        const lease = await repository.lease(body);
        return lease ? json(lease) : json({ error: 'worker_busy' }, 423);
      }
      if (kind === 'chunks' && SHA.test(key || '')) {
        if (req.method === 'GET') {
          const bytes = await repository.download(key);
          if (!bytes) return json({ error: 'chunk_not_found' }, 404);
          if (await sha256(bytes) !== key) return json({ error: 'chunk_corrupt' }, 502);
          return new Response(bytes, { headers: { 'Content-Type': 'application/octet-stream', 'Content-Length': String(bytes.length), 'Cache-Control': 'private, no-store' } });
        }
        if (req.method === 'PUT') {
          const bytes = await boundedBody(req, CHUNK_BYTES);
          if (!bytes.length || await sha256(bytes) !== key) return json({ error: 'chunk_checksum_mismatch' }, 400);
          await repository.upload(key, bytes);
          return json({ ok: true, sha256: key, bytes: bytes.length });
        }
      }
      if (kind === 'events' && req.method === 'POST') {
        const body = JSON.parse(new TextDecoder().decode(await boundedBody(req, 65536)));
        await repository.event(body);
        return json({ ok: true }, 201);
      }
      return json({ error: 'not_found' }, 404);
    } catch (error) {
      // No raw provider messages, SQL, headers, tokens or URLs in client responses/logs.
      const status = error.status || (error.code === '55P03' ? 423 : error.code === '53100' ? 507 : error instanceof SyntaxError ? 400 : 503);
      return json({ error: status === 423 ? 'worker_busy' : status === 507 ? 'storage_budget_exceeded' : status === 413 ? 'payload_too_large' : status === 400 ? 'invalid_request' : 'storage_unavailable' }, status);
    }
  };
}
