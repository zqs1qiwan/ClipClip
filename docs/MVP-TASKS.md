# ClipClip MVP Tasks

## Status

MVP implementation complete. All original tasks are checked off; the dual-mode security/UI refactor round and the iteration-2 feature expansion are tracked at the end. See [ROADMAP.md](ROADMAP.md) for the follow-up backlog.

## Task List

- [x] Task: Initialize the application skeleton
  - Acceptance: The server and static client structure build locally and shared lint/test scripts exist.
  - Verify: `npm run build`
  - Files: `package.json`, `src/`, `public/`

- [x] Task: Implement configuration loading and runtime directories
  - Acceptance: App reads environment variables, creates required data directories, and exposes normalized runtime config.
  - Verify: `npm test`
  - Files: `src/server/config.js`, `src/server/index.js`

- [x] Task: Add file-backed state and storage primitives
  - Acceptance: The app initializes live clipboard, pastes, and file metadata on boot.
  - Verify: `npm test`
  - Files: `src/server/storage.js`, `tests/server/storage.test.js`

- [x] Task: Build the health endpoint and base HTTP server
  - Acceptance: `/api/health` responds with status and version metadata.
  - Verify: `npm test`
  - Files: `src/server/app.js`

- [x] Task: Implement live clipboard HTTP and SSE flow
  - Acceptance: `GET /api/live`, `PUT /api/live`, and `/api/events` keep two clients in sync for room `main`.
  - Verify: `npm test`
  - Files: `src/server/app.js`, `public/app.js`, `public/index.html`

- [x] Task: Implement immutable paste creation and read-only view
  - Acceptance: Users can create a paste with optional TTL and view it at a read-only route.
  - Verify: `npm test`
  - Files: `src/server/app.js`, `public/app.js`, `public/index.html`

- [x] Task: Implement small file upload, metadata, and download
  - Acceptance: Users can upload one file within the configured limit and download it from another device.
  - Verify: `npm test`
  - Files: `src/server/app.js`, `src/server/storage.js`, `public/app.js`, `public/index.html`

- [x] Task: Add expiration cleanup for pastes and files
  - Acceptance: Expired data is cleaned up on a timer without breaking active requests.
  - Verify: `npm test`
  - Files: `src/server/index.js`, `src/server/storage.js`

- [x] Task: Build the MVP UI shell for mobile and desktop
  - Acceptance: Live clipboard, paste creation, and file upload are all usable from the first screen or a minimal route set.
  - Verify: `npm run build`
  - Files: `public/*`

- [x] Task: Package the app for Docker
  - Acceptance: A production image builds and runs with persistent `/data` storage.
  - Verify: `docker build -t clipclip:local .`
  - Files: `Dockerfile`, `.dockerignore`, `docker-compose.yml`, `README.md`

## Follow-up Round: Dual-Mode Security & UI/UX Refactor

Added scope after the initial MVP; checked items are implemented in this round (see [ROADMAP.md](ROADMAP.md) "实施记录").

- [x] Task: P0 stability and data-safety fixes
  - Acceptance: Malformed URLs / missing blobs no longer crash the process; persist is serialized with atomic rename; non-object bodies and non-string `content` return `400`; expired files are filtered from latest/recent/SSE/health.
  - Verify: `npm test` (backend regression tests, t13)
  - Files: `src/server/app.js`, `src/server/storage.js`

- [x] Task: Dual-mode access control (local / public)
  - Acceptance: No `CLIPCLIP_ACCESS_TOKEN` → local mode, zero-friction LAN use; token set → public mode gates all data endpoints, SSE and pages, with `POST /api/login`, `timingSafeEqual`, HttpOnly/SameSite session cookie, Bearer support and per-IP login rate limiting; unauthorized returns `401`.
  - Verify: `npm test` (dual-mode tests, t13)
  - Files: `src/server/auth.js`, `src/server/config.js`, `src/server/app.js`

- [x] Task: Security response headers and safe downloads
  - Acceptance: CSP + HSTS + COOP/COEP/CORP + Permissions-Policy + nosniff + X-Accel-Buffering applied; downloads forced to `application/octet-stream` with RFC5987 `filename*`.
  - Verify: `npm test` (header/download tests, t13)
  - Files: `src/server/app.js`

- [x] Task: Frontend reliability and UI/UX simplification
  - Acceptance: No "dead shell" on initial fetch failure; expired paste shows a dedicated error page; SSE no longer overwrites dirty input; debounced auto-save; accessible dark mode (≥4.5:1); no horizontal scroll at 320/375px; aria-live feedback; bilingual copy retained; login screen shown only in public mode.
  - Verify: static review + `node --check` (browser runtime check on target host)
  - Files: `public/*`

- [x] Task: Container hardening, health check and build gate
  - Acceptance: Dockerfile/compose health check and runtime hardening; build-check covers all imported client modules; README documents both modes (README owned by ops).
  - Verify: `docker compose config -q`, `docker build`, `npm run build`, `npm run lint`
  - Files: `Dockerfile`, `docker-compose.yml`, `.dockerignore`, `scripts/`

- [x] Task: Full regression verification on target host
  - Acceptance: All 114 backend/frontend tests pass; CDP screenshots at 320/375px light/dark confirmed no horizontal scroll; dual-mode end-to-end (local frictionless, public 401 + login) verified; Docker image built and container healthy on 192.168.2.1.
  - Verify: `npm test`, `tests/VERIFICATION.md` sections D/F, captain CDP + router E2E
  - Files: `tests/`, `scripts/`

## Iteration 2: Feature Expansion

Per [ITERATION-2.md](ITERATION-2.md). Checked items are implemented in this round (target state; final implementation is authoritative — a follow-up review will align docs and code). Router real-device testing is intentionally left unchecked until the captain verifies.

- [x] Task: QR code pairing
  - Acceptance: Self-contained `public/js/qr.js` renders a QR of the current origin URL (no token/clipboard content); accessible modal (role=dialog, ESC/overlay close, focus management), ≥44px targets, no overflow at 320/375px; public-mode scan still requires login.
  - Verify: `npm test`, static review + target-host screenshots
  - Files: `public/**`

- [x] Task: PWA add-to-home-screen
  - Acceptance: `public/manifest.json` + `icon.svg` + `sw.js`; SW caches static assets only, never `/api/*`; SW registers only in secure contexts (HTTPS/localhost) with the HTTP-LAN limitation documented.
  - Verify: `npm test`, static review
  - Files: `public/**`

- [x] Task: burn-after-read + passphrase pastes
  - Acceptance: `POST /api/pastes` supports `burnAfterRead`/`passphrase`/`expiresInHours`; passphrase stored only as SHA-256 hash; `GET` of a protected paste returns 403 with no content; `POST /api/pastes/:id/reveal` uses constant-time compare; first successful read deletes the paste atomically; wrong passphrase 403, burned/expired 404.
  - Verify: `npm test` (burn/passphrase tests)
  - Files: `src/server/`, `tests/server/`

- [x] Task: curl-friendly multipart upload + API documentation
  - Acceptance: `POST /api/files` accepts `multipart/form-data` (`-F "file=@..."`) with the same response shape as raw body and the same size limits; `docs/API.md` covers all endpoints with curl examples; README links API.md.
  - Verify: `npm test` (multipart tests), grep links
  - Files: `src/server/`, `tests/server/`, `docs/API.md`, `README.md`

- [x] Task: Router real-device E2E test of iteration-2 features
  - Acceptance: On the target router (192.168.2.1, 2026-11-23), verified end-to-end: QR button+modal+SVG (no token), PWA assets with correct MIME, burn-after-read (first read 200 / second 404), passphrase (GET 403 / wrong 403 / correct reveal 200, no plaintext hash in state), multipart `curl -F` with Chinese filename + RFC5987 download, and public-mode 401 on new endpoints. All passed; 97/97 automated tests green.
  - Verify: captain E2E on `192.168.2.1`; see `tests/VERIFICATION.md` section F
  - Files: (verification only)
