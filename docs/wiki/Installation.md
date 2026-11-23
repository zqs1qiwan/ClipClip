# 安装部署 / Installation

## Docker（推荐）/ Docker (recommended)

镜像 / Image: `zqs1qiwan/clipclip:0.1.0`（固定版本）或 `:latest`（最新）。地址 / Docker Hub: [zqs1qiwan/clipclip](https://hub.docker.com/r/zqs1qiwan/clipclip)。仅 linux/amd64。

```bash
mkdir -p /srv/clipclip/data && chown -R 1000:1000 /srv/clipclip/data
docker run -d --name clipclip --restart unless-stopped \
  -p 5678:5678 -v /srv/clipclip/data:/data \
  zqs1qiwan/clipclip:0.1.0
```

验证 / Verify：

```bash
curl -fsS http://127.0.0.1:5678/api/health   # {"status":"ok",...}
docker inspect --format '{{.State.Health.Status}}' clipclip   # healthy
```

## Docker Compose

下载 / download [docker-compose.yml](https://raw.githubusercontent.com/zqs1qiwan/ClipClip/main/docker-compose.yml) 与 [.env.example](https://raw.githubusercontent.com/zqs1qiwan/ClipClip/main/.env.example)，然后 / then：

```bash
cp .env.example .env      # 按需修改 / edit as needed
docker compose up -d
```

compose 自带健康检查、非 root 运行、日志与资源限制。/ The compose file includes healthcheck, non-root runtime, log and resource limits.

## 本机运行 / Run locally

需要 Node.js 22+。/ Requires Node.js 22+.

```bash
git clone https://github.com/zqs1qiwan/ClipClip.git
cd ClipClip
npm start      # http://localhost:5678
```

## 数据 / Data

- 所有数据保存在 `/data`（state JSON + 上传文件）。/ All data lives in `/data` (state JSON + uploads).
- 绑定挂载需 `chown -R 1000:1000`（容器以 uid 1000 运行）。/ Bind mounts must be `chown -R 1000:1000` (container runs as uid 1000).
- 定期备份 `/data` 即可。/ Back up `/data` regularly.

## 公网部署 / Public exposure

1. 设置 `CLIPCLIP_ACCESS_TOKEN` 为强随机值。/ Set a strong random `CLIPCLIP_ACCESS_TOKEN`.
2. 前置 Cloudflare Access 或鉴权反代；仅在可信反代后开启 `CLIPCLIP_TRUST_PROXY=1`。/ Put Cloudflare Access or an auth proxy in front; enable `CLIPCLIP_TRUST_PROXY=1` only behind a trusted proxy.
3. 详见 / see [Security / 安全](Security)。
