# ClipClip

ClipClip is a self-hosted web clipboard for live text sync, immutable paste links, and small file drops.

## MVP Features

- Live clipboard sync across open browser tabs and devices
- Immutable paste links with expiration
- Small file upload and download
- Single-container Docker deployment

## Run locally

```bash
node src/server/index.js
```

## Run with Docker

```bash
docker compose up --build -d
```

The app listens on port `5678` by default.

## Environment variables

```text
CLIPCLIP_HOST=0.0.0.0
CLIPCLIP_PORT=5678
CLIPCLIP_DATA_DIR=/data
CLIPCLIP_MAX_UPLOAD_MB=50
CLIPCLIP_PASTE_TTL_HOURS=24
CLIPCLIP_FILE_TTL_HOURS=24
```

## Notes

- MVP is designed for trusted-LAN use first.
- If you expose it through Cloudflare Tunnel, put access control in front of it.
- Runtime data is stored under `data/` and should not be committed.
- Advanced access setup is intentionally manual in MVP. Reverse proxy, router DNS, and no-port access should be chosen by the operator based on the host environment.
- A local DNS name such as `clip.clip` can point to the router IP, but DNS alone does not carry port `5678`. Without a reverse proxy, the direct LAN URL is `http://clip.clip:5678`.
- Product interaction notes live in `docs/PRODUCT-INSIGHTS.md` and can later be expanded into GitHub Wiki usage guides.
