# Nexus Loader architecture audit - stage 1

## Current pipeline

1. Import input list
- TXT/CSV parsing is handled by `api/importMods.js`.
- Output: `RU_PACK_WORK/mods_with_ids.json`.

2. Nexus resolution
- `api/generateIds.js` resolves Nexus mod IDs using GraphQL search.
- It includes name normalization, author scoring and persistent cache support.

3. Translation search
- `scripts/find-translation.js` searches Nexus translation candidates.
- It uses Russian markers and name similarity scoring.

4. Download
- `scripts/nexus-downloader.js` downloads selected Nexus files.

5. Worker
- `scripts/ru-pack-worker.js` processes translation search and downloads.

## Current gaps

- No single shared status schema between stages.
- Original mod download and translation download are separate concepts.
- No final verified merge artifact pipeline is connected.
- No archive validation layer after download.
- No automated tests covering the pipeline.

## Target next refactor

Introduce a shared mod job object:

```json
{
  "name": "",
  "author": "",
  "status": "imported|found|translation_found|downloaded|built|error",
  "nexusModId": null,
  "translationId": null,
  "files": [],
  "errors": []
}
```

All pipeline stages should read and update this object instead of creating independent result formats.
