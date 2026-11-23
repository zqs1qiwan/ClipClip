# 常见问题 / FAQ

## 打不开页面 / Can't open the page

确认容器在运行 / Check the container is running: `docker ps`。确认端口 5678 未被占用、防火墙已放行。/ Ensure port 5678 is free and the firewall allows it.
健康检查 / Health: `curl http://<host>:5678/api/health` 应返回 `{"status":"ok",...}`。

## 容器启动报 EACCES / Container fails with EACCES

绑定挂载的 `/data` 目录需要归 uid 1000 所有：/ The bind-mounted `/data` must be owned by uid 1000:

```bash
chown -R 1000:1000 /srv/clipclip/data
```

## 手机扫码显示访问地址不对 / QR shows wrong address

二维码使用当前页面的地址。若通过反向代理访问，请先从正确地址打开页面再扫码。/ The QR encodes the current page URL. If behind a proxy, open the page from the public URL first, then scan.

## 公网访问需要登录 / Public access asks for login

这是公网模式的预期行为，输入 `CLIPCLIP_ACCESS_TOKEN` 即可。若未设置 token 却要求登录，检查环境变量配置。/ Expected in public mode — enter the `CLIPCLIP_ACCESS_TOKEN`. If you never set one, check your environment variables.

## 数据保存在哪里 / Where is data stored

`/data`：`state/clipclip-state.json`（元数据）与 `uploads/`（文件）。请备份整个目录。/ `/data` holds `state/clipclip-state.json` and `uploads/`; back up the whole directory.

## 上传文件大小限制 / Upload size limit

默认单文件 50 MB，可通过 `CLIPCLIP_MAX_UPLOAD_MB` 调整。/ 50 MB per file by default; adjust with `CLIPCLIP_MAX_UPLOAD_MB`.

## 支持哪些浏览器 / Supported browsers

现代浏览器（Chrome / Firefox / Safari / Edge，含移动端）。PWA 安装需 HTTPS 或 localhost。/ Modern browsers including mobile. PWA install requires HTTPS or localhost.
