# Installation

English · [简体中文](../zh/Installation.md)

## Docker (recommended)

Image `zqs1qiwan/clipclip:latest` (or pinned `:0.1.0`), Linux amd64.

```bash
mkdir -p /srv/clipclip/data && chown -R 1000:1000 /srv/clipclip/data
docker run -d --name clipclip --restart unless-stopped \
  -p 5678:5678 -v /srv/clipclip/data:/data \
  zqs1qiwan/clipclip:latest
```

Verify: `curl -fsS http://127.0.0.1:5678/api/health`.

## Docker Compose

Grab [docker-compose.yml](https://raw.githubusercontent.com/zqs1qiwan/ClipClip/main/docker-compose.yml), `cp .env.example .env`, then `docker compose up -d`.

## Run locally

Node.js 22+: `git clone https://github.com/zqs1qiwan/ClipClip.git && cd ClipClip && npm start`.

## Is the volume necessary?

**Recommended**: `-v` keeps data (`/data` state JSON + uploads) across container removal/upgrades. Without a volume it still runs, but data is lost with the container. Bind mounts need `chown -R 1000:1000` (non-root container); a named volume `-v clipclip-data:/data` needs no chown. Backup = archive `/srv/clipclip/data`.

## Public exposure

Set a strong `CLIPCLIP_ACCESS_TOKEN`, put Cloudflare Access / an auth proxy in front, enable `CLIPCLIP_TRUST_PROXY=1` only behind a trusted proxy. See [Security](Security.md).
