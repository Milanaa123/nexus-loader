# Runtime data

Nexus Loader keeps runtime state outside Git history.

- Default local runtime queue/state live in `RU_PACK_WORK/queue/` and `RU_PACK_WORK/state/`, as configured in `config/paths.js`.
- `data/queue/` and `data/state/` are legacy migration sources, not the current source of truth. The opt-in Supabase backend stores authoritative runtime records remotely.

JSON files in those directories are intentionally ignored. Historical Stardew-specific batch datasets were removed from the active tree; they remain available in Git history.

`verified-mods.json` contains dated historical observations. Its names, versions and translation IDs are not assumed to be current. The active resolver does not automatically install from those observations; see [Nexus resolution](../docs/nexus-resolution.md).
