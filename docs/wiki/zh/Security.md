# 安全 / 两种模式

[English](../en/Security.md) · 简体中文

默认面向可信局域网，零配置无登录。公网访问需启用公网模式。

| | 本地（默认） | 公网 |
| --- | --- | --- |
| 开启 | 不设 token | 设 `CLIPCLIP_ACCESS_TOKEN` |
| 数据访问 | LAN 内任意客户端 | 需 token 登录，未授权 401 |

公网部署清单：

1. 强随机口令 `openssl rand -base64 32`。
2. 前置 Cloudflare Access 或鉴权反代，勿直接暴露端口。
3. 仅可信反代时设 `CLIPCLIP_TRUST_PROXY=1`。

口令粘贴只存 SHA-256 hash，reveal 有失败限速；阅后即焚首次读取后原子删除；下载强制 octet-stream + RFC5987；日志不记录正文。详见仓库 [docs/SECURITY.md](https://github.com/zqs1qiwan/ClipClip/blob/main/docs/SECURITY.md)。
