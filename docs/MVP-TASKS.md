# ClipClip MVP Tasks

## Status

Initial implementation sequence.

## Task List

- [ ] Task: Initialize the monorepo-style application skeleton
  - Acceptance: Server and client packages build locally, TypeScript is configured, and shared lint/test scripts exist.
  - Verify: `npm run build`
  - Files: `package.json`, `tsconfig*.json`, `src/`, `vite.config.*`

- [ ] Task: Implement configuration loading and runtime directories
  - Acceptance: App reads environment variables, creates required data directories, and exposes normalized runtime config.
  - Verify: `npm test`
  - Files: `src/server/config/*`, `src/server/lib/*`

- [ ] Task: Add SQLite schema and storage primitives
  - Acceptance: The app initializes tables for live clipboard, pastes, and files on boot.
  - Verify: `npm test`
  - Files: `src/server/db/*`, `tests/server/db/*`

- [ ] Task: Build the health endpoint and base Fastify server
  - Acceptance: `/api/health` responds with status and version metadata.
  - Verify: `npm test`
  - Files: `src/server/app.ts`, `src/server/routes/health.ts`

- [ ] Task: Implement live clipboard HTTP and WebSocket flow
  - Acceptance: `GET /api/live`, `PUT /api/live`, and `/ws` keep two clients in sync for room `main`.
  - Verify: `npm test` and `npm run test:e2e`
  - Files: `src/server/routes/live.ts`, `src/server/ws/*`, `src/client/features/live/*`

- [ ] Task: Implement immutable paste creation and read-only view
  - Acceptance: Users can create a paste with optional TTL and view it at a read-only route.
  - Verify: `npm test` and `npm run test:e2e`
  - Files: `src/server/routes/pastes.ts`, `src/client/features/paste/*`

- [ ] Task: Implement small file upload, metadata, and download
  - Acceptance: Users can upload one file within the configured limit and download it from another device.
  - Verify: `npm test` and `npm run test:e2e`
  - Files: `src/server/routes/files.ts`, `src/server/services/files/*`, `src/client/features/files/*`

- [ ] Task: Add expiration cleanup for pastes and files
  - Acceptance: Expired data is cleaned up on a timer without breaking active requests.
  - Verify: `npm test`
  - Files: `src/server/jobs/*`, `tests/server/jobs/*`

- [ ] Task: Build the MVP UI shell for mobile and desktop
  - Acceptance: Live clipboard, paste creation, and file upload are all usable from the first screen or a minimal route set.
  - Verify: `npm run build` and `npm run test:e2e`
  - Files: `src/client/*`

- [ ] Task: Package the app for Docker
  - Acceptance: A production image builds and runs with persistent `/data` storage.
  - Verify: `docker build -t clipclip:local .`
  - Files: `Dockerfile`, `.dockerignore`, `docker-compose.yml`, `README.md`

