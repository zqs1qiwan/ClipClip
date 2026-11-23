# 常见问题

[English](../en/FAQ.md) · 简体中文

**打不开页面**：`docker ps` 确认运行；检查 5678 端口与防火墙；`curl http://<host>:5678/api/health`。

**EACCES**：绑定挂载目录需 `chown -R 1000:1000 /srv/clipclip/data`。

**扫码地址不对**：二维码用当前页面地址；经反代时先从公网地址打开再扫码。

**公网要登录**：公网模式预期行为，输入 token；若没设过请检查环境变量。

**数据在哪**：`/data`（state JSON + uploads），备份整个目录。

**附件最大多少**：默认 50 MB，`CLIPCLIP_MAX_UPLOAD_MB` 可改。

**支持浏览器**：现代浏览器及移动端；PWA 安装需 HTTPS/localhost。
