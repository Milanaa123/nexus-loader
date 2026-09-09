# Runtime data

Nexus Loader keeps runtime state outside Git history.

- `data/queue/` contains the persistent job queue at runtime.
- `data/state/` contains worker progress, processed records, errors, health and the worker lease.

JSON files in those directories are intentionally ignored. Historical Stardew-specific batch datasets were removed from the active tree; they remain available in Git history.
