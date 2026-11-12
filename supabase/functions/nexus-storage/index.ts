import { createClient } from 'npm:@supabase/supabase-js@2.119.0';
import { createHandler } from './handler.mjs';

// Project-wide credentials stay inside Supabase; Render receives only an application token.
const keys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}');
const key = keys.default || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
if (!key) throw new Error('Supabase server credentials are unavailable');
const db = createClient(Deno.env.get('SUPABASE_URL')!, key, { auth: { persistSession: false, autoRefreshToken: false } });
function checked(result: any) { if (result.error) throw result.error; return result.data; }
const bucket = db.storage.from('nexus-artifacts');
const repository = {
  async authorize(hash: string) {
    const credential = checked(await db.from('nexus_server_credentials').select('token_sha256,enabled').eq('name', 'render').single());
    return credential.enabled && credential.token_sha256 === hash;
  },
  async read(name: string) { return checked(await db.from('nexus_documents').select('name,value,revision').eq('name', name).single()); },
  async cas(name: string, body: any) {
    return checked(await db.rpc('nexus_document_cas', { p_name: name, p_revision: body.revision, p_value: body.value, p_mutation: body.mutation, p_owner: body.owner || null, p_fence: body.fence ?? null }));
  },
  async lease(body: any) { return checked(await db.rpc('nexus_lease', { p_action: body.action, p_owner: body.owner, p_fence: body.fence ?? null })); },
  async upload(hash: string, bytes: Uint8Array) {
    const reservation = checked(await db.rpc('nexus_reserve_chunk', { p_sha256: hash, p_bytes: bytes.length }));
    if (reservation.uploaded) return;
    const uploaded = await bucket.upload(hash, bytes, { contentType: 'application/octet-stream', upsert: false, cacheControl: '0' });
    if (uploaded.error) {
      // A lost success response or concurrent upload may have created the immutable object.
      const existing = checked(await bucket.download(hash));
      const { sha256 } = await import('./handler.mjs');
      if (await sha256(await existing.arrayBuffer()) !== hash) throw uploaded.error;
    }
    checked(await db.from('nexus_chunks').update({ uploaded: true }).eq('sha256', hash).eq('bytes', bytes.length));
  },
  async download(hash: string) {
    const item = checked(await db.from('nexus_chunks').select('uploaded').eq('sha256', hash).maybeSingle());
    if (!item?.uploaded) return null;
    return new Uint8Array(await checked(await bucket.download(hash)).arrayBuffer());
  },
  async event(entry: unknown) { checked(await db.from('nexus_events').insert({ entry })); }
};
Deno.serve(createHandler(repository));
