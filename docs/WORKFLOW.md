# Nexus Loader Workflow

## Processing flow

1. Input
- TXT list: `name author`
- CSV list: `name,author`

2. Import
- Normalize names
- Remove duplicates
- Create queue items

3. Resolve
- Find Nexus mod
- Validate author
- Find translation

4. Download
- Original archive
- Translation archive

5. Build
- Extract archives
- Validate Stardew Valley structure
- Create `*_RU.zip`

6. Result
- Status is stored
- Ready archives are available from output folder

## API

`/api/startFromInput`

Starts processing from provided text input.

`/api/packStatus`

Returns current worker state.
