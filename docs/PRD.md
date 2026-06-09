# ClipClip Product Requirements Document

## Status

Draft for review.

## Assumptions

1. ClipClip is a self-hosted web application, not a native clipboard daemon.
2. The primary deployment target is a Docker container on a local network device, NAS, mini PC, or home server.
3. Devices should not need installed clients for the core experience; a modern browser is enough.
4. LAN use should work without account registration.
5. Optional internet access is expected through Cloudflare Tunnel or a reverse proxy.
6. The MVP should favor simple, reliable text and small-file workflows over automatic OS clipboard background sync.
7. File transfer limits should default to tens of MB, with an administrator-configurable maximum.
8. Security defaults matter because clipboard text may include secrets, tokens, addresses, or personal data.

Correct these assumptions before implementation if any are wrong.

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
- A paste can optionally be protected by a passphrase in a later iteration.

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

The first release should include:

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

## Post-MVP Scope

Potential follow-up features:

- Optional passphrase-protected paste links.
- Burn-after-reading paste and file links.
- Multiple named rooms.
- QR code for opening a room or paste from phone.
- Clipboard history with local retention policy.
- Optional admin password.
- Optional end-to-end encryption for paste contents.
- PWA install support.
- Dark mode.
- API and CLI for terminal workflows.
- WebDAV-like drop endpoint or curl-friendly upload.

## Product Decisions

### Deployment

ClipClip should be packaged as a single Docker image. A minimal Docker Compose file should be the primary documented path.

Expected environment variables:

```text
CLIPCLIP_HOST=0.0.0.0
CLIPCLIP_PORT=5678
CLIPCLIP_DATA_DIR=/data
CLIPCLIP_MAX_UPLOAD_MB=50
CLIPCLIP_PASTE_TTL_HOURS=24
CLIPCLIP_FILE_TTL_HOURS=24
CLIPCLIP_PUBLIC_BASE_URL=
```

### Access Model

MVP access is trusted-LAN by default. If exposed through Cloudflare Tunnel, users should be encouraged to put Cloudflare Access, a reverse proxy auth layer, or ClipClip's future admin auth in front of it.

### Data Retention

Live clipboard content persists until replaced, cleared, or expired by optional retention policy. Paste links and files expire according to configured TTL.

### Privacy

ClipClip should treat all clipboard data as sensitive. It should avoid unnecessary logging of clipboard text, paste content, filenames beyond operational metadata, or remote IPs unless needed for diagnostics.

## Recommended Tech Stack

Current MVP implementation:

- Node.js runtime
- Native HTTP server and filesystem APIs
- Server-Sent Events for live updates
- JSON metadata storage
- Local filesystem for file blobs
- Browser-native HTML, CSS, and JavaScript UI
- Node built-in test runner
- Single-stage Docker image

## Commands

Planned commands:

```text
Dev: npm run dev
Build: npm run build
Test: npm test
Lint: npm run lint
Docker build: docker build -t clipclip:local .
Docker run: docker run --rm -p 5678:5678 -v clipclip-data:/data clipclip:local
```

## Project Structure

Planned structure:

```text
docs/                 Product, architecture, threat model, ADRs
src/server/           HTTP API, SSE, storage, cleanup jobs
public/               Browser UI
tests/                Unit and integration tests
data/                 Local runtime data, ignored by Git
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

MVP testing should include:

- Unit tests for TTL, ID generation, filename sanitization, and validation.
- Integration tests for paste creation, file upload limits, file download, and cleanup.
- Smoke tests for live clipboard sync and API flows.
- Docker build verification.
- Manual mobile-width visual check before release.

Minimum pre-commit verification:

```text
npm run lint
npm test
npm run build
```

Release verification:

```text
docker build -t clipclip:local .
```

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

Ask first:

- Adding a database server dependency.
- Adding account login to MVP.
- Raising default upload limit above 50 MB.
- Adding external hosted services.
- Changing the project language or main framework.
- Making public internet exposure a default assumption.

Never:

- Commit secrets, tokens, private keys, or uploaded user files.
- Log paste contents or file contents.
- Store runtime uploads inside the repository.
- Depend on a third-party cloud service for core LAN behavior.
- Start implementation of a feature not represented in this PRD or a follow-up task.

## Success Criteria

MVP is complete when:

- A user can run ClipClip with Docker and open it from another LAN device.
- Two browser windows connected to the same live clipboard see text updates in real time.
- A user can create an immutable paste link and copy its contents elsewhere.
- A user can upload and download a file up to the configured limit.
- Paste and file expiration works.
- The app builds into a Docker image.
- The README explains LAN use and Cloudflare Tunnel exposure.
- Automated tests cover core server logic and at least one real-time browser flow.
- The project can be published as an open-source GitHub repository.

## Open Questions

1. Should the default live clipboard have a single global room, or should the first version support named rooms?
2. Should ClipClip require a simple admin password when exposed outside LAN, or should that be post-MVP?
3. Should paste content be stored encrypted at rest in MVP, or documented as a later feature?
4. Should uploaded files support burn-after-download in MVP?
5. Should the initial UI language be English only, Chinese only, or bilingual?
6. Which open-source license should we use: MIT, Apache-2.0, or AGPL-3.0?
