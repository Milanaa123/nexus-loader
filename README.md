# Nexus Loader

Nexus Loader is a Node.js automation service for discovering Nexus Mods entries, finding Russian translation mods, downloading source files, merging translation overlays, validating archives, and producing persistent ready-to-use packages.

The core is game-domain agnostic: every job carries the Nexus game domain (for example `skyrimspecialedition`, `fallout4`, or `cyberpunk2077`) instead of relying on a hard-coded Stardew Valley pipeline.

## Current architecture

`input -> persistent queue -> worker -> Nexus provider -> translation resolver -> archive layer -> build/validation -> persistent result`

Core boundaries:

- `providers/` — external mod sources. Nexus is the first provider.
- `games/` — game adapters with a generic fallback.
- `lib/mod-processing-pipeline.js` — one mod's lifecycle.
- `lib/job-queue.js` and `lib/state-store.js` — persistent queue/state.
- `lib/archive-utils.js` — ZIP, 7z, RAR, tar/compressed-tar and direct-file preparation.
- `scripts/free-worker-loop.js` — long-running worker process.
- `render-server.js` + `api/` — web/API surface.

## Requirements

- Node.js 20+
- A Nexus Mods API key in `NEXUS_API_KEY`
- Persistent disk for production deployments

## Install

```bash
npm ci
```

## Run

Web/API:

```bash
npm start
```

Worker in a second process/service:

```bash
npm run worker
```

One worker pass:

```bash
npm run worker:once
```

## Input formats

Plain text with a default game supplied by the UI/API:

```text
SkyUI schlangster
Another Mod AuthorName
```

CSV:

```csv
name,author,game
SkyUI,schlangster,skyrimspecialedition
```

Direct Nexus URLs:

```text
https://www.nexusmods.com/skyrimspecialedition/mods/12604
```

## Persistent storage

Runtime data is kept outside temporary extraction directories:

- `RU_PACK_WORK/queue/` — queue
- `RU_PACK_WORK/state/` — progress, processed jobs, results, errors and worker lease
- `RU_PACK_WORK/originals/` and `translations/` — role-specific source downloads
- `RU_PACK_WORK/downloads/` — compatibility cache for downloads without a role
- `RU_PACK_WORK/builds/` — finished archives
- `RU_PACK_WORK/logs/` — append-only daily worker logs
- `RU_PACK_WORK/temp/` — transient extraction only; cleaned after builds

All paths are defined in `config/paths.js`. Set `RU_PACK_WORK` to a persistent mounted disk shared by the API and worker. The default root is the repository directory, not the shell's current directory. Existing explicit path overrides remain supported.

Old queue/state/result documents are copied on first read, only if the corresponding new document does not exist. Old files and archives are not deleted; downloads also support the old `RU_PACK_WORK/output/` directory. Stop old workers before upgrading and do not alternate old and new versions against the same storage. Migration is one-way: new documents are authoritative. See [persistent storage](docs/persistent-storage.md).

## Quality gates

```bash
npm run check
npm test
```

GitHub Actions runs syntax checks and integration tests on every push to `main` and on pull requests.

## Scope and extension model

The generic pipeline can process Nexus jobs for any Nexus game domain. Archive and queue handling are generic. Some games have installation/localization semantics that cannot be inferred safely from file names alone; those rules belong in `games/<adapter>.js` rather than in the core. The generic adapter remains the fallback while explicit adapters can add stronger validation or merge rules without rewriting the provider/worker/storage layers.
