# ClipClip · 主页

[English](../en/Home.md) · 简体中文

自托管的网页剪贴板：文字实时同步、不可变分享链接、小文件中转。无需安装客户端，浏览器打开即用。

## 快速开始

```bash
mkdir -p /srv/clipclip/data && chown -R 1000:1000 /srv/clipclip/data
docker run -d --name clipclip --restart unless-stopped \
  -p 5678:5678 -v /srv/clipclip/data:/data \
  zqs1qiwan/clipclip:latest
```

打开 `http://<设备IP>:5678`。镜像：[zqs1qiwan/clipclip](https://hub.docker.com/r/zqs1qiwan/clipclip)（`:latest` 最新 / `:0.1.0` 固定）。

## 功能

- **实时剪贴板** — 多设备同步文字，输入自动保存。
- **分享链接** — 不可变链接，可设有效期 / 阅后即焚 / 口令。
- **文件中转** — 拖拽上传，跨设备下载；支持 curl。
- **扫码配对** — 手机扫码快速打开。
- **PWA** — 可添加到主屏（需 HTTPS 或 localhost）。

## 两种模式

| | 本地（默认） | 公网 |
| --- | --- | --- |
| 开启 | 不设 token | 设 `CLIPCLIP_ACCESS_TOKEN` |
| 登录 | 无 | 需口令 |
| 场景 | 可信局域网 | 公网（须前置鉴权） |

## 文档

[安装](Installation.md) · [使用](Usage.md) · [安全](Security.md) · [FAQ](FAQ.md)
