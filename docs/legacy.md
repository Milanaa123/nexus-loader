# Legacy migration status

The repository historically contained one-off Stardew Valley batch pipelines, stage-specific API endpoints, export triggers and captured results. They are not part of the current Nexus Loader runtime.

The HTTP server exposes an explicit allowlist only: `status`, `packStatus`, `startFromInput`, `jobQueue`, `downloadReady`, and `bulkModSearch`. Legacy files that remain in the repository therefore cannot be invoked through `/api/*`.

Obvious runtime snapshots, trigger files, old 537 batch data and generated result caches have been removed from the active tree where safe. Git history remains the archive for those experiments while the current tree stays focused on the universal provider/game/pipeline architecture.
