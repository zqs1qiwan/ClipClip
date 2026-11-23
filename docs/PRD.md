# ClipClip Product Requirements Document

## Status

**Release candidate / v0.1.0.** MVP, dual-mode security, iteration-2 features (QR, PWA, passphrase/burn-after-read, curl-friendly multipart API) and the paper-and-ink brand rebuild are complete and verified on the target router with real Docker (local + public mode E2E). Full suite: **114/114 tests passing**. This document is the source of truth for the shipped product. See [ROADMAP.md](ROADMAP.md) for the prioritized backlog, [BRAND.md](BRAND.md) for the visual system, and [tests/VERIFICATION.md](../tests/VERIFICATION.md) for verification evidence.

## Assumptions

1. ClipClip is a self-hosted web application, not a native clipboard daemon.
2. The primary deployment target is a Docker container on a local network device, NAS, mini PC, or home server.
3. Devices should not need installed clients for the core experience; a modern browser is enough.
4. LAN use should work without account registration.
5. Optional internet access is expected through Cloudflare Tunnel or a reverse proxy.
6. The MVP should favor simple, reliable text and small-file workflows over automatic OS clipboard background sync.
7. File transfer limits should default to tens of MB, with an administrator-configurable maximum.
8. Security defaults matter because clipboard text may include secrets, tokens, addresses, or personal data.

These assumptions held for v0.1.0. Scope additions beyond them — dual-mode access and the paper-and-ink brand rebuild — were decided explicitly (see Product Decisions and Open Questions).

## Objective

ClipClip is a lightweight, self-hosted web clipboard for moving text and small files between devices without installing apps.

It should solve three related problems:

1. A user copies text on one device and wants another device to see it quickly through a shared browser page.
2. A user wants to create a fixed paste link that another device can open, copy from, and optionally expire or burn after reading.
3. A user wants to drop a small file from one device and download it from another device without sending it through a third-party cloud service.

Success means a user can run one Docker command, open ClipClip from multiple devices, and reliably move text or files within the local network in under a minute.

## Target Users

- People using Windows, macOS, Linux, iOS, Android, and tablets in the same local network.
- Developers and power users who frequently move commands, snippets, URLs, tokens, logs, and small files between machines.
- Home lab and NAS users who prefer Docker-first self-hosted tools.
- Users who want an optional Cloudflare Tunnel path for remote access without installing a full VPN.

## Non-Goals

- Native background clipboard sync in MVP.
- Large-file transfer comparable to Syncthing, Nextcloud, or file servers.
- Multi-user enterprise permissions in MVP.
- Public pastebin hosting for anonymous internet users.
- Rich document editing comparable to Etherpad.
- Mobile app clients.

## Core Use Cases

### Live Clipboard

As a user, I can open the same ClipClip room on multiple devices and see the latest shared text update in near real time.

Acceptance criteria:

- A text box updates across connected browsers without manual refresh.
- Users can copy the current text with one button.
- Users can clear the live clipboard.
- The UI makes it obvious when the page is connected or disconnected.
- The latest live clipboard survives a page refresh.

### Read-Only Paste Link

As a user, I can create a paste link from current text and send or open it elsewhere.

Acceptance criteria:

- A paste link is immutable after creation.
- A paste can be copied from a read-only page.
- A paste can have an optional expiration time.
- A paste can optionally burn after first successful view.
- A paste can optionally be protected by a passphrase (implemented in iteration 2; see [API.md](API.md)).

### Small File Drop

As a user, I can upload a small file and download it from another device.

Acceptance criteria:

- The default maximum upload size is configurable and initially set to 50 MB.
- Uploaded files have an expiration time.
- Users can copy a download link.
- Dangerous filenames are sanitized before storage and download.
- Upload progress and failure states are visible.

### Device-Friendly Web UI

As a user, I can use ClipClip comfortably from phone, tablet, and desktop browsers.

Acceptance criteria:

- The first screen is the usable clipboard, not a marketing landing page.
- The UI works at mobile widths.
- Common actions use clear buttons and icons.
- Text never overlaps controls on small screens.
- Clipboard and file actions remain reachable without horizontal scrolling.

## MVP Scope

The v0.1.0 release includes:

- Docker-first single service.
- Web UI for live clipboard text.
- Server-Sent Events real-time updates.
- Immutable paste links.
- Expiration for paste links.
- Small file upload and download.
- Configurable file size limit.
- Basic local admin settings through environment variables.
- JSON file-backed storage.
- Health endpoint for container checks.
- README with Docker Compose and Cloudflare Tunnel notes.
- Dual-mode access control: zero-friction local mode and secure-by-default public mode.
- Accessible light/dark UI with bilingual (zh/en) copy.

## Post-MVP Scope

Features below marked **implemented in iteration 2** were promoted from candidates and shipped per [ITERATION-2.md](ITERATION-2.md); the HTTP surface is documented in [API.md](API.md). Remaining items stay as candidates.

- Optional passphrase-protected paste links. — **implemented in iteration 2**
- Burn-after-reading paste and file links. — **implemented in iteration 2** (paste; files remain a candidate)
- Multiple named rooms. *(still a candidate; MVP keeps a single `main` room)*
- QR code for opening a room or paste from phone. — **implemented in iteration 2**
- Clipboard history with local retention policy. *(out of scope — intentionally not implemented; keeps the single-value clipboard decision)*
- Optional admin password (distinct from the shipped dual-mode access token). *(still a candidate)*
- Optional end-to-end encryption for paste contents. *(still a candidate)*
- PWA install support. — **implemented in iteration 2**
- API and CLI for terminal workflows. — **implemented in iteration 2** (`curl`-friendly API + [API.md](API.md))
- WebDAV-like drop endpoint or curl-friendly upload. — **curl-friendly upload implemented in iteration 2** (`multipart/form-data` + raw body); a WebDAV-like endpoint remains a candidate.

## Product Decisions

### Deployment

ClipClip ships as a single Docker image; a minimal Docker Compose file is the primary documented path.

Runtime environment variables (read by `src/server/config.js`; defaults match the current build):

| Variable | Default | Purpose |
| --- | --- | --- |
| `CLIPCLIP_HOST` | `0.0.0.0` | Listen address inside the container/process |
| `CLIPCLIP_PORT` | `5678` | Listen port |
| `CLIPCLIP_DATA_DIR` | `/data` (container), `./data` (local) | Data root: `state/`, `uploads/`, `tmp/` |
| `CLIPCLIP_MAX_UPLOAD_MB` | `50` | Per-file upload limit |
| `CLIPCLIP_RECENT_FILES_LIMIT` | `10` | Number of recent files kept |
| `CLIPCLIP_PASTE_TTL_HOURS` | `24` | Default paste expiration |
| `CLIPCLIP_PASTE_TTL_MAX_HOURS` | `168` | Upper bound for a client-supplied `expiresInHours` (7 days) |
| `CLIPCLIP_PASTE_CONTENT_LIMIT` | `524288` | Max paste body (bytes) |
| `CLIPCLIP_MAX_PASTE_PASSPHRASE_LEN` | `128` | Max passphrase length (1–128) |
| `CLIPCLIP_REVEAL_RATE_LIMIT` | `5` | Failed reveals per `IP + pasteId` per window |
| `CLIPCLIP_REVEAL_RATE_WINDOW_MS` | `60000` | Reveal rate-limit window (ms) |
| `CLIPCLIP_FILE_TTL_HOURS` | `24` | File expiration |
| `CLIPCLIP_CLEANUP_INTERVAL_MS` | `60000` | Expired-data cleanup interval |
| `CLIPCLIP_LIVE_CONTENT_LIMIT` | `100000` | Max live clipboard payload (bytes) |
| `CLIPCLIP_MAX_SSE_CLIENTS` | `100` | Concurrent SSE connection cap |
| `CLIPCLIP_SSE_HEARTBEAT_MS` | `25000` | SSE keep-alive interval |
| `CLIPCLIP_SSE_IDLE_TIMEOUT_MS` | `300000` | Close idle SSE connections after this long |
| `CLIPCLIP_TRUST_PROXY` | `0` | `1`/`true` = derive client IP from `X-Forwarded-For` for rate limiting; only behind a trusted proxy/Tunnel that overwrites XFF |
| `CLIPCLIP_SESSION_TTL_SECONDS` | `86400` | Session cookie / server session lifetime (seconds) |
| `CLIPCLIP_PUBLIC_BASE_URL` | empty | Reserved for absolute link generation; not used by the current server |
| `CLIPCLIP_ACCESS_TOKEN` | unset/empty | Public-mode token: empty = local mode, non-empty = public mode (frozen at startup; never commit it) |

Deployment-only variables (consumed by `docker-compose.yml`, not passed into the container):

| Variable | Default | Purpose |
| --- | --- | --- |
| `CLIPCLIP_BIND_IP` | `0.0.0.0` | Host bind address for the published port; set `127.0.0.1` in public mode |
| `CLIPCLIP_HOST_PORT` | `5678` | Host port for the published port |

Healthcheck overrides: `CLIPCLIP_HEALTHCHECK_HOST` (default `127.0.0.1`) and `CLIPCLIP_HEALTHCHECK_TIMEOUT_MS` (default `4000`). See the README environment table and [SECURITY.md](SECURITY.md) for the proxy-trust safety conditions.

### Access Model

ClipClip uses a **dual-mode access model** driven by a single setting, `CLIPCLIP_ACCESS_TOKEN`:

- **Local mode (default, no token)** — optimized for zero-friction LAN use. There is no login wall, no token prompt, and no login UI; all features work immediately. This is the trusted-LAN path described above and remains the primary experience for home/router/NAS users.
- **Public mode (token set)** — optimized for "secure by default" exposure. All data endpoints, the SSE stream, and pages require token login before any content is served; unauthorized requests receive `401`. A crypto-random session is held in an `HttpOnly; SameSite=Strict` cookie (with `Secure` under HTTPS), with `timingSafeEqual` token comparison and per-IP failed-login rate limiting.

This is a deliberate scope addition to the original trusted-LAN-only MVP: local users keep the original zero-friction behavior, while anyone publishing ClipClip to the internet gets enforced authentication rather than relying solely on operator-configured proxy rules. An access-control layer (Cloudflare Access or reverse-proxy auth) is still recommended in front of public mode; see [SECURITY.md](SECURITY.md) and [ARCHITECTURE.md](ARCHITECTURE.md).

### Data Retention

Live clipboard content persists until replaced, cleared, or expired by optional retention policy. Paste links and files expire according to configured TTL.

### Privacy

ClipClip should treat all clipboard data as sensitive. It should avoid unnecessary logging of clipboard text, paste content, filenames beyond operational metadata, or remote IPs unless needed for diagnostics.

## Tech Stack

Current implementation (v0.1.0):

- Node.js 22 runtime, zero runtime dependencies (`node:http`, `node:fs`, `node:crypto`)
- Native HTTP server and filesystem APIs; single-flight JSON state writes with atomic rename
- Server-Sent Events for live clipboard and file updates (with heartbeat and client cap)
- `src/server/auth.js`: dual-mode token auth, `timingSafeEqual`, in-memory sessions, rate limits
- JSON metadata storage plus local filesystem for file blobs
- Browser-native HTML, CSS, and ESM JavaScript UI, split into `public/js/*` modules
- QR encoder (`public/js/qr.js`) and PWA service worker (`public/sw.js`), both zero-dependency
- Paper-and-ink brand assets in `public/brand/` (SVG lockup, mark, icon, OG image)
- Node built-in test runner (`node --test`)
- Single-stage Docker image on `node:22-alpine`, hardened (non-root, read-only root, healthcheck)

## Commands

Actual commands (see `package.json`):

```text
Dev:              npm run dev
Start:            npm start
Build check:      npm run build
Lint check:       npm run lint
Test:             npm test
Verify all:       npm run verify        # lint + build + test
Docker build:     npm run docker:build  # docker build -t clipclip:0.1.0 .
Docker up:        npm run docker:up     # docker compose up --build -d
Docker down:      npm run docker:down   # docker compose down
Docker logs:      npm run docker:logs   # docker compose logs -f --tail=100
```

## Project Structure

Actual structure:

```text
docs/                 PRD, API, ARCHITECTURE, SECURITY, BRAND, ITERATION-2,
                      MVP-TASKS, ROADMAP, PRODUCT-INSIGHTS
src/server/           app.js, index.js, config.js, storage.js, auth.js
                      (HTTP API, SSE, storage/cleanup, access control)
public/               Browser UI: index.html, styles.css, app.js, button-feedback.js,
                      sw.js, manifest.json, icon.svg
public/js/            ESM modules: api, auth, events, files, format, i18n, live,
                      paste, qr, qr-modal, pwa, state, ui, views, brand
public/brand/         logo.svg, logo-mark.svg, logo-lockup.svg, icon.svg,
                      og-image.svg, README.md
public/lib/           clipboard.js
scripts/              build-check.js, lint-check.js, healthcheck.js
tests/                server/ and client/ suites, VERIFICATION.md
data/                 Local runtime data (gitignored): state/, uploads/, tmp/
Dockerfile            Production image (non-root, healthcheck)
docker-compose.yml    Single-container deployment (hardened, /data volume)
LICENSE               MIT
```

## Code Style

Use explicit names, small modules, and validation at boundaries.

Example style:

```js
function isExpired(expiresAt) {
  return Boolean(expiresAt) && new Date(expiresAt).getTime() <= Date.now();
}
```

Conventions:

- Validate every external input.
- Keep server and browser code clearly separated.
- Avoid logging sensitive content.
- Keep UI strings short and direct.
- Use environment variables for deployment settings.

## Testing Strategy

The v0.1.0 suite has **114 passing tests** across server and client suites (`node --test`), including:

- Server: storage (TTL/expiration, passphrase hashing, burn-once concurrency, corrupt-state recovery, concurrent writes), HTTP app (health, live + SSE snapshots/heartbeat/client cap, pastes reveal/rate limits, uploads raw + multipart with RFC5987, dual-mode auth, cookie/Bearer, headers, malformed-input resilience).
- Client: clipboard/feedback, i18n, format, state machines, API error mapping, iteration-2 logic (reveal, QR target URL), QR encoder, service-worker cache policy, brand contract (DOM IDs, i18n keys), accessibility (ARIA semantics, alt text, no emoji-only labels).
- Build gates: `scripts/build-check.js` (required files, HTML references, ESM imports) and `scripts/lint-check.js` (tabs + `node --check` syntax).
- Real-router E2E: local-mode and public-mode HTTP checks against a real Docker container on `192.168.2.1`, plus captain-run browser (CDP) checks of the rebranded UI. Evidence and the full curl matrix live in [tests/VERIFICATION.md](../tests/VERIFICATION.md).

Pre-commit verification:

```text
npm run verify    # lint + build + test
```

Release verification:

```text
npm run docker:build
docker compose up -d
# health + smoke checks per README / tests/VERIFICATION.md
```

Note: automated real-time coverage is at the server layer (SSE snapshot/heartbeat/client-cap tests in `tests/server/app.test.js`); the two-window browser sync is exercised in the captain's E2E/CDP checks rather than a committed browser-automation test.

## Security Requirements

- Generate unguessable paste and file IDs.
- Enforce upload size limits server-side.
- Sanitize filenames.
- Prevent path traversal for file reads and writes.
- Avoid logging clipboard text, paste content, or file contents.
- Set conservative HTTP security headers.
- Use safe content types for downloads.
- Make CORS disabled or same-origin by default.
- Provide clear guidance for Cloudflare Tunnel exposure.
- Document that the MVP is trusted-LAN unless placed behind access control.

## Performance Requirements

- Live text updates should appear on other connected browsers in under 500 ms on a healthy LAN.
- The first page load should stay lightweight enough for mobile browsers.
- File uploads should stream or otherwise avoid loading large files entirely into memory when practical.
- Cleanup of expired records should not block live clipboard updates.

## Boundaries

Always:

- Keep the first screen usable.
- Validate inputs at API boundaries.
- Treat clipboard data as sensitive.
- Keep Docker deployment simple.
- Update this PRD when scope changes.
- Run available tests before commits.

Ask first (future changes still require sign-off; the first two were decided during development and are now shipped):

- Adding a database server dependency. *(still requires sign-off)*
- ~~Adding account login to MVP.~~ **Decided:** dual-mode token access shipped in v0.1.0 (see Access Model); full multi-user accounts remain out of scope.
- Raising default upload limit above 50 MB.
- Adding external hosted services.
- Changing the project language or main framework.
- Making public internet exposure a default assumption. *(local mode remains the default)*
- Rebranding or changing the visual design system. **Decided:** paper-and-ink identity shipped in v0.1.0 per [BRAND.md](BRAND.md); further redesign requires sign-off.

Never:

- Commit secrets, tokens, private keys, or uploaded user files.
- Log paste contents or file contents.
- Store runtime uploads inside the repository.
- Depend on a third-party cloud service for core LAN behavior.
- Start implementation of a feature not represented in this PRD or a follow-up task.

## Success Criteria

Release v0.1.0 acceptance criteria — all met:

- ✓ A user runs ClipClip with Docker and opens it from another LAN device (verified on the target router).
- ✓ Two browser windows on the same live clipboard see text updates in real time (SSE server tests + captain CDP/E2E check).
- ✓ A user creates an immutable paste link and copies its contents elsewhere.
- ✓ A user uploads and downloads a file up to the configured limit (raw body and `multipart/form-data`; RFC5987 filenames).
- ✓ Paste and file expiration works.
- ✓ Dual-mode access: local mode is zero-friction; public mode requires auth and returns `401` for protected data.
- ✓ Iteration-2 features: QR pairing, PWA install, passphrase-protected and burn-after-read pastes, curl-friendly API documented in [API.md](API.md).
- ✓ Paper-and-ink brand rebuild applied across the UI and README per [BRAND.md](BRAND.md).
- ✓ The app builds into a hardened Docker image with a healthcheck.
- ✓ README documents LAN use, both modes, and Cloudflare Tunnel exposure.
- ✓ 114/114 automated tests pass; real-router Docker E2E (local + public) passes — see [tests/VERIFICATION.md](../tests/VERIFICATION.md).
- ✓ Project is publishable as an open-source MIT repository ([LICENSE](../LICENSE)).

## Open Questions

Decided items (resolved during implementation):

1. ~~Should the default live clipboard have a single global room, or named rooms?~~ **Decided:** single default room `main` for MVP; named rooms remain post-MVP.
2. ~~Should ClipClip require a simple admin password when exposed outside LAN?~~ **Decided:** dual-mode — zero-friction local mode by default; a token-based gate (public mode) when `CLIPCLIP_ACCESS_TOKEN` is set. A full admin password system remains post-MVP.
5. ~~Should the initial UI language be English only, Chinese only, or bilingual?~~ **Decided:** bilingual (zh/en) with a language switch.
6. ~~Which open-source license?~~ **Decided:** MIT (see `package.json`).

Decided for v0.1.0 (deferred, no longer open):

3. ~~Should paste content be stored encrypted at rest in v0.1.0?~~ **Decided: no — post-MVP / not a v0.1.0 goal.** Passphrase protection stores only an unsalted SHA-256 hash and is not at-rest encryption; true at-rest/E2E encryption remains a candidate.
4. ~~Should uploaded files support burn-after-download in v0.1.0?~~ **Decided: no — post-MVP / not a v0.1.0 goal.** Paste burn-after-read shipped in iteration 2; file burn-after-download remains a candidate.
