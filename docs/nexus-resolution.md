# Nexus identity, translations and download decisions

## Supported boundary

Original lookups and Russian-translation lookups share the existing provider and worker. The application uses public GraphQL v2 for name searches, and REST v1 for mod metadata, file lists and authorized download links. Public search does not send the application's personal API key. REST operations require the server's configured `NEXUS_API_KEY`; the key is never returned by an endpoint.

`config/nexus.js` owns endpoint URLs, request timeout and safety budgets. HTTPS endpoints cannot contain embedded credentials, query strings or fragments. Transient requests have at most three attempts. JSON body reads are timed and bounded to 8 MiB. Redirects are not followed with API credentials. CDN requests do not inherit the API key, and the downloader accepts HTTPS links only. Provider error bodies, signed URLs and low-level transport causes are not included in public errors or persisted results.

## Original identity

`lib/mod-matcher.js` is the single decision implementation for the API and worker. It compares normalized names and, when supplied, authors. Normalization covers Unicode NFKC, case and whitespace, not approximate authorship. An uploader name is retained separately; it is not treated as proof that the uploader authored the mod.

Scores rank suggestions only. A high score cannot authorize a fuzzy name or a different author. An incomplete page, conflicting metadata or multiple exact identities requires review. A direct mod ID is checked against fresh metadata even when a name was supplied; contradictory input becomes `needs_review` instead of silently replacing it. Hidden/unavailable records are not accepted as published mods.

| Situation | Decision |
| --- | --- |
| One exact name and requested author, complete search | `found` |
| No matching author | `not_found`, `author_mismatch` |
| Fuzzy name, multiple matches or a truncated page | `multiple_matches` with suggestions/reason |
| Explicit ID conflicts with name, author or game | `needs_review`, `identity_conflict` |
| Network/API response failure | `error`, never an empty successful search |

## Translation decisions

The existing `scripts/find-translation.js` searches a bounded set of name variants and deduplicates by Nexus mod ID. It excludes the original mod and other games. A Russian marker and name similarity only produce candidates, not proof of a translation relationship.

Automatic selection currently requires all of the following: complete successful queries, exactly one plausible candidate, an exact core name after Russian-language markers are removed, unchanged published metadata, and a link to the exact original game's/mod's Nexus page in the translation description. A description link is relationship evidence, not proof of compatible versions, complete Russian coverage or in-game behavior. Those remain subject to archive validation and human/in-game verification.

Two candidates, an unverified original link, a changed metadata identity or a truncated search returns `needs_review`. A partial network failure is retryable `error`, not `translation_missing`. HTTP 429 stops remaining variants immediately. `translation_missing` means that these completed Nexus name searches found no suitable candidate; it does not assert that no translation exists anywhere.

`data/verified-mods.json` is a historical observation file, not a current trusted translation registry. It is not silently used as authoritative evidence by this resolver. Additional catalog/external-source adapters are not implemented in this block.

## Files, checkpoints and retries

The downloader prefers one explicit primary file, otherwise one main file, otherwise a single remaining active file. Several equally eligible files require an explicit file ID. Missing or inactive explicit IDs are rejected; they are not replaced with invented metadata or another file.

Optional `originalFileId` and `translationFileId` are accepted in JSON queue submissions; CSV headers are `originalfileid` and `translationfileid`. They survive shared queue normalization and reach the corresponding download step. An existing cache entry for a different game, mod or requested file is not reused. Re-importing a job does not reset its terminal status; this integration does not add a public retry/confirmation endpoint.

New translation decisions are bound to `(game, originalModId, translationId)` in a versioned checkpoint. Matching checkpoints resume without a new search. Interrupted legacy decisions without that binding are rechecked; previous translation/build references are retained in `retainedTranslations`, not deleted or reused for a newly resolved translation. Already completed packages are not automatically re-audited by this change.

Permanent Nexus authorization/identity errors become `needs_review` and retain a non-secret action when available. The worker does not consume more retries while waiting for authorization. Transient failures retain bounded backoff; a longer provider `Retry-After` takes precedence and is stored as `nextAttemptAt`, including across worker restarts. No automatic subscription purchase, permission bypass or service upgrade is attempted.

## Read-only preview endpoints

`POST /api/bulkModSearch` accepts `{ "game": "stardewvalley", "text": "name,author\nSMAPI - Stardew Modding API,Pathoschild" }`. It accepts at most 25 unique items per preview; larger lists belong in the persistent import/worker flow. A rate limit or invalid account stops further requests in that batch.

`POST /api/translationSearch` accepts `{ "game": "stardewvalley", "modId": "3753" }`, optionally with `name`/`author` to verify. It checks the original identity before searching. Responses distinguish `translation_found`, `translation_missing`, `needs_review` and API errors. Both previews have a 45-second upstream budget and do not enqueue, download or build anything.

Example queue input with a file selected in advance:

```json
{ "mods": [{ "game": "stardewvalley", "nexusModId": "ORIGINAL_ID", "originalFileId": "ORIGINAL_FILE_ID" }] }
```

Replace the placeholders with actual positive numeric IDs; placeholders themselves are invalid input. Preview endpoints are for personal testing, not an authenticated multi-user service. Register an application and define per-user authorization before a wider public release under the Nexus API policy.

## Free-account limitation

Free hosting does not remove Nexus account restrictions. Nexus's official API client documents that non-Premium downloads need website-generated `key`/`expires` values from a user-authorized NXM link. This release reports denied downloads as `NEXUS_DOWNLOAD_AUTHORIZATION` with a public file-page action. It does not implement a secure NXM handoff or user-uploaded source archives, and does not promise unattended free-account downloads.

`POST /api/nexusCapabilities` explicitly checks the configured key's capabilities through the documented validation endpoint. It returns only `authenticated`, `directDownloads` and `requiresWebsiteAuthorization`; never the key, email, username, user ID or raw validation response. This diagnostic is not polled automatically and does not change membership or purchase anything. A positive capability result does not guarantee that any particular file can be downloaded.

## Verification

`npm test` includes `tests/nexus-client-test.js` and `tests/nexus-resolution-test.js`. They cover credential redaction, body failures/timeouts, retries and cancellation, pagination, author/ID conflicts, translation ambiguity/evidence, file selection, bound checkpoint recovery, persisted cooldowns and real HTTP preview handlers backed by mocked Nexus responses. They do not download a real Nexus file or launch SMAPI. Live name/metadata preview checks must be reported separately from these deterministic tests.

Primary references: [GraphQL schema](https://graphql.nexusmods.com/), [official download-link client contract](https://github.com/Nexus-Mods/node-nexus-api/blob/master/docs/classes/_nexus_.nexus.md#getdownloadurls), [Nexus API acceptable use](https://help.nexusmods.com/article/114-api-acceptable-use-policy).
