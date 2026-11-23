# ClipClip 迭代二：功能扩展契约（ITERATION-2）

> 生成：2026-11-23。依据 PRD Post-MVP 与用户选择（QR 码 / PWA / burn-after-read + passphrase / curl-CLI + API 文档）。
> 本文件是后端、前端、运维、安全、文档实现的统一接口契约。**先写契约，再改代码**；如实现需偏离，先改本文件并通知队长。
> 本轮明确**不做**剪贴板历史（保持 PRD 单值剪贴板决策）。

---

## 0. 通用约束（全团队）

- 零运行时依赖：不得引入 npm 包或 CDN 外链；所有代码自包含（内联精简实现）。
- 本地模式零摩擦：新功能不得在本地模式增加登录/口令提示或干扰主流程。
- 数据面安全：公网模式所有 `/api/*` 数据端点仍需鉴权（沿用迭代一的 auth 白名单）；新端点默认受保护。
- 敏感数据：口令绝不写入日志/state 明文；QR 码 URL 不含 token；SW 绝不缓存任何 API 响应。
- 测试：新功能必须有自动化测试；在路由器源码目录 `node --test tests/**/*.test.js` 全绿。

---

## 1. QR 码快速配对（前端，public/）

**目标**：首页一键展示当前实例访问地址的二维码，手机扫码即开 —— 直击多设备本地分享痛点。

**契约**：
1. 新增 `public/js/qr.js`：自包含精简 QR Code 编码器（MIT 许可实现，如 Nayuki/kazuhikoarase 算法内联），导出 `renderQRCode(text, options) -> SVGElement|Canvas`。禁止外部请求。
2. 编码内容：**当前页面 origin URL**（`location.origin + location.pathname`），**绝不含 token 或剪贴板内容**。单房间 main，URL 即实例入口。
3. UI：在 topbar-actions 增加「扫码」图标按钮（双语 i18n：`actions.qr` = 扫码 / Scan QR）；点击弹出模态框，含二维码 + 可复制的 URL 文本 + 复制按钮 + 关闭按钮。
4. 无障碍：模态框 `role="dialog" aria-modal="true"`，可 ESC 关闭、点击遮罩关闭、焦点管理；按钮 ≥44px。
5. 响应式：模态框在 320/375px 不溢出，二维码自适应缩放。
6. 两种模式均可用；公网模式下扫开后仍需登录（符合迭代一鉴权）。

---

## 2. PWA 添加到主屏（前端 + 运维）

**目标**：手机可「添加到主屏」，像原生 App 一样打开。

**契约**：
1. `public/manifest.json`：name/short_name="ClipClip"/start_url="/"/scope="/"/display="standalone"/background_color/theme_color/icons（192/512 PNG 或 SVG）。
2. `public/icon.svg`（及可选 PNG）：简洁剪贴板图标，与品牌一致。
3. `public/sw.js`：仅缓存**静态资源**（`/`、`/index.html`、CSS、`/js/*.js`、图标、manifest）；**绝不缓存 `/api/*`**（剪贴板/粘贴/文件是敏感数据）。策略：静态资源 cache-first + 后台更新；导航 network-first + 缓存回退；API 直接放行不拦截。带版本号缓存名，激活时清理旧缓存。
4. index.html：`<link rel="manifest">`、`<link rel="icon">`、注册 SW（仅 `https` 或 `localhost` 安全上下文；http LAN 下静默跳过，不报错）。
5. **已知限制须文档化**：Service Worker 仅在安全上下文（HTTPS 或 localhost）注册；纯 HTTP LAN 下「添加到主屏」在多数安卓浏览器仍可用，但离线缓存不生效。文档如实说明。
6. 运维：确认 Dockerfile/compose 不需额外改动（public/ 整体 COPY）；若 manifest 需正确 MIME，核验 getMimeType 支持 `.json`/`.webmanifest`/`.svg`。

---

## 3. burn-after-read + passphrase 粘贴（后端 + 前端）

**目标**：粘贴链接支持「阅后即焚」与「口令保护」，增强敏感内容分享。

**后端契约**（src/server/）：
1. `POST /api/pastes` 请求体新增可选字段：`burnAfterRead?: boolean`（默认 false）、`passphrase?: string`（默认无）。
   - `passphrase` 长度 1–128，非字符串或超长 → 400。
   - 存储时只存 SHA-256 hash（`passphraseHash`）+ `hasPassphrase` 布尔，**绝不存明文**。
2. 读取规则：
   - 无口令粘贴：继续使用 `GET /api/pastes/:id`（现有行为）。
   - 有口令粘贴：`GET /api/pastes/:id` 返回 `403 {error:"Passphrase required"}`（**不含任何内容**）；改用 `POST /api/pastes/:id/reveal`，请求体 `{passphrase}`，正确 → 200 返回完整 paste（同 GET 结构），错误 → 403 {error:"Invalid passphrase"}。
   - 口令比较用 SHA-256 + `timingSafeEqual` 定长比较。
3. 阅后即焚：第一次**成功读取**（GET 或 reveal）后立即从 state 删除该 paste 并持久化；后续任何读取返回 404。**并发安全**：读取+删除必须在 storage 单飞写队列内原子完成，防竞态双读。
4. `getSummary()` 的 pastes 计数排除过期与已焚毁项。
5. 配置：`CLIPCLIP_MAX_PASTE_PASSPHRASE_LEN`（默认 128）。

**前端契约**（public/）：
6. paste 创建面板增加两个可选项：「阅后即焚」复选框、「访问口令」输入框（可选，留空则无）。
7. 粘贴查看页（`/p/<id>`）：若为口令保护粘贴，显示口令输入框；提交调用 `POST /api/pastes/:id/reveal`；错误内联提示；成功后展示内容（仍用 textContent，不注入 HTML）。
8. 结果卡/过期信息标注「阅后即焚」状态。

**测试**：burn 首读成功次读 404、passphrase 错误 403/正确 reveal、口令 hash 不落明文、并发 reveal 只读一次、GET 受保护粘贴不含内容。

---

## 4. curl/CLI 友好上传 + API 文档（后端 + 文档）

**目标**：一行 curl 即可上传/下载，补齐 API 文档。

**后端契约**：
1. `POST /api/files` 在现有 raw body + `X-File-Name` 之外，**新增 multipart/form-data 支持**：识别 `curl -F "file=@/path/to/file" URL`，从 part 的 `Content-Disposition` 解析 filename；字段名接受 `file` 或任意。零依赖流式解析（复用现有 UploadLimitStream）；大小限制同样生效。
2. 保持响应格式不变（id/fileName/downloadUrl/expiresAt/sizeBytes）；multipart 与 raw 两种路径返回结构一致。
3. 下载保持 `Content-Disposition: attachment` + RFC5987；CLI 文档给出 `curl -OJ` 正确保存中文文件名的示例。

**文档契约**：
4. 新增 `docs/API.md`：所有端点的请求/响应/认证/示例（health、live GET/PUT、events SSE、pastes 创建/读取/reveal、files 上传 raw+multipart/列表/元数据/下载、login/logout），每个端点配 curl 示例与预期响应；说明双模式鉴权与 Bearer 用法；说明 TTL/passphrase/burn 参数。
5. README 链接 docs/API.md。

**测试**：multipart 上传解析 filename（含中文）、大小限制、与 raw 路径响应一致。

---

## 5. 任务分工（文件所有权，避免冲突）

| 成员 | 任务 | 允许改动 |
| --- | --- | --- |
| frontend-engineer | QR + PWA + paste 前端 | `public/**` |
| backend-engineer | burn/passphrase + multipart + config | `src/server/**`, `tests/server/**` |
| qa-engineer | 新增测试 + 路由器实测方案 | `tests/**`, `scripts/**` |
| security-reviewer | 审查新功能安全（只读） | 报告；如有 docs/SECURITY.md 更新需授权 |
| docs-maintainer | API.md + PRD/ROADMAP/MVP-TASKS 状态 | `docs/**`, `README.md` |
| devops-engineer | 待命：部署/镜像问题修复 | 按需 |

---

## 6. 验收总清单

- [ ] QR 扫码在手机端打开实例地址，无 token 泄露；模态框无障碍达标。
- [ ] PWA manifest + SW 注册（安全上下文）；SW 不缓存 API；http LAN 限制已文档化。
- [ ] burn-after-read 并发只读一次；passphrase 不明文存储、比较恒定时间。
- [ ] curl -F 一行上传成功；API.md 覆盖全部端点。
- [ ] 本地模式零摩擦不回退；公网模式新端点受保护。
- [ ] 全部自动化测试通过 + 路由器真实 Docker 实测新功能。
