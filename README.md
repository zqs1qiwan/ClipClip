<p align="center">
  <img src="public/brand/logo-lockup.svg" alt="ClipClip" width="300" />
</p>

# ClipClip

**中文** — 自托管的网页剪贴板：一台设备的文字与文件，其他设备即时可用。无需安装客户端，一个浏览器即可。
**English** — A self-hosted web clipboard: text and small files on one device, instantly available on others. No client app, just a browser.

`本地优先 · 零依赖 · Docker 一键部署` · `LOCAL-FIRST · ZERO-DEPENDENCY · ONE-CONTAINER`

| ![Desktop](docs/screenshots/desktop-light.png) | ![Mobile](docs/screenshots/mobile-light.png) |
| --- | --- |

---

## 它是什么 / What it does

- **实时剪贴板 / Live clipboard** — 多设备打开同一页面，文字实时同步。/ One page on all your devices; text syncs live.
- **分享链接 / Share links** — 生成不可变文本链接，可设过期、阅后即焚、访问口令。/ Immutable paste links with expiry, burn-after-read and optional passphrase.
- **文件中转 / File drop** — 上传小文件，另一台设备下载；支持 `curl` 一行命令上传。/ Upload a small file, download it elsewhere; one-line `curl` upload supported.
- **两种模式 / Two modes** — 局域网零配置直接使用；公网访问时强制口令鉴权。/ Zero-setup on a trusted LAN; token auth required when exposed publicly.

## 快速开始 / Quick start

**Docker（推荐）/ Docker (recommended)**

```bash
mkdir -p /srv/clipclip/data && chown -R 1000:1000 /srv/clipclip/data
docker run -d --name clipclip --restart unless-stopped \
  -p 5678:5678 -v /srv/clipclip/data:/data \
  zqs1qiwan/clipclip:0.1.0
```

访问 / Open `http://<设备IP>:5678`。标签 / Tags: `:0.1.0`（固定版本）/ `:latest`（最新）。Docker Hub: [zqs1qiwan/clipclip](https://hub.docker.com/r/zqs1qiwan/clipclip)。

**本机运行 / Run locally** — 需要 Node.js 22+:

```bash
npm start          # http://localhost:5678
```

**Docker Compose** — 见 [docker-compose.yml](docker-compose.yml)（含健康检查、安全加固、持久化）；配置示例见 [.env.example](.env.example)。/ See [docker-compose.yml](docker-compose.yml) (healthcheck, hardening, persistence) and [.env.example](.env.example).

## 两种模式 / Two modes

| | 本地模式 / Local | 公网模式 / Public |
| --- | --- | --- |
| 开启方式 / Enable | 默认（不设 token）/ Default (no token) | 设置 `CLIPCLIP_ACCESS_TOKEN` |
| 登录 / Login | 无，打开即用 / None | 需输入访问口令 / Token required |
| 适用场景 / Use | 可信局域网 / Trusted LAN | 公网 / Internet |
| 建议 / Advice | 仅在可信网络使用 / Trusted networks only | 前置 Cloudflare Access 或反代鉴权 / Put behind Cloudflare Access or an auth proxy |

公网暴露前请阅读 / Before exposing publicly, read [docs/SECURITY.md](docs/SECURITY.md)。

## 使用 / Usage

- 打开首页即进入剪贴板；输入自动同步，或点「立即同步」。/ The first screen is the clipboard; typing auto-saves, or press Sync.
- 「分享链接」可生成固定文本链接，设置有效期/阅后即焚/口令。/ Share link creates an immutable paste with expiry / burn / passphrase.
- 「文件」可拖拽上传，其他设备下载；命令行：`curl -F "file=@notes.txt" http://<host>:5678/api/files`。/ Files tab uploads by drag-and-drop; CLI: `curl -F "file=@notes.txt" http://<host>:5678/api/files`.
- 手机扫码：点击顶部「扫码」，用相机打开。/ Phone pairing: tap Scan and open the QR with your camera.
- PWA：支持的浏览器可「添加到主屏」（需 HTTPS 或 localhost）。/ PWA: Add to Home Screen in supporting browsers (HTTPS or localhost).

完整 API 与 curl 示例 / Full API and curl examples: [docs/API.md](docs/API.md)。

## 数据 / Data

运行时数据保存在 `/data`（state JSON + 上传文件）；请定期备份该目录。/ Runtime data lives in `/data` (state JSON + uploads); back it up regularly. 容器以非 root 用户运行，绑定挂载目录需 `chown -R 1000:1000`。/ The container runs as non-root; bind-mounted data must be `chown -R 1000:1000`.

## 文档 / Documentation

- [API 参考 / API reference](docs/API.md)
- [安全与双模式 / Security & two modes](docs/SECURITY.md)
- [架构 / Architecture](docs/ARCHITECTURE.md)
- [产品需求 / Product requirements](docs/PRD.md)
- [路线图 / Roadmap](docs/ROADMAP.md)

## 许可 / License

MIT — 见 / see [LICENSE](LICENSE)。
