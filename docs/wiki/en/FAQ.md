# FAQ

English · [简体中文](../zh/FAQ.md)

**Can't open**: `docker ps`; check port 5678 / firewall; `curl http://<host>:5678/api/health`.

**EACCES**: `chown -R 1000:1000 /srv/clipclip/data`.

**QR shows wrong URL**: QR encodes the current page URL; open from the public URL first when behind a proxy.

**Login prompt in public mode**: expected — enter the token. If you never set one, check env vars.

**Where is data**: `/data` (state JSON + uploads); back up the whole directory.

**Max attachment size**: 50 MB default; `CLIPCLIP_MAX_UPLOAD_MB` to change.

**Browsers**: modern desktop/mobile; PWA install needs HTTPS/localhost.
