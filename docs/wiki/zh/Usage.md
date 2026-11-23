# 使用指南

[English](../en/Usage.md) · 简体中文

## 实时剪贴板

首页输入即自动同步到所有设备。按钮：复制 / 立即同步 / 清空（清空所有设备）。

## 分享链接

输入文本，设置有效期 / 阅后即焚 / 访问口令，生成后复制链接。默认有效期 24 小时，最大 7 天。

## 文件中转

拖拽或选择文件上传；单文件默认上限 50 MB（`CLIPCLIP_MAX_UPLOAD_MB` 可改）。文件有效期 24 小时，保留最近 10 个。

命令行：

```bash
curl -F "file=@notes.txt" http://<host>:5678/api/files
curl -OJ http://<host>:5678/api/files/<id>/download
```

## 扫码 / PWA

点顶部「扫码」用手机相机打开。支持的浏览器可「添加到主屏」（需 HTTPS 或 localhost）。

API 详见仓库 [docs/API.md](https://github.com/zqs1qiwan/ClipClip/blob/main/docs/API.md)。
