# Architecture

## Design goals

Nexus Loader separates external APIs, game-specific rules, processing state, archive handling and HTTP/UI concerns. The core must not contain hard-coded mod IDs, game names, one-off batch sizes, or ephemeral state required for recovery.

## Processing path

1. `lib/input-parser.js` normalizes TXT, CSV and Nexus URLs.
2. `lib/job-queue.js` persists deduplicated jobs using a provider/game-aware key.
3. `scripts/free-worker-loop.js` polls the queue and invokes `scripts/ru-pack-worker.js`.
4. `lib/mod-processing-pipeline.js` resolves the Nexus mod, finds a translation, downloads both files and invokes the builder.
5. `providers/nexus-provider.js` isolates Nexus-specific API operations behind the provider contract.
6. `lib/archive-utils.js` prepares archives/direct files in transient extraction directories.
7. `lib/build-pipeline.js` merges and validates the result, then writes the final ZIP to persistent output storage.
8. `lib/state-store.js` records progress, terminal jobs and error details atomically.

## Identity

Job identity includes provider and game. Nexus mod IDs are only unique in the context of a game domain, so using a bare `modId` as a global key is forbidden.

## Persistence

Queue, downloads, results and state are persistent. Temporary extraction directories are disposable and are never the source of truth. JSON persistence currently uses atomic temp-file + rename writes. A database can replace these modules later without changing the pipeline contracts.

## Provider contract

A provider exposes capabilities for `search`, `getMod`, `download` and `validate`. `provider-registry.js` resolves providers by ID. Nexus-specific URL/API details stay in `providers/nexus-client.js` and `providers/nexus-provider.js`.

## Game adapters

`game-registry.js` resolves adapters by Nexus game domain and falls back to `games/generic.js`. Game-specific validation, translation target discovery and future merge/install rules belong in adapters.

## Failure model

Network requests retry transient HTTP failures. Worker jobs have bounded attempts and move to `retry_exhausted` instead of retrying forever. Ambiguous search results and missing required metadata are terminal review states, not silent guesses.

## Security boundaries

Archive entries are validated before extraction to reject absolute paths and parent-directory traversal. Downloads and finished packages are written only under configured storage roots. HTTP API handlers are path-whitelisted by filename and the server caps request body size.
