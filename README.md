<p align="center">
  <img src="public/brand/logo-lockup.svg" alt="ClipClip" width="300" />
</p>

# ClipClip

[![Stars](https://img.shields.io/github/stars/zqs1qiwan/ClipClip?style=flat-square&logo=github)](https://github.com/zqs1qiwan/ClipClip/stargazers) [![License: MIT](https://img.shields.io/github/license/zqs1qiwan/ClipClip?style=flat-square)](LICENSE) [![Docker Image](https://img.shields.io/docker/v/zqs1qiwan/clipclip?style=flat-square&logo=docker&label=docker)](https://hub.docker.com/r/zqs1qiwan/clipclip) [![Docker Pulls](https://img.shields.io/docker/pulls/zqs1qiwan/clipclip?style=flat-square&logo=docker)](https://hub.docker.com/r/zqs1qiwan/clipclip)

[English](README.en.md) · 简体中文

一个自托管的网页剪贴板：文字实时同步、不可变分享链接、小文件中转。无需安装客户端，浏览器打开即用。

`本地优先 · 零依赖 · 单容器`

| ![桌面版](docs/screenshots/desktop-light.png) | ![手机版](docs/screenshots/mobile-light.png) |
| --- | --- |

---

## 功能

- **实时剪贴板** — 多设备打开同一页面，文字实时同步，输入自动保存。
- **分享链接** — 生成不可变文本链接，可设有效期、阅后即焚、访问口令。
- **文件中转** — 上传小文件，另一台设备下载；支持 `curl` 一行命令上传。
- **扫码配对** — 点顶部「扫码」，手机相机扫一下即打开。
- **两种模式** — 局域网零配置直接用；公网访问需口令鉴权。

## 快速开始（Docker，推荐）

```bash
mkdir -p /srv/clipclip/data && chown -R 1000:1000 /srv/clipclip/data
docker run -d --name clipclip --restart unless-stopped \
  -p 5678:5678 -v /srv/clipclip/data:/data \
  zqs1qiwan/clipclip:latest
```

打开 `http://<设备IP>:5678`。镜像：[Docker Hub zqs1qiwan/clipclip](https://hub.docker.com/r/zqs1qiwan/clipclip)，标签 `:latest`（最新）/ `:0.1.0`（固定版本）。

**本机运行**（Node.js 22+）：`npm start` → `http://localhost:5678`。
**Docker Compose**：下载 [docker-compose.yml](docker-compose.yml)，`docker compose up -d`；配置见 [.env.example](.env.example)。

## 关于数据卷 / `-v`

`-v /srv/clipclip/data:/data` 把容器内 `/data` 映射到宿主机目录，**强烈建议保留**：

- 容器删除或升级后，剪贴板内容、分享链接、上传文件都还在（持久化）。
- `/data` 内含 `state/clipclip-state.json`（元数据）与 `uploads/`（文件本体）。
- 容器以非 root 用户（uid 1000）运行，绑定挂载目录需先 `chown -R 1000:1000`。
- 备份只需打包 `/srv/clipclip/data`。**不挂载也能跑**，但数据会随容器销毁而丢失。
- 也可改用命名卷 `-v clipclip-data:/data`（Docker 自动管理，无需 chown）。

## 容量与保留策略

| 项目 | 默认值 | 环境变量 |
| --- | --- | --- |
| 单个文件最大 | 50 MB | `CLIPCLIP_MAX_UPLOAD_MB` |
| 剪贴板文字上限 | 100000 字节 | `CLIPCLIP_LIVE_CONTENT_LIMIT` |
| 粘贴正文上限 | 524288 字节 | `CLIPCLIP_PASTE_CONTENT_LIMIT` |
| 分享链接有效期 | 24 小时 | `CLIPCLIP_PASTE_TTL_HOURS` |
| 文件有效期 | 24 小时 | `CLIPCLIP_FILE_TTL_HOURS` |
| 粘贴有效期上限 | 168 小时（7天） | `CLIPCLIP_PASTE_TTL_MAX_HOURS` |
| 保留最近文件数 | 10 | `CLIPCLIP_RECENT_FILES_LIMIT` |

过期的粘贴和文件会自动清理。

## 两种模式

| | 本地模式（默认） | 公网模式 |
| --- | --- | --- |
| 开启 | 不设 `CLIPCLIP_ACCESS_TOKEN` | 设置该变量为强口令 |
| 登录 | 无，打开即用 | 需输入访问口令 |
| 场景 | 可信局域网 | 公网 |

公网部署务必前置 Cloudflare Access 或鉴权反代，详见 [安全说明](docs/SECURITY.md)。

## 使用

- 首页即剪贴板，输入自动同步；「复制 / 立即同步 / 清空」。
- 「分享链接」：输入文本，设置有效期 / 阅后即焚 / 口令，生成后复制链接。
- 「文件」：拖拽上传；命令行 `curl -F "file=@notes.txt" http://<host>:5678/api/files`。
- 命令行下载：`curl -OJ http://<host>:5678/api/files/<id>/download`。

完整 API 见 [docs/API.md](docs/API.md)。PWA「添加到主屏」需 HTTPS 或 localhost。

## 文档

[API](docs/API.md) · [安全](docs/SECURITY.md) · [架构](docs/ARCHITECTURE.md) · [产品需求](docs/PRD.md) · [路线图](docs/ROADMAP.md)

MIT 许可 · [LICENSE](LICENSE)
