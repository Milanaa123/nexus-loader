# Google Drive blob transport (not yet a queue backend)

## Current boundary

The opt-in adapter in `lib/google-drive-store.js` uploads and restores individual immutable files. It does **not** yet mirror `RU_PACK_WORK`, commit queue/state snapshots, rewrite stored local paths, restore a workspace at boot, or run a worker inside the web process. Do not use it as evidence that a free Render instance can preserve a running job across restarts. `runtimeIntegration: false` is intentionally reported by the CLI, `/health`, and `/api/status`, even when credentials are present.

The API and worker still use the local filesystem described in [persistent storage](persistent-storage.md). No storage mode, Render plan, disk, background service, or paid subscription is changed by installing this code. A free Render web service's disposable disk is still not a durable queue or artifact store.

## Credentials and access

Configuration is defined in `config/storage.js`; local transfer paths are defined in `config/paths.js`.

| Environment variable | Purpose |
| --- | --- |
| `GOOGLE_DRIVE_CLIENT_ID` | The application's Google OAuth client |
| `GOOGLE_DRIVE_CLIENT_SECRET` | That client's secret |
| `GOOGLE_DRIVE_REFRESH_TOKEN` | User-granted offline authorization for that client |
| `GOOGLE_DRIVE_FOLDER_ID` | A writable destination folder accessible to that same app |

Prerequisites: enable the Drive API in the app's Google project, authorize the app with the narrow `https://www.googleapis.com/auth/drive.file` scope, and obtain offline access using the owner's consent. The folder must be app-created or selected/shared with this app, for example through Google Picker. A folder's ID alone does not authorize access. This module consumes an existing grant; an OAuth setup/consent UI is not implemented here.

Google Drive connected to ChatGPT does not supply credentials to a deployed application. Render sign-in does not authorize Google Drive either. Do not extract connector tokens, store a Google password, use a service account as the owner of personal My Drive files, or put OAuth credentials in Git, URLs, screenshots, or logs. Supply secrets using the deployment platform's secret settings. A revoked, invalid or expired grant stops transfers with `DRIVE_AUTH_REQUIRED`; it is not silently replaced with another account or broader permission.

Optional bounded settings: `GOOGLE_DRIVE_TIMEOUT_MS` (60,000 by default), `GOOGLE_DRIVE_MAX_ATTEMPTS` (4), `GOOGLE_DRIVE_CHUNK_BYTES` (1 MiB, a multiple of 256 KiB, at most 8 MiB), and `GOOGLE_DRIVE_MAX_FILE_BYTES` (1 GiB). Invalid numeric values fail rather than disabling limits.

## Operator commands

```bash
# Reports only presence booleans; no network request or credential values.
npm run storage:drive -- status

# Refreshes authorization and reads folder capabilities and quota. No file is created.
npm run storage:drive -- probe

# Explicit upload. Prints fileId, SHA-256, MD5 and size, never access tokens or session URLs.
npm run storage:drive -- put /absolute/path/to/ModName_RU.zip

# Restore using the descriptor from put; destination parent must already exist.
npm run storage:drive -- get FILE_ID SHA256 BYTE_COUNT /absolute/path/to/new-ModName_RU.zip
```

The default command is `status`. Nothing is automatically uploaded at startup, and these commands are not exposed as public HTTP upload/download routes. Preserve the returned descriptor in durable application metadata before treating an upload as part of a recoverable job. A blob alone does not identify which queue checkpoint references it.

## Integrity, retries and recovery

Uploads are content-addressed by SHA-256 and scoped to the configured folder with app-private metadata. An existing object is reused only when its byte count, app identity, stored SHA-256 and Google's MD5 match the local file; Google's SHA-256 is checked too when available. New uploads use a pre-generated file ID, so an ambiguous creation retry cannot create another file under a different ID in that attempt. Files are uploaded in bounded chunks. After a dropped response the client queries the server's acknowledged offset instead of assuming that the chunk was accepted.

Transfer journals live in `RU_PACK_WORK/state/drive-transfers/`, not in a temporary directory. They retain the generated file ID and upload session, allowing a new adapter instance to resume. Files have owner-only permissions on platforms that support them. Upload-session URLs must be treated as secrets; the CLI never prints journal contents. Journals and source files are retained on errors and success. The adapter uses the existing local-host lease to prevent simultaneous uploads of the same blob from the same storage directory. This is **not** a cross-host or cross-deploy distributed lock.

Restores stream into an exclusive sibling partial file. A complete SHA-256 and size match is required before atomic, no-overwrite publication. A matching local destination needs no transfer; a differing file or a raced-in destination is preserved and causes an error. Failed non-authoritative download partials are removed. No source file, completed remote object or ready result is automatically deleted. Provider error bodies and low-level network errors are not propagated because they can contain credentials or session URLs. Redirects are not followed with bearer tokens; resumable session URLs are restricted to Google's upload endpoint.

Network failures, 429, rate-limit-specific 403 and transient server errors have bounded backoff. Permission errors, storage quota exhaustion and invalid authorization are actionable failures, not infinite retries. The preflight reports remaining account storage when Google provides a finite limit; the server's quota errors remain authoritative. The adapter never purchases storage or deletes files to make room. API quotas, available account space, Render egress/runtime limits and the existing Nexus download-account restrictions still apply; no claim is made that an arbitrary mod collection will fit a free allowance.

## Verification

`tests/google-drive-store-test.js` uses an injected mock HTTP transport, real local files and persisted journals. It covers token-refresh coalescing, one-time 401 renewal, timeouts, transient and permanent errors, chunk acknowledgements, ambiguous responses, re-opening a saved upload session, expired sessions, stalled transfers, unsafe redirects, quota preflight, corrupt uploads, truncated/corrupt restores and non-overwrite races. It does not prove a live Google consent flow, a transfer to a real account, recovery after Render wipes its local disk, or automatic job recovery through Google Drive. Those require a configured application-specific Google grant and subsequent workspace integration.

## Protocol references

- [Drive uploads, resumable offsets and pre-generated IDs](https://developers.google.com/workspace/drive/api/guides/manage-uploads)
- [Drive errors, quotas and service-account ownership constraints](https://developers.google.com/workspace/drive/api/guides/handle-errors)
- [Narrow per-file OAuth authorization](https://developers.google.com/workspace/drive/api/guides/api-specific-auth)
- [Offline access and refresh tokens](https://developers.google.com/identity/protocols/oauth2/web-server)
- [File checksums and metadata](https://developers.google.com/workspace/drive/api/reference/rest/v3/files)
- [Render free service limitations](https://render.com/docs/free)
