# Supabase persistence on a free Render web service

## Storage boundary

With `NEXUS_LOADER_STORAGE_BACKEND=supabase`, PostgreSQL is authoritative for the queue, progress, processed records, results, errors, worker lease and event history. Originals, translations and builds are immutable, checksum-addressed chunks in the private `nexus-artifacts` bucket. Local `RU_PACK_WORK` directories are a verified working cache in this mode, not the source of truth. The local backend remains the default for existing installations.

The existing parser, queue identity rules, pipeline, archive validators and worker are reused. The worker awaits remote writes at every checkpoint. Archive chunks are saved before their result record is committed; a build is not acknowledged as ready if its upload fails. A subsequent process restores referenced files, verifies SHA-256, and resumes the saved job. A ready package is still subject to the [static game-validation limits](stardew-validation.md).

## Configuration

| Variable | Value / purpose |
| --- | --- |
| `NEXUS_LOADER_STORAGE_BACKEND` | `supabase` (default is `local`) |
| `NEXUS_LOADER_SUPABASE_URL` | The project's HTTPS API origin, with no trailing slash |
| `NEXUS_LOADER_STORAGE_TOKEN` | High-entropy application-only bearer token; server secret, never frontend code |
| `NEXUS_LOADER_EMBEDDED_WORKER` | `true` to run the existing worker loop inside the web process |
| `NEXUS_LOADER_WORKER_INTERVAL_MS` | Defaults to 30,000 in cloud mode; do not use aggressive polling on a free plan |

Configure secrets through Render's environment settings, preserving unrelated variables such as `NEXUS_API_KEY`. The application does not consume a ChatGPT connector credential. Its bearer token is separately generated; only its SHA-256 is registered in `nexus_server_credentials`. Supabase's project-wide keys stay inside the Edge Function, never on Render or in the browser. Rotate the application token by updating its hash and Render's secret together during a controlled maintenance window.

The private gateway is `supabase/functions/nexus-storage`. It authenticates every request itself, so its platform `verify_jwt` setting is false. This is not an unauthenticated function: missing or incorrect application credentials return HTTP 401. It has no credential-export, arbitrary SQL, delete or bucket-publication endpoint. Its SDK import is pinned. All five application tables have RLS and explicit deny policies for client roles; their table/function grants are also revoked from `PUBLIC`, `anon` and `authenticated`.

All local cache locations and portable artifact references are defined in `config/paths.js`. References contain a configured area and relative name, not a host-specific absolute directory. Restores reject path traversal and symlinked intermediate directories. Correct local files are reused. Damaged local cache files can be preserved under unique `.corrupt-*` names before a verified cloud copy is restored. Ordinary explicit restores refuse to overwrite mismatching destinations unless repair was requested by the worker/download path.

## Concurrency and recovery

Document updates use a revision compare-and-swap and a mutation UUID. Retrying a request whose response was lost does not apply the same mutation twice. Conflicting queue imports re-read the latest revision and use the same canonical identity/deduplication logic as the local backend.

One worker at a time holds a PostgreSQL lease. It expires after 120 seconds without renewal, with a heartbeat every 20 seconds. State/result commits check the lease's fencing generation inside the same database transaction as their write. A former owner cannot overwrite a newer worker's progress. If an instance dies, recovery may wait for the old lease to expire. Queue imports do not require the processing lease; their CAS transactions can run alongside processing.

Supabase network, permission, quota and malformed-document failures stop the operation; there is no fallback that silently writes an empty or local-only queue. Uploads reserve their bytes transactionally before using Storage. A failed reservation/upload is retained for inspection, not silently deleted.

## Free deployment limits

This setup does not provision a paid Render worker or disk. `npm start` can run HTTP and the embedded worker together; `npm run worker` and `npm run worker:once` remain available with the same cloud configuration. Multiple processes need not share a disk: the cloud lease prevents duplicate ownership. Do not run an old local-only worker after switching backends.

Free Render can sleep or restart; processing resumes when the service is next started by a request. This is not an always-on service or an uptime guarantee. Free Supabase can pause after a week of low activity and has limits on database size, storage, egress and function invocations. A paused project may require resuming in the Supabase dashboard. No keep-alive service or paid upgrade is automatically created.

Each object is at most 2 MiB, below the Free plan's 50 MB object limit. The archive as a whole is reconstructed from ordered chunks. A conservative **800 MiB total reservation budget** leaves headroom within the published 1 GB storage allowance; it is shared by originals, translations, builds and interrupted uploads. This is a small-batch configuration, not unlimited storage for a large mod collection. When the budget is exhausted the operation fails; it never buys capacity or erases results. Provider limits remain authoritative and can restrict the project earlier. Nexus account/API download restrictions remain unchanged.

## Provisioning and migrations

Create a dedicated project in a confirmed Free organization, after checking that the quoted creation cost is zero. Apply the checked-in migrations in order, register the application token's hash using a trusted administrator, and deploy the gateway sources and Deno configuration. Configure the original token only as the Render secret. The SQL files' versions match the hosted migration history. They contain no generated project IDs or secret values.

Before switching an existing installation, stop writers and export/verify its local queue, state and archives. This change does not automatically migrate a nonempty local installation into Supabase. Do not activate cloud mode on a nonempty disposable Render instance without first transferring those records. The current deployment was checked for an empty queue and no results before switching. Existing unrelated Supabase projects were not changed.

## Verification commands and scope

```bash
npm run check
npm test
npm run check:edge

# Uses configured environment; does not modify the queue.
npm run storage:verify

# Explicitly retains a small test ZIP and its metadata in cloud storage.
npm run storage:verify -- --roundtrip

# Run in a separate process / fresh RU_PACK_WORK to test portable recovery.
npm run storage:verify -- --restore
```

The verifier also accepts a single JSON credential envelope on a non-echoing stdin pipe (`--stdin`); never put its contents in shell arguments, chat, logs or Git. Test archives are labelled as storage fixtures, not real mods. They are preserved in the `verification` document and bucket; main queue records are not populated with synthetic jobs.

`tests/supabase-storage-test.js` injects a mock gateway but uses the real worker, archive builder, files and cache-loss recovery. It tests CAS conflicts, lost responses, stale writers, checksum errors, budget errors, cache repair and overlapping async ticks. The live verification additionally covers the actual hosted SQL functions in a rolled-back transaction, closed client permissions, a private two-chunk ZIP upload, and restoring that ZIP from another process with a fresh work root. No local Postgres instance is required for these Node tests; a local CLI migration-history check needs an explicitly started local database. Remote history and SQL are verified through the Supabase connection.

`check:edge` installs the function's SDK from its separate npm lockfile and checks the TypeScript entry point with pinned Deno 2.9.6. Manual node-module resolution is used only for this check; the deployed Edge Function uses Deno's npm import resolution. This also lets the check use npm's configured registry/proxy in environments where Deno cannot fetch packages directly. GitHub Actions runs the same check without project credentials.

These checks do not prove live Nexus downloads, in-game SMAPI behavior, unlimited free capacity, or perpetual availability. Keep independent backups and inspect usage before larger batches. Cleanup of application records and blobs is a separate operator action; there is no automatic deletion command in this integration.

References: [Free plan and quotas](https://supabase.com/pricing), [project pausing](https://supabase.com/docs/guides/platform/free-project-pausing), [Storage limits](https://supabase.com/docs/guides/storage/uploads/file-limits), [private buckets](https://supabase.com/docs/guides/storage/buckets/fundamentals), [Render Free](https://render.com/docs/free).
