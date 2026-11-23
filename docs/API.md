# ClipClip HTTP API Reference

> **Target-state contract (iteration 2).** This document describes the intended API surface from [ITERATION-2.md](ITERATION-2.md). Some features (passphrase / burn-after-read pastes, multipart upload, `publicMode`/`needsAuth` health fields) are landing in parallel with this document — **the final implementation is authoritative**. Verify against a running instance before relying on exact fields. Authentication and the stable MVP endpoints follow the iteration-1 contract in [SECURITY.md](SECURITY.md).

ClipClip is a zero-dependency Node.js service. All data endpoints speak JSON (`application/json; charset=utf-8`) unless noted. Every response carries `Cache-Control: no-store` and `X-Content-Type-Options: nosniff`. Examples below assume `http://127.0.0.1:5678` (replace host/port as needed).

---

## 1. Authentication (two modes)

ClipClip has two access modes selected at startup by `CLIPCLIP_ACCESS_TOKEN`:

| Mode | When | Behavior |
| --- | --- | --- |
| **Local** (default) | token unset or empty | No login, no token prompt — zero-friction LAN use. All endpoints are open. |
| **Public** | token non-empty | Every `/api/*` **data** endpoint requires a session. Unauthorized requests return `401 {"error":"Unauthorized"}`. |

**Auth allowlist** (public mode):

- Static assets are **public** so the login UI can render: `/`, `/p/<id>`, `/app.js`, `/styles.css`, `/js/*.js`, `/button-feedback.js`, `/lib/clipboard.js`, and other static files.
- The following API paths are public: `GET /api/health`, `POST /api/login`, `POST /api/logout` (logout is safe without a session).
- Everything else — `/api/live`, `/api/events` (SSE), `/api/pastes*`, `/api/files*` including downloads — returns `401` without a session.

There is **no standalone `/login` route**. The login UI is an embedded view in `index.html`: the front end reads `publicMode` from `GET /api/health`, probes a protected API, and shows the login view in place when it receives `401`.

### Bearer token (scripts / curl)

```bash
curl -fsS -H "Authorization: Bearer $CLIPCLIP_ACCESS_TOKEN" \
  http://127.0.0.1:5678/api/live
```

### Cookie session (browsers)

```bash
# log in once, save the cookie jar; subsequent calls reuse it
curl -fsS -c cookies.txt -H 'content-type: application/json' \
  -d "{\"token\":\"$CLIPCLIP_ACCESS_TOKEN\"}" \
  http://127.0.0.1:5678/api/login
curl -fsS -b cookies.txt http://127.0.0.1:5678/api/live
```

`POST /api/login` sets `clipclip_session=<token>; HttpOnly; SameSite=Strict; Path=/; Max-Age=86400` (with `Secure` added under HTTPS). Browsers use the cookie; Bearer is intended for scripts and must not be used from front-end JavaScript. Use `-b cookies.txt` in the examples below when running in public mode (or add the Bearer header).

---

## 2. `GET /api/health`

Liveness, version, storage summary, and mode flags. Public in both modes. Used for container healthchecks and mode detection.

```bash
curl -fsS http://127.0.0.1:5678/api/health
```

```json
{
  "status": "ok",
  "service": "clipclip",
  "version": "0.1.0",
  "storage": { "pastes": 2, "files": 3 },
  "publicMode": true,
  "needsAuth": true
}
```

- `publicMode` (boolean) — whether a token is configured. The token value is **never** returned.
- `needsAuth` (boolean) — whether the caller currently needs to authenticate for data access. In local mode this is `false`; in public mode it is `true` until a valid session/Bearer is presented (target state — verify exact semantics against the running build).

---

## 3. `GET /api/live`

Return the current live clipboard for the single `main` room.

```bash
curl -fsS http://127.0.0.1:5678/api/live
```

```json
{ "roomId": "main", "content": "latest text", "updatedAt": "2026-11-23T12:00:00.000Z" }
```

## 4. `PUT /api/live`

Replace the live clipboard text. `content` must be a string (missing/non-string returns `400`); payload above `CLIPCLIP_LIVE_CONTENT_LIMIT` returns `413`. A successful write broadcasts `live:updated` over SSE.

```bash
curl -fsS -X PUT -H 'content-type: application/json' \
  -d '{"content":"new clipboard value"}' \
  http://127.0.0.1:5678/api/live
```

```json
{ "roomId": "main", "content": "new clipboard value", "updatedAt": "2026-11-23T12:01:00.000Z" }
```

---

## 5. `GET /api/events` (Server-Sent Events)

Streams real-time updates. Set `Accept: text/event-stream`; keep the connection open. In public mode this endpoint requires auth like other data endpoints.

```bash
curl -N -H 'Accept: text/event-stream' http://127.0.0.1:5678/api/events
```

Server messages (each is a `data:` line followed by a blank line):

```text
data: {"type":"live:snapshot","roomId":"main","content":"hello","updatedAt":"..."}

data: {"type":"live:updated","roomId":"main","content":"hello","updatedAt":"..."}

data: {"type":"files:snapshot","files":[ ... ]}

data: {"type":"files:updated","latest":{ ... },"files":[ ... ]}
```

| Type | When |
| --- | --- |
| `live:snapshot` | Sent immediately on connect with the current live clipboard. |
| `live:updated` | Broadcast after a successful `PUT /api/live`. |
| `files:snapshot` | Sent on connect with the recent non-expired files. |
| `files:updated` | Broadcast after a successful file upload. |

Connections are bounded, emit periodic heartbeat comments, and are dropped on write failure or idle timeout. Proxies must not buffer this endpoint (send `X-Accel-Buffering: no` / `proxy_buffering off`).

---

## 6. Pastes

### 6.1 `POST /api/pastes`

Create an immutable paste. Request body (only `content` is required):

| Field | Type | Default | Meaning |
| --- | --- | --- | --- |
| `content` | string | — | Paste body (required, non-empty). |
| `expiresInHours` | number | `CLIPCLIP_PASTE_TTL_HOURS` (24) | Optional TTL override. |
| `burnAfterRead` | boolean | `false` | Delete on first successful read. |
| `passphrase` | string | none | Protect the paste with a passphrase (1–128 chars). |

> **Target state:** `expiresInHours`, `burnAfterRead`, and `passphrase` are iteration-2 additions ([ITERATION-2.md](ITERATION-2.md) §3). The iteration-1 server ignored `expiresInHours` and used the fixed `CLIPCLIP_PASTE_TTL_HOURS`. Only a SHA-256 hash of a passphrase is stored — never plaintext.
>
> **Passphrase strength:** passphrase protection deters casual snooping, not offline attacks. The passphrase is stored as an **unsalted SHA-256 hash**, so if the state file leaks, weak passphrases can be brute-forced offline. Choose a **high-entropy passphrase** (e.g. 16+ random characters from a password manager); do not use dictionary words or short strings. Passphrases are limited to 1–128 characters. See [SECURITY.md](SECURITY.md) §7.4.

```bash
# plain paste
curl -fsS -H 'content-type: application/json' \
  -d '{"content":"fixed text","expiresInHours":24}' \
  http://127.0.0.1:5678/api/pastes

# burn-after-read + passphrase protected
curl -fsS -H 'content-type: application/json' \
  -d '{"content":"secret","burnAfterRead":true,"passphrase":"s3cret"}' \
  http://127.0.0.1:5678/api/pastes
```

```json
{ "id": "abc123", "url": "/p/abc123", "expiresAt": "2026-11-24T12:00:00.000Z" }
```

### 6.2 `GET /api/pastes/:id`

Read an **unprotected** paste. Returns `404` when missing/expired/already burned. For a passphrase-protected paste this returns `403 {"error":"Passphrase required"}` with **no content**; use `/reveal` instead.

```bash
curl -fsS http://127.0.0.1:5678/api/pastes/abc123
```

```json
{
  "id": "abc123",
  "content": "fixed text",
  "createdAt": "2026-11-23T12:00:00.000Z",
  "expiresAt": "2026-11-24T12:00:00.000Z"
}
```

### 6.3 `POST /api/pastes/:id/reveal` (iteration 2)

Reveal a passphrase-protected paste. The passphrase is compared in constant time (SHA-256 + `timingSafeEqual`). Correct passphrase returns the same structure as `GET`; wrong passphrase returns `403 {"error":"Invalid passphrase"}`.

**Failed-attempt rate limit:** reveal failures are counted by **`client IP + pasteId`** (independent per paste). The IP comes from `getRequestIp(req, trustProxy)` — the leftmost valid `X-Forwarded-For` entry when `CLIPCLIP_TRUST_PROXY` is enabled, otherwise `socket.remoteAddress`. After **5 failures per minute** (`CLIPCLIP_REVEAL_RATE_LIMIT` / `CLIPCLIP_REVEAL_RATE_WINDOW_MS`, defaults `5` / `60000`), the 6th attempt returns `429 {"error":"Too many attempts"}` with a `Retry-After: 60` header; a correct passphrase is also rejected until the window expires. A successful reveal clears the bucket; a paste that is missing/burned/expired returns `404` and neither counts nor is rate-limited. This is in-memory and per-process (resets on restart). See [SECURITY.md](SECURITY.md) §6.4.

**Burn-after-read:** for a `burnAfterRead` paste, the **first successful read (GET or reveal) deletes it** and a second read returns `404`; read-and-delete is performed atomically in the storage write queue.

```bash
curl -fsS -H 'content-type: application/json' \
  -d '{"passphrase":"s3cret"}' \
  http://127.0.0.1:5678/api/pastes/abc123/reveal
```

```json
{
  "id": "abc123",
  "content": "secret",
  "createdAt": "2026-11-23T12:00:00.000Z",
  "expiresAt": "2026-11-24T12:00:00.000Z",
  "burnAfterRead": true
}
```

**TTL / burn / passphrase semantics summary**

- **TTL** — pastes expire at `expiresAt` (from `expiresInHours` or the configured default); expired pastes are excluded from reads and cleanup removes them.
- **Passphrase** — plaintext is never stored or logged; only an unsalted SHA-256 `passphraseHash` + `hasPassphrase` are persisted. Protected pastes cannot be read via `GET` without revealing the passphrase, and protect against casual snooping rather than offline attacks — use a high-entropy passphrase (16+ random characters).
- **Reveal rate limit** — 5 failed reveals per minute per `IP + pasteId`; beyond that, `429` + `Retry-After: 60` (see §6.3).
- **Burn-after-read** — one successful read only; then the record is deleted and all further reads return `404`.

---

## 7. Files

### 7.1 `POST /api/files` — raw body

Stream one raw file as the request body. The client declares the filename in the `X-File-Name` header (URL-encoded names are decoded); size is bounded by `CLIPCLIP_MAX_UPLOAD_MB`.

```bash
curl -fsS -X POST \
  -H 'content-type: application/octet-stream' \
  -H 'X-File-Name: notes.txt' \
  --data-binary @notes.txt \
  http://127.0.0.1:5678/api/files
```

### 7.2 `POST /api/files` — multipart (iteration 2)

A `multipart/form-data` form is also accepted (field name `file` or any name); the filename is parsed from the part's `Content-Disposition`. Response shape is identical to the raw-body path. Size limits apply to both.

```bash
curl -fsS -F "file=@/path/to/中文文件名.txt" \
  http://127.0.0.1:5678/api/files
```

Both return:

```json
{
  "id": "file123",
  "fileName": "notes.txt",
  "downloadUrl": "/api/files/file123/download",
  "expiresAt": "2026-11-24T12:00:00.000Z",
  "sizeBytes": 1234
}
```

> **Target state:** multipart support is an iteration-2 addition ([ITERATION-2.md](ITERATION-2.md) §4); the iteration-1 server accepted only raw body + `X-File-Name`.

### 7.3 `GET /api/files/recent`

List recent non-expired file metadata, newest first, bounded by `CLIPCLIP_RECENT_FILES_LIMIT`.

```bash
curl -fsS http://127.0.0.1:5678/api/files/recent
```

```json
{ "files": [ { "id": "file123", "fileName": "notes.txt", "sizeBytes": 1234, "expiresAt": "...", "downloadUrl": "/api/files/file123/download" } ] }
```

### 7.4 `GET /api/files/latest`

Metadata for the most recent non-expired file, or `404` if none.

```bash
curl -fsS http://127.0.0.1:5678/api/files/latest
```

```json
{ "id": "file123", "fileName": "notes.txt", "sizeBytes": 1234, "expiresAt": "...", "downloadUrl": "/api/files/file123/download" }
```

### 7.5 `GET /api/files/:id`

Metadata for one file, or `404` if missing/expired.

```bash
curl -fsS http://127.0.0.1:5678/api/files/file123
```

### 7.6 `GET /api/files/:id/download`

Stream the file. The download uses `Content-Type: application/octet-stream` (independent of the client-uploaded type) and `Content-Disposition: attachment` with an **RFC5987** `filename*` parameter, so non-ASCII filenames survive. `curl -OJ` honors the server filename.

```bash
# -O  use server-provided name, -J honor Content-Disposition filename
curl -OJ -fsS http://127.0.0.1:5678/api/files/file123/download
# with auth in public mode:
curl -OJ -fsS -b cookies.txt http://127.0.0.1:5678/api/files/file123/download
```

Response headers:

```text
Content-Type: application/octet-stream
Content-Disposition: attachment; filename*=UTF-8''%E4%B8%AD%E6%96%87%E6%96%87%E4%BB%B6%E5%90%8D.txt
```

Files expire at `expiresAt` (configured `CLIPCLIP_FILE_TTL_HOURS`); expired files are excluded from reads and removed by cleanup.

---

## 8. `POST /api/login`

Start a session in public mode (no-op/unnecessary in local mode). Token compared with `timingSafeEqual`; failed attempts are rate-limited per IP (`429` after repeated failures).

```bash
curl -i -c cookies.txt -H 'content-type: application/json' \
  -d '{"token":"'"$CLIPCLIP_ACCESS_TOKEN"'"}' \
  http://127.0.0.1:5678/api/login
```

```json
{ "ok": true }
```

Sets `Set-Cookie: clipclip_session=<session>; HttpOnly; SameSite=Strict; Path=/; Max-Age=86400` (`Secure` under HTTPS). Wrong token → `401 {"error":"Invalid token"}`; rate-limited → `429 {"error":"Too many attempts"}`.

## 9. `POST /api/logout`

End the session: clears the server-side session and expires the cookie with `Max-Age=0`. Safe to call without a session.

```bash
curl -fsS -b cookies.txt -X POST http://127.0.0.1:5678/api/logout
```

```json
{ "ok": true }
```

---

## 10. Error responses

| Status | Meaning |
| --- | --- |
| `400` | Invalid JSON body, missing/non-string `content`, invalid passphrase length. |
| `401` | Unauthorized (missing/invalid session or Bearer in public mode). |
| `403` | Passphrase required / invalid passphrase on a paste. |
| `404` | Paste or file missing, expired, or already burned. |
| `413` | Payload exceeds the live content or upload limit. |
| `429` | Login or reveal rate limit exceeded (reveal includes `Retry-After: 60`). |
| `500` | Internal error (details are logged server-side without sensitive content). |

Errors are JSON: `{"error":"<message>"}`. See [SECURITY.md](SECURITY.md) for the full access/authentication contract and [ARCHITECTURE.md](ARCHITECTURE.md) for the component design.
