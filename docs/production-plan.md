# Nexus Loader production plan

## Goal

Turn Nexus Loader into an automated Stardew Valley Russian mod manager.

## User flow

1. User pastes a list:

```
Alpaca aboba24
Automate Pathoschild
```

2. System resolves:
- mod name
- author
- Nexus identifier

3. Pipeline:

- download original mod
- locate Russian translation
- merge files
- validate localization
- export ready archive

## Current foundations

- bulk mod parsing
- build pipeline planning
- translation resolver layer
- merge service layer
- job queue foundation

## Next development stages

- persistent database
- real Nexus download worker
- translation storage index
- archive processing worker
- web dashboard
- logs and progress tracking
