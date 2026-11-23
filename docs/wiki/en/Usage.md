# Usage

English · [简体中文](../zh/Usage.md)

## Live clipboard

The home page is the clipboard; typing auto-syncs to all devices. Buttons: Copy / Sync now / Clear (clears all devices).

## Share links

Enter text, set expiry / burn-after-read / passphrase, then copy the link. Default TTL 24h, max 7 days.

## File drop

Drag or choose a file to upload; 50 MB per file by default (`CLIPCLIP_MAX_UPLOAD_MB`). Files expire in 24h; the 10 most recent are kept.

```bash
curl -F "file=@notes.txt" http://<host>:5678/api/files
curl -OJ http://<host>:5678/api/files/<id>/download
```

## QR / PWA

Tap Scan and open with your phone camera. Add to Home Screen on supporting browsers (HTTPS or localhost).

Full API: [docs/API.md](https://github.com/zqs1qiwan/ClipClip/blob/main/docs/API.md).
