# Persistent storage and recovery

Set RU_PACK_WORK to an absolute persistent-volume mount before starting both processes. A directory in a container's disposable filesystem is not persistent just because it is named RU_PACK_WORK. The API and worker must see the same disk and path configuration. This local-filesystem backend is designed for one host, not distributed network filesystems.

The optional [Google Drive transport](google-drive-storage.md) currently transfers individual blobs only. It does not make the queue/state backend durable on free Render, and does not replace the shared-disk requirement above.

## Documents

Queue mutations are serialized with a short filesystem transaction lock. Writes use a uniquely named sibling file, flush its contents, then rename atomically. A stopped writer's incomplete sibling is never used as state.

Only a missing document permits an empty default. Invalid JSON, invalid queue shape, permission errors and IO errors stop the operation. The original is retained in place. Restore a verified backup or repair that exact document; the application does not erase or reset it.

Transaction locks record host and PID. A confirmed dead local owner can be reclaimed. Live owners and foreign hosts are never evicted by age. An empty/malformed lock left by an abrupt failure requires inspection while all processes are stopped. Do not remove a lock owned by a live writer.

Worker processing has its own longer lease. Storage transactions are synchronous and never contain downloads.

## Upgrade

1. Stop the API and workers, back up the existing runtime directories.
2. Set RU_PACK_WORK consistently for all new processes; keep existing explicit overrides if required.
3. Start the new version. On first read it copies legacy queue/state/results into the canonical locations without changing the originals.
4. Verify /api/status and download an existing result before discarding any backup.

Legacy queue: data/queue/ru-pack-queue.json. Legacy state: data/state/*.json. Legacy results: RU_PACK_WORK/ru_results.json. Existing ready archives remain downloadable from RU_PACK_WORK/output/. A new canonical document wins over a legacy one even when empty. Never run old workers after this migration: their later writes would update the obsolete documents.

No automatic cleanup is performed on original downloads, translations, builds, error history or logs. Only short-lived extraction directories and transaction metadata are removed automatically. Test fixtures use their own disposable directories.

## Worker checkpoints and retries

Each completed pipeline step saves a full result to state/results.json before moving to the next step. state/processed.json and queue records are projections. On restart the worker reuses a saved mod ID, translation selection and validated source files; it does not infer success from the previous running flag.

Failed jobs have nextAttemptAt persisted with exponential backoff (30 seconds by default, capped at one hour). NEXUS_LOADER_MAX_ATTEMPTS defaults to 3 and NEXUS_LOADER_RETRY_BASE_MS overrides the initial delay. Exhausted jobs are terminal and require explicit operator review; re-importing the same mod does not reset them.

A ready result is skipped only after its file, SHA-256 and archive integrity pass validation. A missing or damaged build is rebuilt from saved sources. New build names include a stable identity suffix so identical mod names in different games or authors do not collide. Rebuilds use a new filename; old artifacts are retained.

The local worker lease checks the owner's PID and is periodically refreshed. An existing live local process is never evicted merely because a timestamp expired. A confirmed dead local owner is reclaimable immediately. A foreign-host lease still uses its configured expiry; do not use this backend as a distributed queue.

Downloads are streamed to non-authoritative partial files and published only after integrity checks. HTML/JSON error documents, empty transfers and Content-Length mismatches are rejected. ZIP validation decompresses each file and checks CRC; 7z-family validation also runs the archive test command. ZIP validation has a 1 GiB expanded-size and 100,000-entry safety limit. NEXUS_LOADER_MAX_DOWNLOAD_BYTES defaults to 1 GiB. NEXUS_LOADER_REQUEST_TIMEOUT_MS defaults to 60 seconds per request. Existing damaged cache files are preserved under their existing names; replacements get separate paths.

## Verification scope

The automated tests include four-process concurrent queue imports, corrupt-state preservation, independent-process state reads, retries with a controlled clock, forced process death during a real pipeline checkpoint, lock recovery, download body truncation, CRC corruption, checksum mismatch, and build repair. Test source files and a mock Nexus transport are used: these are not evidence of a live Nexus API integration or a mod running in Stardew Valley/SMAPI.
