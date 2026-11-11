# Persistent storage and recovery

Set RU_PACK_WORK to an absolute persistent-volume mount before starting both processes. A directory in a container's disposable filesystem is not persistent just because it is named RU_PACK_WORK. The API and worker must see the same disk and path configuration. This local-filesystem backend is designed for one host, not distributed network filesystems.

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
