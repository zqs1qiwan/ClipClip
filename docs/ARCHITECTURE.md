# ClipClip MVP Architecture

## Status

Implemented; synced with the dual-mode security and UI/UX refactor round (see [ROADMAP.md](ROADMAP.md) "实施记录").

## Scope

This architecture covers the MVP described in [PRD.md](PRD.md):

- Live clipboard text shared in real time
- Immutable paste links
- Small file upload and download
- Docker-first deployment
- Single self-hosted service

## Assumptions

1. MVP starts with one default live room named `main`.
2. The service is trusted-LAN by default and may later be exposed through Cloudflare Tunnel.
3. Authentication is out of scope for MVP.
4. JSON file storage is acceptable for the first router-hosted MVP on `192.168.2.1`.
5. Uploaded files are stored on disk, while metadata is stored in a JSON state file.
6. Two access modes are supported: **local mode** (default, no token → zero-friction LAN use) and **public mode** (`CLIPCLIP_ACCESS_TOKEN` set → all data endpoints require auth). See [SECURITY.md](SECURITY.md) for the access contract.

## System Overview

ClipClip is a single-process web app with four functional layers:

1. HTTP API for paste and file workflows
2. Server-Sent Events channel for real-time clipboard and file updates
3. Browser UI for text, paste, and file actions
4. Access-control middleware (`auth.js`) that gates every data endpoint in public mode

The app runs as one Docker container and persists data to a mounted volume. In local mode the middleware is a no-op so LAN usage stays frictionless; in public mode it enforces token login before any data is served.

## Implementation Decision

The first MVP implementation uses a zero-dependency Node.js runtime:

- Node.js 22
- Native `node:http`, `node:fs`, and `node:crypto`
- Server-Sent Events for real-time clipboard fan-out
- Browser-native HTML, CSS, and JavaScript UI
- JSON metadata storage plus filesystem blob storage
- Node's built-in test runner for backend tests
- Zero-dependency token auth (`auth.js`) with crypto-random sessions in memory and `timingSafeEqual` comparison

This keeps deployment simple on the router server, avoids package-manager bootstrapping friction, and still leaves room to migrate to a richer framework later.

## Runtime Components

### Web Server

Responsibilities:

- Serve the SPA shell and static assets
- Expose JSON APIs
- Host the SSE endpoint
- Apply upload limits and security headers
- Reject malformed request targets and handle stream errors without terminating the process

### Access Control (`src/server/auth.js`)

Responsibilities:

- Read `CLIPCLIP_ACCESS_TOKEN` from config; absence selects local mode, presence selects public mode
- In local mode, pass all requests through with no login wall
- In public mode, gate every `/api/*` data endpoint, `/api/events`, and static pages; exempt `/api/login` and `/api/health`
- Validate the login token with `timingSafeEqual`, sign a crypto-random session token into an in-memory store, and set a `HttpOnly; SameSite=Strict; Path=/; Max-Age=...` cookie (plus `Secure` when HTTPS)
- Accept `Authorization: Bearer <token>` as an alternative to the cookie; return `401` JSON when unauthorized
- Rate-limit failed logins per IP and expire stale sessions

### Clipboard Service

Responsibilities:

- Store and update the current text for the `main` room
- Broadcast clipboard changes to connected clients
- Persist the latest clipboard value across refreshes

### Paste Service

Responsibilities:

- Create immutable paste records
- Enforce expiration
- Store a `burnAfterRead` flag on the record (iteration 2: first successful read deletes the paste atomically; see [API.md](API.md))

### File Service

Responsibilities:

- Stream uploads to disk
- Store file metadata in the JSON state file
- Enforce size limits and TTL
- Serve downloads with safe headers

### Cleanup Worker

Responsibilities:

- Periodically delete expired paste records
- Periodically delete expired file metadata and blobs
- Avoid blocking request handling

## State File Shape

```json
{
  "liveClipboard": {
    "roomId": "main",
    "content": "",
    "updatedAt": null
  },
  "pastes": [
    {
      "id": "abc123",
      "content": "fixed text",
      "createdAt": "2026-06-09T12:00:00.000Z",
      "expiresAt": "2026-06-10T12:00:00.000Z",
      "burnAfterRead": false,
      "firstReadAt": null
    }
  ],
  "files": [
    {
      "id": "file123",
      "originalName": "notes.txt",
      "storedName": "file123-notes.txt",
      "mimeType": "text/plain",
      "sizeBytes": 1234,
      "createdAt": "2026-06-09T12:00:00.000Z",
      "expiresAt": "2026-06-10T12:00:00.000Z",
      "downloadCount": 0
    }
  ]
}
```

Notes: `pastes[].burnAfterRead` / `firstReadAt` support the iteration-2 burn-after-read feature; iteration 2 also adds an optional passphrase hash (`passphraseHash` + `hasPassphrase`, never plaintext) to protected pastes. `files[].storedName` is a sanitized, ID-prefixed disk name (never the client name); `files[].downloadCount` supports download tracking. Writes are serialized through a single-flight persist queue using a unique temp file followed by an atomic rename, and state entries are schema-validated on load.

## Filesystem Layout

Runtime volume root:

```text
/data
  /state
    clipclip-state.json
  /uploads
    <file blobs>
  /tmp
    <in-flight upload staging>
```

Local development equivalent:

```text
./data/state/clipclip-state.json
./data/uploads/
./data/tmp/
```

## API Design

### `GET /api/health`

Returns service health and version metadata. Always public (used for liveness and login-mode detection).

### `POST /api/login` (public mode only)

Authenticates the access token and starts a session.

Request:

```json
{
  "token": "the CLIPCLIP_ACCESS_TOKEN value"
}
```

Behavior: compares with `timingSafeEqual`; on success signs a crypto-random session into an in-memory store and returns `Set-Cookie: clipclip_session=<session>; HttpOnly; SameSite=Strict; Path=/; Max-Age=...` (with `Secure` when HTTPS is detected). Failed attempts are rate-limited per IP. `Authorization: Bearer <token>` is accepted on protected endpoints as a cookie alternative. In local mode this endpoint is unnecessary and the UI does not show a login screen.

### `GET /api/live`

Returns the current clipboard content for room `main`.

Response:

```json
{
  "roomId": "main",
  "content": "latest text",
  "updatedAt": "2026-06-09T12:00:00.000Z"
}
```

### `PUT /api/live`

Updates the current clipboard text for room `main`.

Request:

```json
{
  "content": "new clipboard value"
}
```

### `POST /api/pastes`

Creates an immutable paste. Expiration is fixed by the server-side `CLIPCLIP_PASTE_TTL_HOURS` setting; the request does not carry a per-paste TTL field.

Request:

```json
{
  "content": "fixed text"
}
```

Response:

```json
{
  "id": "abc123",
  "url": "/p/abc123",
  "expiresAt": "2026-06-10T12:00:00.000Z"
}
```

### `GET /api/pastes/:id`

Returns immutable paste metadata and content if not expired.

### `POST /api/files`

Accepts one raw file upload.

Response:

```json
{
  "id": "file123",
  "fileName": "notes.txt",
  "downloadUrl": "/api/files/file123/download",
  "expiresAt": "2026-06-10T12:00:00.000Z",
  "sizeBytes": 1234
}
```

### `GET /api/files/latest`

Returns metadata for the most recent non-expired file, or `404` if none.

### `GET /api/files/recent`

Returns metadata for the recent non-expired files (bounded by `CLIPCLIP_RECENT_FILES_LIMIT`).

### `GET /api/files/:id`

Returns file metadata if present and not expired.

### `GET /api/files/:id/download`

Streams the file to the browser with `Content-Type: application/octet-stream` and an RFC5987 `Content-Disposition: attachment; filename*=UTF-8''...` header (independent of the client-declared content type).

## Real-Time Design

Endpoint:

```text
GET /api/events
```

Server messages:

```json
{ "type": "live:snapshot", "roomId": "main", "content": "hello", "updatedAt": "..." }
{ "type": "live:updated", "roomId": "main", "content": "hello", "updatedAt": "..." }
{ "type": "files:snapshot", "files": [ ... ] }
{ "type": "files:updated", "latest": { ... }, "files": [ ... ] }
```

`files:snapshot` is sent on connect; `files:updated` is broadcast after a successful upload. The server remains authoritative. UI writes go through HTTP `PUT /api/live`, and the SSE channel is used for fan-out and reconnect snapshots. In public mode `/api/events` is auth-gated like other data endpoints. Connections are bounded, emit periodic heartbeat comments, and are removed on write failure or idle timeout; `X-Accel-Buffering: no` prevents reverse-proxy buffering.

## Client Structure

```text
public/
  index.html                Main app shell
  app.js                    Browser logic (imports modules below)
  styles.css                Theme and layout
  button-feedback.js        Shared button pressed/feedback states
  lib/
    clipboard.js            Copy-with-fallback helper
```

## Security Controls

- Validate every request body and route param manually at boundaries; reject non-object bodies and non-string `content` with `400`.
- Enforce server-side body and upload size limits (raw body streamed through an `UploadLimitStream`, not multipart).
- Generate unguessable IDs with cryptographic randomness.
- Sanitize filenames and never trust client paths; store files under generated, ID-prefixed names; validate state entries so a tampered `storedName` cannot traverse paths.
- Avoid rendering paste content as HTML (use `textContent`).
- Send downloads with `Content-Disposition: attachment` and a fixed `application/octet-stream` content type; encode filenames with RFC5987 `filename*`.
- Disable directory listing or direct file-path serving.
- Keep CORS off by default.
- Avoid logging clipboard contents, paste bodies, upload bytes, tokens, or session values.
- **Access modes**: local mode (no `CLIPCLIP_ACCESS_TOKEN`) is trusted-LAN and login-free; public mode (token set) gates all data endpoints, SSE and pages behind token login with `timingSafeEqual`, crypto-random in-memory sessions, `HttpOnly`/`SameSite=Strict` cookies (conditional `Secure`), Bearer support, and per-IP login rate limiting. Unauthorized requests receive `401` JSON.
- **Security response headers**: `Content-Security-Policy` (`default-src 'self'; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'`), HSTS (HTTPS only), `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `X-Frame-Options`, `COOP`/`COEP`/`CORP`, `Permissions-Policy`, and `X-Accel-Buffering: no`. The CSP is kept compatible with SSE (`connect-src 'self'`) and external JS modules (no inline scripts required). See [SECURITY.md](SECURITY.md) for the full contract.

## Deployment Model

Target host:

```text
192.168.2.1
```

Container exposure:

```text
Host port 5678 -> container port 5678
Mounted volume -> /data
```

Initial Docker runtime assumptions:

- Bridge network is fine for LAN access
- Reverse proxy is optional
- Cloudflare Tunnel is a later deployment layer, not part of the core app runtime
- **Local mode** (default): no `CLIPCLIP_ACCESS_TOKEN`, no login wall; intended for trusted LAN
- **Public mode**: set `CLIPCLIP_ACCESS_TOKEN` and place an access-control layer (Cloudflare Access / reverse-proxy auth) in front before exposing to the internet; see [SECURITY.md](SECURITY.md)

## Risks And Mitigations

### Risk: clipboard abuse or accidental secret retention

Mitigation:

- Keep clipboard single-value in MVP
- Add clear action
- Keep history out of MVP
- Document LAN trust assumptions

### Risk: file upload memory blowup

Mitigation:

- Stream uploads to disk
- Enforce raw-body streaming upload limits (`UploadLimitStream`) plus a `Content-Length` pre-check
- Reject oversized requests early

### Risk: stale real-time state after reconnect

Mitigation:

- Send a snapshot immediately on connect
- Use HTTP as the source of truth for writes

### Risk: router storage growth

Mitigation:

- TTL-based cleanup
- Configurable max upload size
- Small-file-only product positioning

## Verification Checkpoints

1. Server skeleton boots and returns `/api/health`
2. Live clipboard works in two browser tabs through SSE
3. Paste creation and read-only page work
4. File upload and download work
5. Cleanup removes expired records and files
6. Docker image runs with a mounted `/data` volume
7. Local mode has no login wall and all features work without a token
8. Public mode rejects unauthenticated `/api/*`, `/api/events` and pages with `401`, and login with the correct token grants access
9. Malformed URLs, missing blobs, concurrent writes, and expired-file access do not crash the process or corrupt state
