# 使用指南 / Usage

## 实时剪贴板 / Live clipboard

打开首页即可输入；文字自动保存并同步到所有打开页面。/ Open the home page and type; text auto-saves and syncs to all open pages.
按钮 / Buttons：**复制 / Copy**、**立即同步 / Sync now**、**清空 / Clear**（会清空所有设备）。/ Clear empties the clipboard on all devices.

## 分享链接 / Share links

「分享链接」页输入文本，可设置 / On the Share tab, enter text and optionally set:

- 有效期 / Expiry：默认 / default 24h（1小时 / 1h、24小时 / 24h、7天 / 7d）。
- 阅后即焚 / Burn after read：首次成功读取后自动销毁。/ Destroyed after the first successful read.
- 访问口令 / Passphrase：查看前需输入口令。/ A passphrase required to view.

生成后复制链接发送给对方。/ Copy the generated link and send it.

## 文件中转 / File drop

「文件」页拖拽或选择文件后上传；其他设备在同一页面下载。最新文件与最近列表会自动更新。/ On the Files tab, drag or choose a file to upload; other devices download it from the same page. Latest and recent lists update automatically.

命令行上传 / CLI upload：

```bash
curl -F "file=@notes.txt" http://<host>:5678/api/files
```

命令行下载（保留文件名）/ CLI download (keep filename)：

```bash
curl -OJ http://<host>:5678/api/files/<id>/download
```

## 扫码配对 / QR pairing

点击顶部「扫码」按钮，用手机相机扫描二维码，快速在本机打开。二维码只包含访问地址，不含任何口令或剪贴板内容。/ Tap Scan and open the QR with your phone camera. The QR contains only the access URL — no token or clipboard content.

## PWA

支持的浏览器可「添加到主屏」，像应用一样打开。离线缓存仅在 HTTPS 或 localhost 生效；纯 HTTP 局域网下不注册 Service Worker。/ Add to Home Screen on supporting browsers. Offline caching works only on HTTPS/localhost; the service worker is not registered on plain-HTTP LAN.

## API

完整端点、认证与 curl 示例见仓库 [docs/API.md](https://github.com/zqs1qiwan/ClipClip/blob/main/docs/API.md)。/ Full endpoints, auth and curl examples are in [docs/API.md](https://github.com/zqs1qiwan/ClipClip/blob/main/docs/API.md)。
