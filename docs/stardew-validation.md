# Stardew Valley build validation

The stardewvalley game adapter is registered explicitly. Other games continue to use the generic fallback.

## Checks implemented

- Nonempty SMAPI mod identity, manifest name/version and a valid UniqueID slug.
- Exactly one EntryDll or ContentPackFor; code mod DLL presence in the original/merged package.
- Unique manifest IDs and case-insensitive file-path collisions.
- JSON with comments/trailing commas, BOM and Content Patcher multiline string normalization for validation only. Actual package files are never reformatted.
- Content Patcher content.json, Format, optional Changes array and patch Action fields.
- Existing static FromFile references. Dynamic/tokenized paths and comma-separated paths are not resolved offline.
- Validation of the merged result, not just the input archives.
- Known i18n/default.json keys absent from i18n/ru.json route the result to needs_review.

## Safe overlays

A translation manifest with the same UniqueID and Version maps to the original mod folder even when its directory is renamed. Partial translation packages may omit files that will be provided by the original. The combined result must still pass validation.

An i18n-only overlay without a manifest can be placed into a single unambiguous mod. Multi-mod archives require explicit folder structure or matching manifests; ambiguous placement is not guessed. Manifest version mismatches require review rather than overwriting a newer mod with an older translation.

An original with manifest.json at archive root is wrapped in a folder named after its UniqueID, so extracting into Mods does not place the manifest directly in Mods itself. Original directories and archives are preserved.

## Limits

This is an offline structural and key-coverage check, not a replacement for SMAPI/Content Patcher loading the mod. It does not execute DLLs, verify the installed dependency graph, resolve runtime tokens, test saved games, prove Russian text quality, inspect every dialogue in compiled code, or certify GMCM translation completeness. Mods using unsupported JSON.NET syntax are routed to review instead of silently rewritten.

A needs_review package is not listed among ready downloads. Inspect its stored validation/errors and source files before manual approval. built means the automated structural checks succeeded, not a guarantee that every visible string is Russian.

## Primary references

Rules were checked against these upstream sources on 2026-11-11:

- [SMAPI manifest validation](https://github.com/Pathoschild/SMAPI/blob/develop/src/SMAPI.Toolkit/Framework/ManifestValidator.cs)
- [SMAPI manifest model](https://github.com/Pathoschild/SMAPI/blob/develop/src/SMAPI.Toolkit/Serialization/Models/Manifest.cs)
- [Content Patcher author guide](https://github.com/Pathoschild/StardewMods/blob/develop/ContentPatcher/docs/author-guide.md)
- [Content Patcher translations](https://github.com/Pathoschild/StardewMods/blob/develop/ContentPatcher/docs/author-guide/translations.md)
- [Microsoft jsonc-parser](https://github.com/microsoft/node-jsonc-parser) (dependency pinned to 3.3.1; its errors are checked explicitly)
