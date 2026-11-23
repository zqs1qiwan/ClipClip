# Security / Two modes

English · [简体中文](../zh/Security.md)

ClipClip defaults to a trusted LAN with zero setup and no login. Public access requires public mode.

| | Local (default) | Public |
| --- | --- | --- |
| Enable | no token | set `CLIPCLIP_ACCESS_TOKEN` |
| Data access | any LAN client | token login, 401 otherwise |

Public checklist:

1. Strong token: `openssl rand -base64 32`.
2. Put Cloudflare Access / an auth proxy in front; never expose the port directly.
3. Set `CLIPCLIP_TRUST_PROXY=1` only behind a trusted proxy.

Protected pastes store only a SHA-256 hash; reveal is rate-limited; burn-after-read deletes atomically; downloads are forced to octet-stream with RFC5987; logs never contain content. Full contract: [docs/SECURITY.md](https://github.com/zqs1qiwan/ClipClip/blob/main/docs/SECURITY.md).
