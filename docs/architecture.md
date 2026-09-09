# Architecture

## Design goals

Nexus Loader separates external APIs, game-specific rules, processing state, archive handling and HTTP/UI concerns. The core must not contain hard-coded mod IDs, game names, one-off batch sizes, or ephemeral state required for recovery.

## Processing path

1. `lib/input-parser.js` normalizes TXT, CSV and Nexus URLs.
2. `lib/job-queue.js` persists deduplicated jobs using a provider/game-aware key and mirrors processing status back into the queue document.
3. `scripts/free-worker-loop.js` polls the queue and invokes `scripts/ru-pack-worker.js`.
4. `lib/mod-processing-pipeline.js` resolves the Nexus mod, finds a translation, downloads both files and invokes the builder.
5. `providers/nexus-provider.js` isolates Nexus-specific API operations behind the provider contract.
6. `lib/archive-utils.js` prepares archives/direct files in transient extraction directories.
7. `lib/build-pipeline.js` resolves the requested game adapter, validates sources, performs deterministic translation-over-original overlay, validates the result, then writes the final ZIP to persistent output storage.
8. `lib/state-store.js` records progress, terminal jobs and error details atomically.

## Identity

Job identity includes provider and game. Nexus mod IDs are only unique in the context of a game domain, so using a bare `modId` as a global key is forbidden.

## Persistence

Queue, downloads, results and state are persistent. Temporary extraction directories are disposable and are never the source of truth. JSON persistence currently uses atomic temp-file + rename writes. A database can replace these modules later without changing the pipeline contracts.

## Worker lease

`lib/worker-lock.js` owns a persistent cross-process lease. The lease is created atomically, heartbeated as progress is saved, and released in `finally`. A second worker enters standby instead of processing the same queue concurrently. Stale leases are archived after the configured TTL (`NEXUS_LOADER_WORKER_LOCK_TTL_MS`).

## Provider contract

A provider exposes capabilities for `search`, `getMod`, `download` and `validate`. `provider-registry.js` resolves providers by ID. Nexus-specific URL/API details stay in `providers/nexus-client.js` and `providers/nexus-provider.js`.

## Game adapters

`game-registry.js` resolves adapters by Nexus game domain and falls back to `games/generic.js`. Builders now actively call adapter validation/output hooks. Game-specific validation, translation target discovery and future merge/install rules therefore remain outside the generic core.

## Merge semantics

The generic merge is a deterministic file overlay: files from the original are loaded first and files from the translation replace identical relative paths. Symlinks are rejected. The final file map is sorted before packaging, so correctness no longer depends on duplicate-entry behavior inside the ZIP library.

## Failure model

Network requests retry transient HTTP failures. Worker jobs have bounded attempts and move to `retry_exhausted` instead of retrying forever. `not_found`, `multiple_matches`, missing translations, and review-required jobs are terminal until user input changes the job.

## Security boundaries

Archive entries are validated before extraction to reject absolute paths and parent-directory traversal. Downloads and finished packages are written only under configured storage roots. HTTP API handlers are path-whitelisted by filename and the server caps request body size. Ready-file downloads accept only regular ZIP files beneath the configured output root.
