# Batch Runner

## Input format

The loader accepts lines in format:

```
Mod Name Author
```

Example:

```
Alpaca aboba24
Automate Pathoschild
```

## Processing flow

1. Parse name and author.
2. Create build task.
3. Search Nexus metadata.
4. Download original archive.
5. Resolve Russian translation.
6. Merge files.
7. Validate output.
8. Export ready archive.

The goal is processing complete mod collections automatically.
