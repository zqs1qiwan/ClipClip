# ClipClip · Home

English · [简体中文](../zh/Home.md)

A self-hosted web clipboard: live text sync, immutable share links, and small file drops. No client app — just a browser.

## Quick start

```bash
mkdir -p /srv/clipclip/data && chown -R 1000:1000 /srv/clipclip/data
docker run -d --name clipclip --restart unless-stopped \
  -p 5678:5678 -v /srv/clipclip/data:/data \
  zqs1qiwan/clipclip:latest
```

Open `http://<host-ip>:5678`. Image: [zqs1qiwan/clipclip](https://hub.docker.com/r/zqs1qiwan/clipclip) (`:latest` newest / `:0.1.0` pinned).

## Features

- **Live clipboard** — syncs text across devices; typing auto-saves.
- **Share links** — immutable, with expiry / burn-after-read / passphrase.
- **File drop** — drag-and-drop upload, cross-device download; curl supported.
- **QR pairing** — tap Scan to open on your phone.
- **PWA** — Add to Home Screen (HTTPS or localhost).

## Two modes

| | Local (default) | Public |
| --- | --- | --- |
| Enable | no token | set `CLIPCLIP_ACCESS_TOKEN` |
| Login | none | token required |
| Use | trusted LAN | internet (auth proxy required) |

## Docs

[Installation](Installation.md) · [Usage](Usage.md) · [Security](Security.md) · [FAQ](FAQ.md)
