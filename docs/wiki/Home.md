# ClipClip · 主页 / Home

自托管的网页剪贴板。文字实时同步、不可变分享链接、小文件中转。无需安装客户端，浏览器打开即用。
A self-hosted web clipboard. Live text sync, immutable share links, small file drops. No client app, just a browser.

## 快速开始 / Quick start

```bash
mkdir -p /srv/clipclip/data && chown -R 1000:1000 /srv/clipclip/data
docker run -d --name clipclip --restart unless-stopped \
  -p 5678:5678 -v /srv/clipclip/data:/data \
  zqs1qiwan/clipclip:0.1.0
```

打开 / Open `http://<设备IP>:5678`。Docker Hub：[zqs1qiwan/clipclip](https://hub.docker.com/r/zqs1qiwan/clipclip)。

## 功能 / Features

- **实时剪贴板 / Live clipboard**：多设备同步文字，输入自动保存。/ Text syncs across devices; typing auto-saves.
- **分享链接 / Share links**：不可变文本链接，可设有效期、阅后即焚、口令。/ Immutable pastes with expiry, burn-after-read and passphrase.
- **文件中转 / File drop**：拖拽上传，跨设备下载；支持 curl 上传。/ Drag-and-drop upload, cross-device download; curl upload supported.
- **扫码 / QR pairing**：手机扫码打开，快速配对。/ Scan the QR to open on your phone.
- **PWA**：支持添加到主屏（需 HTTPS 或 localhost）。/ Add to Home Screen on supported browsers (HTTPS or localhost).

## 两种模式 / Two modes

| | 本地模式 / Local | 公网模式 / Public |
| --- | --- | --- |
| 开启 / Enable | 默认 / default | 设置 `CLIPCLIP_ACCESS_TOKEN` |
| 登录 / Login | 无 / none | 需口令 / token required |
| 场景 / Use | 可信局域网 / trusted LAN | 公网 / internet |

公网暴露务必前置鉴权，详见 / When exposing publicly, put auth in front — see [Security / 安全](Security)。

## 文档 / Docs

- [安装部署 / Installation](Installation)
- [使用指南 / Usage](Usage)
- [常见问题 / FAQ](FAQ)
