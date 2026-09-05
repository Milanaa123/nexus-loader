# Batch Runner

The batch runner prepares multiple Stardew Valley mods for processing.

Input format:

```
Mod Name Author
```

Workflow:

1. Parse name and author.
2. Create queued jobs.
3. Process stages:
   - search_nexus
   - download_original
   - find_translation
   - merge_translation
   - validate
   - export

Designed for processing large mod lists.
