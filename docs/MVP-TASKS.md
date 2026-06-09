# ClipClip MVP Tasks

## Status

Initial implementation sequence.

## Task List

- [ ] Task: Initialize the application skeleton
  - Acceptance: The server and static client structure build locally and shared lint/test scripts exist.
  - Verify: `npm run build`
  - Files: `package.json`, `src/`, `public/`

- [ ] Task: Implement configuration loading and runtime directories
  - Acceptance: App reads environment variables, creates required data directories, and exposes normalized runtime config.
  - Verify: `npm test`
  - Files: `src/server/config.js`, `src/server/index.js`

- [ ] Task: Add file-backed state and storage primitives
  - Acceptance: The app initializes live clipboard, pastes, and file metadata on boot.
  - Verify: `npm test`
  - Files: `src/server/storage.js`, `tests/server/storage.test.js`

- [ ] Task: Build the health endpoint and base HTTP server
  - Acceptance: `/api/health` responds with status and version metadata.
  - Verify: `npm test`
  - Files: `src/server/app.js`

- [ ] Task: Implement live clipboard HTTP and SSE flow
  - Acceptance: `GET /api/live`, `PUT /api/live`, and `/api/events` keep two clients in sync for room `main`.
  - Verify: `npm test`
  - Files: `src/server/app.js`, `public/app.js`, `public/index.html`

- [ ] Task: Implement immutable paste creation and read-only view
  - Acceptance: Users can create a paste with optional TTL and view it at a read-only route.
  - Verify: `npm test`
  - Files: `src/server/app.js`, `public/app.js`, `public/index.html`

- [ ] Task: Implement small file upload, metadata, and download
  - Acceptance: Users can upload one file within the configured limit and download it from another device.
  - Verify: `npm test`
  - Files: `src/server/app.js`, `src/server/storage.js`, `public/app.js`, `public/index.html`

- [ ] Task: Add expiration cleanup for pastes and files
  - Acceptance: Expired data is cleaned up on a timer without breaking active requests.
  - Verify: `npm test`
  - Files: `src/server/index.js`, `src/server/storage.js`

- [ ] Task: Build the MVP UI shell for mobile and desktop
  - Acceptance: Live clipboard, paste creation, and file upload are all usable from the first screen or a minimal route set.
  - Verify: `npm run build`
  - Files: `public/*`

- [ ] Task: Package the app for Docker
  - Acceptance: A production image builds and runs with persistent `/data` storage.
  - Verify: `docker build -t clipclip:local .`
  - Files: `Dockerfile`, `.dockerignore`, `docker-compose.yml`, `README.md`
