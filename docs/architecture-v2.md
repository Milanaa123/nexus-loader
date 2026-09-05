# Nexus Loader v2 Architecture

## Goal

Build an automated Stardew Valley mod localization manager.

## User flow

1. User enters:

```
Mod Name Author
```

2. System:

- parses the list
- searches Nexus
- creates processing jobs
- downloads original files
- resolves Russian translation packs
- merges files
- validates output
- exports ready archive

## Processing pipeline

```
Input
 |
 v
Importer
 |
 v
Queue
 |
 v
Search
 |
 +--> Original download
 |
 +--> Translation resolver
 |
 +--> Merge
 |
 +--> Validation
 |
 v
Export
```

## Future storage

Current layers are prepared for migration to SQLite/PostgreSQL.
