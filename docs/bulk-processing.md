# Bulk mod processing

## Input format

The user provides one mod per line:

```
Mod Name Author
```

Example:

```
Alpaca aboba24
Automate Pathoschild
```

## Processing pipeline

Each entry should move through:

1. Parse name and author
2. Search Nexus Mods
3. Resolve Mod ID
4. Download original archive
5. Find Russian translation
6. Merge files
7. Validate localization
8. Export ready archive

The queue architecture allows hundreds of mods to be processed without blocking the interface.
