# ClipClip MVP Architecture

## Status

Draft for implementation.

## Scope

This architecture covers the MVP described in [PRD.md](C:/Users/zqs1q/Documents/Codex/2026-06-08/windows-mac-subnet-cf-tunnel-a/docs/PRD.md):

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

## System Overview

ClipClip is a single-process web app with three functional layers:

1. HTTP API for paste and file workflows
2. Server-Sent Events channel for real-time clipboard updates
3. Browser UI for text, paste, and file actions

The app runs as one Docker container and persists data to a mounted volume.

## Implementation Decision

The first MVP implementation uses a zero-dependency Node.js runtime:

- Node.js 22
- Native `node:http`, `node:fs`, and `node:crypto`
- Server-Sent Events for real-time clipboard fan-out
- Browser-native HTML, CSS, and JavaScript UI
- JSON metadata storage plus filesystem blob storage
- Node's built-in test runner for backend tests

This keeps deployment simple on the router server, avoids package-manager bootstrapping friction, and still leaves room to migrate to a richer framework later.

## Runtime Components

### Web Server

Responsibilities:

- Serve the SPA shell and static assets
- Expose JSON APIs
- Host the SSE endpoint
- Apply upload limits and security headers

### Clipboard Service

Responsibilities:

- Store and update the current text for the `main` room
- Broadcast clipboard changes to connected clients
- Persist the latest clipboard value across refreshes

### Paste Service

Responsibilities:

- Create immutable paste records
- Enforce expiration
- Support optional burn-after-read flag behind a feature gate

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
  "pastes": [],
  "files": []
}
```

## Filesystem Layout

Runtime volume root:

```text
/data
  /state
    clipclip-state.json
  /uploads
    <file blobs>
```

Local development equivalent:

```text
./data/state/clipclip-state.json
./data/uploads/
```

## API Design

### `GET /api/health`

Returns service health and version metadata.

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

Creates an immutable paste.

Request:

```json
{
  "content": "fixed text",
  "expiresInHours": 24
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

### `GET /api/files/:id`

Returns file metadata if present and not expired.

### `GET /api/files/:id/download`

Streams the file to the browser.

## Real-Time Design

Endpoint:

```text
GET /api/events
```

Server messages:

```json
{ "type": "live:snapshot", "roomId": "main", "content": "hello", "updatedAt": "..." }
{ "type": "live:updated", "roomId": "main", "content": "hello", "updatedAt": "..." }
```

The server remains authoritative. UI writes go through HTTP `PUT /api/live`, and the SSE channel is used for fan-out and reconnect snapshots.

## Client Structure

```text
public/
  index.html                Main app shell
  app.js                    Browser logic
  styles.css                Theme and layout
```

## Security Controls

- Validate every request body and route param manually at boundaries.
- Enforce server-side body and upload size limits.
- Generate unguessable IDs with cryptographic randomness.
- Sanitize filenames and never trust client paths.
- Store files under generated names, not user names.
- Avoid rendering paste content as HTML.
- Send downloads with `Content-Disposition: attachment`.
- Disable directory listing or direct file-path serving.
- Keep CORS off by default.
- Avoid logging clipboard contents, paste bodies, and upload bytes.

## Deployment Model

Target host:

```text
192.168.2.1
```

Container exposure:

```text
Host port 8080 -> container port 8080
Mounted volume -> /data
```

Initial Docker runtime assumptions:

- Bridge network is fine for LAN access
- Reverse proxy is optional
- Cloudflare Tunnel is a later deployment layer, not part of the core app runtime

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
- Enforce multipart size limits
- Reject oversized requests early

### Risk: stale WebSocket state after reconnect

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
