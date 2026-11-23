# 安全 / Security

## 两种模式 / Two modes

ClipClip 默认面向可信局域网，零配置、无登录。若要从公网访问，必须启用公网模式并前置鉴权。
ClipClip defaults to a trusted LAN with zero setup and no login. For internet access you must enable public mode and put authentication in front.

| | 本地模式 / Local | 公网模式 / Public |
| --- | --- | --- |
| 开启 / Enable | 默认 / default | 设置 `CLIPCLIP_ACCESS_TOKEN` |
| 数据访问 / Data access | 局域网内任意客户端 / any LAN client | 需 token 登录 / token login required |
| 登录界面 / Login UI | 不显示 / hidden | 自动显示 / shown when needed |

公网模式下，所有 `/api/*` 数据端点、SSE 与下载在未登录时返回 401；静态页面公开以便显示登录界面。/ In public mode all `/api/*` data endpoints, SSE and downloads return 401 without a session; static pages stay public so the login UI can render.

## 公网部署建议 / Public deployment checklist

1. 用强随机口令 / Use a strong random token：`openssl rand -base64 32`。
2. 前置 Cloudflare Access 或鉴权反代；不要直接把端口暴露到公网。/ Put Cloudflare Access or an auth proxy in front; never expose the port directly.
3. 仅当反代会覆盖 `X-Forwarded-For` 时才设 `CLIPCLIP_TRUST_PROXY=1`，否则攻击者可伪造 IP 绕过限速。/ Only set `CLIPCLIP_TRUST_PROXY=1` behind a proxy that overwrites `X-Forwarded-For`, otherwise attackers can forge it to bypass rate limits.
4. 建议把服务绑定到 `127.0.0.1`，只经隧道/反代访问。/ Consider binding to `127.0.0.1` and reaching it only through the tunnel/proxy.

## 数据保护 / Data protection

- 口令保护的粘贴只存 SHA-256 hash，不存明文；reveal 有失败限速。/ Passphrase-protected pastes store only a SHA-256 hash; reveal is rate-limited.
- 阅后即焚粘贴在首次读取后原子删除。/ Burn-after-read pastes are atomically deleted after the first read.
- 下载强制 `application/octet-stream` + RFC5987 文件名，避免 XSS。/ Downloads are forced to `application/octet-stream` with RFC5987 filenames to prevent XSS.
- 日志不记录剪贴板内容、粘贴正文或 token。/ Logs never contain clipboard text, paste bodies or tokens.

完整安全契约见仓库 [docs/SECURITY.md](https://github.com/zqs1qiwan/ClipClip/blob/main/docs/SECURITY.md)。/ Full security contract: [docs/SECURITY.md](https://github.com/zqs1qiwan/ClipClip/blob/main/docs/SECURITY.md)。
