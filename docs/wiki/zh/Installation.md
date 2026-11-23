# 安装部署

[English](../en/Installation.md) · 简体中文

## Docker（推荐）

镜像 `zqs1qiwan/clipclip:latest`（或固定 `:0.1.0`），Linux amd64。

```bash
mkdir -p /srv/clipclip/data && chown -R 1000:1000 /srv/clipclip/data
docker run -d --name clipclip --restart unless-stopped \
  -p 5678:5678 -v /srv/clipclip/data:/data \
  zqs1qiwan/clipclip:latest
```

验证：`curl -fsS http://127.0.0.1:5678/api/health`。

## Docker Compose

下载 [docker-compose.yml](https://raw.githubusercontent.com/zqs1qiwan/ClipClip/main/docker-compose.yml)，`cp .env.example .env` 后 `docker compose up -d`。

## 本机运行

Node.js 22+：`git clone https://github.com/zqs1qiwan/ClipClip.git && cd ClipClip && npm start`。

## 数据卷是否必要

**建议保留 `-v`**：数据（`/data` 下的 state JSON 与 uploads）在容器删除/升级后仍保留。不挂载也能启动，但数据随容器销毁丢失。绑定挂载需 `chown -R 1000:1000`（容器非 root）。也可用命名卷 `-v clipclip-data:/data`。备份 = 打包 `/srv/clipclip/data`。

## 公网部署

设强随机 `CLIPCLIP_ACCESS_TOKEN`，前置 Cloudflare Access / 鉴权反代，仅可信反代时开 `CLIPCLIP_TRUST_PROXY=1`。详见[安全](Security.md)。
