# Nexus Loader automation roadmap

## Current flow

1. User enters: `Mod name Author`
2. Search Nexus
3. Resolve Mod ID
4. Create build plan

## Target flow

```
Name + Author
      |
      v
Nexus search
      |
      v
Download original archive
      |
      v
Find RU translation
      |
      v
Merge files
      |
      v
Validate localization
      |
      v
Export ready RU mod
```

## Batch mode

Input:

```
Alpaca aboba24
Automate Pathoschild
Tractor Mod Pathoschild
```

Output:

- found mods
- missing mods
- available translations
- generated archives
