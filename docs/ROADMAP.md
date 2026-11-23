# ClipClip 维护与后续开发路线图（ROADMAP）

> 本文件是团队首轮基线审计（t1–t6）的汇总 backlog，**只汇总六份审计报告中的发现**，不含审计之外的新判断。
> 生成于 2026-11-23；来源任务：t1（后端）、t2（前端）、t3（测试）、t4（运维）、t5（安全）、t6（文档）。
> 审计期间未修改任何源码与 `data/` 运行时数据；本轮新建本文件作为 backlog。

## 实施记录（2026-11-23，后续轮次）

原始 backlog 完整保留（见第三节）。在审计汇总之后，团队开展了一轮集中实现，各 RM 条目的处理状态以行内标注为准。本轮落地情况：

- **双模式安全（本地零摩擦 / 公网默认安全）**：新增 `src/server/auth.js`；由 `CLIPCLIP_ACCESS_TOKEN` 决定模式——未设置为本地模式（无登录墙、零摩擦 LAN 使用），设置为公网模式（所有数据端点、SSE 与页面需 token 登录，`POST /api/login` + `timingSafeEqual` + HttpOnly/SameSite session cookie + Bearer + 每 IP 失败限速，未授权返回 `401`）。补充完整安全响应头（CSP/HSTS/COOP/COEP/CORP/Permissions-Policy/X-Accel-Buffering:no）与下载安全（octet-stream + RFC5987 `filename*`）。对应 **RM-12 / RM-13 / RM-14 / RM-25**（部分），并更新了 `docs/ARCHITECTURE.md`、`docs/PRD.md` 与 `docs/SECURITY.md`。
- **P0 稳定性 / 数据安全修复**：畸形 URL 与缺失 blob 不再使进程退出；persist 单飞队列 + 原子 rename + 状态校验；严格 body 校验（null/非字符串 `content` 返回 `400`）；过期文件从 latest/recent/SSE/health 过滤。对应 **RM-01 / RM-02 / RM-03 / RM-11 / RM-18**。
- **前端 UI/UX 精简重构**：修复死壳与过期 paste 假死、SSE 不再覆盖脏输入、防抖自动保存、写操作错误内联反馈；深色模式对比度 ≥4.5:1、长文本换行、触控目标 ≥44px、aria-live 反馈；app.js 按模块拆分；登录界面仅在公网模式显示。对应 **RM-04 / RM-05 / RM-06 / RM-21**（主要项），并补充 `docs/PRODUCT-INSIGHTS.md` 交互原则。
- **运维硬化**：容器健康检查、非 root/硬化、构建门禁补齐、README 双模式部署说明（README 由运维维护）。对应 **RM-07 / RM-08 / RM-09 / RM-20 / RM-22 / RM-23 / RM-24**。
- **收尾（已完成）**：全量回归验证（t13）与路由器真实 Docker 双模式 E2E 已执行（测试 114/114、CDP 截图 320/375px 无横滚、health/live/paste/file/SSE/双模式全通过）；安全审查复核（t14）完成，无 blocker/high。详见 [VERIFICATION.md](../tests/VERIFICATION.md)。

### 迭代二实施记录（2026-11-23）

依据 [ITERATION-2.md](ITERATION-2.md) 契约，本轮扩展功能已全部实现并在目标路由器真实 Docker 上验证通过。对应 **RM-38 Post-MVP 功能池** 子项：

- **QR 码快速配对**（RM-38 子项，🟢 已实现并验证）：`public/js/qr.js` 自包含二维码，编码当前页面 origin URL（不含 token/剪贴板内容），topbar 扫码按钮 + 无障碍模态框；公网模式扫码后仍需登录。
- **PWA 添加到主屏**（RM-38 子项，🟢 已实现并验证）：`public/manifest.json` + `icon.svg` + `sw.js`，仅缓存静态资源、绝不缓存 `/api/*`；仅在 HTTPS/localhost 安全上下文注册，纯 HTTP LAN 离线缓存不生效（限制已文档化）。
- **burn-after-read + passphrase 粘贴**（RM-38 子项，🟢 已实现并验证）：`POST /api/pastes` 新增 `burnAfterRead`/`passphrase`/`expiresInHours`；口令仅存 SHA-256 hash + `hasPassphrase`，`GET` 受保护粘贴返回 403 无内容、`POST /api/pastes/:id/reveal` 恒定时间比较，首读即焚且并发安全。
- **curl/CLI + API 文档**（RM-38 子项，🟢 已完成并验证）：`POST /api/files` 新增 `multipart/form-data` 支持（与 raw body 响应一致）；新增 [docs/API.md](docs/API.md) 覆盖全部端点；README 链接 API.md 并补 CLI 示例。
- **保持非目标**：剪贴板历史不做，维持单值剪贴板决策。
- **收尾（已完成）**：路由器真实 Docker 实测新功能已执行并通过（QR 模态/SVG、PWA 资源 MIME、burn 首读 200 次读 404、passphrase 403/reveal 200 且 state 无明文、multipart 中文名 curl -F、公网新端点 401）；MVP-TASKS 中对应条目已勾选。详见 [VERIFICATION.md](../tests/VERIFICATION.md) E 章。

## 目录

- [一、优先级与角色说明](#一优先级与角色说明)
- [二、基线通过项（确认可用）](#二基线通过项确认可用)
- [三、汇总 backlog（按波次）](#三汇总-backlog按波次)
  - [P0 — 发布/部署前必须修](#p0--发布部署前必须修)
  - [P1 — 首个维护迭代](#p1--首个维护迭代)
  - [P2 — 质量加固与工程化](#p2--质量加固与工程化)
  - [P3 — 后续开发候选（需产品决策）](#p3--后续开发候选需产品决策)
- [四、建议执行顺序与依赖关系](#四建议执行顺序与依赖关系)
- [五、来源去重映射表](#五来源去重映射表)

---

## 一、优先级与角色说明

**优先级定义**

| 级别 | 含义 | 处理窗口 |
| --- | --- | --- |
| **P0** | 进程崩溃、数据丢失/损坏、部署阻断、核心界面不可用、高危文档失真 | 下一轮部署前必须修 |
| **P1** | 安全加固、核心测试缺口、正确性偏差、主要可用性/可访问性问题 | 首个维护迭代 |
| **P2** | 边界加固、工程化（CI/覆盖率）、批量体验优化、文档同步 | 第二迭代 |
| **P3** | post-MVP 功能候选、发布治理，需产品决策后再立任务 | 路线图候选，不承诺 |

**涉及角色**：后端 `backend-engineer`、前端 `frontend-engineer`、测试 `qa-engineer`、运维 `devops-engineer`、安全 `security-reviewer`、文档 `docs-maintainer`。
**来源标注**：`t1` 服务端、`t2` 前端、`t3` 测试、`t4` 构建部署、`t5` 安全、`t6` 文档。
**每项格式**：问题描述（含 file:line）→ 涉及角色 → 来源 → 验收标准 → 建议顺序/依赖。

**状态图例**（见开头「实施记录」）：🟢 本轮已完成｜🔵 本轮进行中｜无标记 = 尚未处理，保留在 backlog。

---

## 二、基线通过项（确认可用）

以下经审计确认符合要求，无需列入 backlog，但**修改时须防止回归**：

- 零依赖 Node.js 22 技术栈与目录结构、端口 `5678` 单一来源一致（t1/t4/t6）。
- ID 使用 `crypto.randomBytes(9)` / base64url，不可猜测；输入边界校验与 body/上传大小限制存在（t1/t5：app.js:27-41, 89-104, 130-136, 202-207, 228）。
- 文件名清洗 + ID 前缀存储、路径穿越经 URL 归一化 + `path.join` 缓解、下载 `attachment` + `nosniff`、CORS 默认关闭（t5：storage.js:27-31,149-151）。
- paste 内容以 `textContent` 渲染，不注入 HTML（t2：app.js:376,390,391,577,583）——建议补回归测试。
- 复制能力具备 API → execCommand → prompt 降级；首屏默认 live 面板；结果卡含打开/下载 + 复制链接 + 过期信息（t2）。
- `data/` 被 `.gitignore`（:15）与 `.dockerignore` 排除；无敏感内容日志（t5/t6）。
- 测试基线：13/13 用例通过；`npm run lint`、`npm run build` 退出码 0（t3，经临时副本执行；沙箱下 node/npm 因 named-pipe/UNC 限制无法在仓库内直接运行，见各报告验证说明）。

---

## 三、汇总 backlog（按波次）

### P0 — 发布/部署前必须修

#### RM-01　后端进程崩溃防护（URL 解析 + 读流 + 兜底）　🟢 已实现并验证
- **问题**：`src/server/app.js:43-45` 的 `getRequestUrl(req)` 位于 `try`（185）之外；畸形请求目标（如 `GET //[`）使 `new URL` 抛 `ERR_INVALID_URL`，async 回调无 rejection handler → Node 默认退出，整服务不可用（t1 已用同构最小服务复现 exit 1）。`src/server/app.js:18-25`（sendFile）与 `:291-309`（下载）的 `createReadStream(...).pipe(res)` 无 `'error'` 监听，blob 缺失/不可读时 Unhandled `'error'` → 进程 exit，且响应头已发 200，客户端看到连接重置。
- **角色**：后端
- **来源**：t1 H1、H3
- **验收标准**：① 畸形请求目标返回 400 JSON 且进程存活；② 注册 `server.on('clientError')` 与顶层 `process.on('unhandledRejection')` 兜底，仅记录错误、不记录请求内容、不退出；③ 删除/损坏 blob 后请求下载返回 404/500 JSON 错误且进程存活；④ `pipeline` 或 `'error'` 监听覆盖 sendFile、下载、静态文件三条读流路径；⑤ 补畸形 URL、缺失 blob、SSE 断开的回归测试并全绿。
- **建议顺序**：无依赖，**最高优先**，先于一切部署动作。

#### RM-02　存储持久化竞态与状态损坏　🟢 已实现并验证
- **问题**：`src/server/storage.js:69-73` 所有写路径共用 `${stateFile}.tmp`，并发 `writeFile`/`rename` 争用（调用点 :124,137,168,206,211；app.js:208,233,153）。40 并发复现 36 次 `rename ENOENT` + 丢更新；中途崩溃可产生截断/混合 JSON，下次启动 `storage.js:75-92` 直接 `JSON.parse` 抛错使服务无法启动；加载无 schema 校验。
- **角色**：后端
- **来源**：t1 H2
- **验收标准**：① persist 串行化（Promise 链/单飞队列），任意并发组合下无 500、无丢更新；② 每次写使用唯一临时名（pid+随机），write → fsync → rename；③ 启动解析失败时隔离/备份损坏文件并明确告警启动或给出 fatal 提示，不静默覆盖；④ pastes/files 条目做字段校验（与 RM-18 协同）；⑤ 40 并发 persist 压测 + 崩溃注入测试通过。
- **建议顺序**：紧随 RM-01；是 RM-18 的前置。

#### RM-03　请求体校验（null / 非字符串导致清空与 500）　🟢 已实现并验证
- **问题**：`src/server/app.js:39-40` 对 JSON `null` 处理不当致 500；`:201-207` 中 `{}` 或非字符串 `content` 被静默当作 `""`，PUT 会清空 `main` 房间 live clipboard（数据丢失），paste 创建同样问题（`:227-239`）。
- **角色**：后端
- **来源**：t1 H4
- **验收标准**：① `null`/数组/非对象 body 返回 400 JSON 错误而非 500；② 缺失或非字符串 `content` 返回 400，不再写入空串；③ 明确区分合法清空与非法类型；④ 补 `null`/`{}`/数字/数组/超长 body 的集成测试。
- **建议顺序**：与 RM-01/RM-02 同批，属数据安全类热修复。

#### RM-04　前端启动顺序 / 死壳 / 过期 paste 错误页 / 写路径错误反馈　🟢 已实现并验证
- **问题**：`public/app.js:654-677` 所有交互绑定位于 `await loadLiveClipboard()`/`loadRecentFiles()` 之后，任一初始 GET 失败即进入 `boot().catch`（:674-677）只写连接徽标 → Sync/Copy/Clear/上传/切 tab 全无响应且无重试入口。`public/app.js:573-593,648-652` 中 `/p/<id>` 404/过期（默认 24h TTL，属主要用户路径）同样假死。写路径 `saveLiveClipboard`（:475-482）、`createPaste`（:501-513）无 try/catch，失败成 unhandled rejection、用户零反馈。
- **角色**：前端（后端配合健康接口）
- **来源**：t2 H1、H2、H5
- **验收标准**：① 交互绑定不依赖初始数据加载成功，任意 API 失败仍可操作且有重试入口；② `/p/<id>` 过期/404 显示独立“粘贴不存在/已过期 + 返回剪贴板”错误页，不残留假死界面；③ 所有写操作 try/catch，错误内联展示（含 413/超限/网络失败）并支持重试；④ 断线重连后状态可恢复；⑤ 可运行环境补 320/375px 亮/暗截图与断网手测。
- **建议顺序**：P0 前端第一批；依赖 RM-07 提供可靠健康判定。

#### RM-05　前端同步丢字与自动保存　🟢 已实现并验证
- **问题**：`public/app.js:488-498` 对 `live:snapshot`/`live:updated` 直接覆盖 `liveTextarea.value`（PUT 响应亦回写 :480）。双设备并发时 A 正在输入被 B 的广播整段覆盖、光标跳末尾、无脏标记/冲突提示 → 静默丢字。全文件无 `input` 监听，仅点 Sync 才 PUT（:662），不符 PRD:56 实时心智。另 `files:updated` 整表广播致前端重建失焦（app.js:255-259）。
- **角色**：前端（后端协同 `files:updated` 载荷）
- **来源**：t2 H3、H4；t2 跨团队 C
- **验收标准**：① 本地有未保存修改时远端更新不得覆盖输入，改为“远端已更新（应用/放弃）”提示或合并且保留光标位置；② textarea `input` 防抖自动 PUT（约 500ms），Sync 降级为手动重试/发布；③ `files:updated` 仅推送增量最新文件，前端局部更新、不重建整表、不丢焦点；④ 双窗口并发输入实测不丢字。
- **建议顺序**：紧随 RM-04；③ 项需与后端/RM-11 协同。

#### RM-06　深色模式主按钮对比度　🟢 已实现并验证
- **问题**：`public/styles.css:31-32,454-463` 暗色 `--accent=#69a9ff` 上白字对比度 **2.41:1**、hover `#8ebcff` 仅 **1.95:1**（亮色 `#1368bf` 为 5.58:1 正常），低于 WCAG AA 4.5:1，Sync/Create/Upload/Copy/Open/Download 不可读；焦点环对比度 1.29/1.51:1。
- **角色**：前端
- **来源**：t2 H6、M2
- **验收标准**：① 暗色主按钮（含 hover/pressed）文字对比度 ≥ 4.5:1；② 焦点环对比度 ≥ 3:1；③ 用脚本复算亮/暗两套配色并记录数值；④ 补暗色截图。
- **建议顺序**：可与 RM-04/05 并行（同属前端样式）。

#### RM-07　Docker 健康检查　🟢 已实现并验证
- **问题**：`/api/health` 已实现（`src/server/app.js:186-194`），但 `Dockerfile` 与 `docker-compose.yml` 均无 `HEALTHCHECK`/`healthcheck`（全仓 grep 0 命中）；`restart: unless-stopped` 对“进程在但服务假死”无效，部署无从判定就绪。
- **角色**：运维
- **来源**：t4 DEP-01
- **验收标准**：① Dockerfile 增加基于 `fetch /api/health` 的 HEALTHCHECK；② compose 声明一致的 healthcheck，便于 `docker compose ps` 读取；③ `docker compose ps` 显示 healthy；④ 模拟假死能在重试次数后标记 unhealthy 并被重启策略处理。
- **建议顺序**：无依赖，可与后端热修复并行；RM-04 的可靠判定依赖它。

#### RM-08　上传暂存迁入 /data 卷 + 独占创建　🟢 已实现并验证
- **问题**：`src/server/app.js:138-141` 上传暂存写在容器 `os.tmpdir()`，不在 `/data` 卷；`storage.js:50-60` 跨设备 rename 退化为全文 `copyFile`；崩溃/OOM 留孤儿临时文件在 overlay，`pruneFiles`（:94-112）只清 uploads；50MB×并发叠加 `mem_limit=512m` 与 iStoreOS overlay 小分区有写满风险。临时文件名用 `Date.now()+Math.random()` 且 `createWriteStream` 未加 `'wx'`（t5 #5），共享 tmp 下有符号链接/覆盖风险。
- **角色**：后端 + 运维
- **来源**：t4 DEP-02；t5 #5
- **验收标准**：① config 增加 `tmpDir` 指向 `<dataDir>/tmp`；② createStorage 建目录并在启动时清理陈旧临时文件；③ 同盘 rename 不再触发 EXDEV 复制；④ 临时文件使用 crypto 随机名 + `'wx'` 独占创建；⑤ 上传失败/进程重启后无孤儿残留、overlay 不再增长；⑥ 与 RM-02 写队列兼容。
- **建议顺序**：与 RM-02 协同（同改 storage/config）；属部署前必做。

#### RM-09　目标宿主部署路径文档化　🟢 已实现并验证
- **问题**：`README.md:18-24` 仅一条 `docker compose up --build -d`；无 `/data` 布局、备份/恢复、属主、升级/回滚；`docs/PRD.md:183` 命名卷 `-v clipclip-data:/data` 与 compose 绑定卷 `./data:/data` 冲突（二选一未定）；无“必须在 Linux 宿主构建、不得从 Windows SMB UNC 构建/挂载”说明，无 192.168.2.1/iStoreOS 宿主约束。`README.md:28-35` 环境变量清单缺 `CLIPCLIP_PUBLIC_BASE_URL` 及 `RECENT_FILES_LIMIT`/`CLEANUP_INTERVAL_MS`/`LIVE_CONTENT_LIMIT`；`:12-22` 未提 `npm run dev`/`npm start`。
- **角色**：文档 + 运维
- **来源**：t4 DEP-03；t6 #3、#11
- **验收标准**：① README 部署章节扩为 8 节（前置条件 / 宿主构建 / 启动与健康 / 数据持久化与备份 / 升级回滚 / 暴露策略 / 无 compose 的等价 docker run / 排障）；② 明确并统一卷方案；③ 环境变量清单与 `config.js` 完全一致并标注默认值；④ 写明 Linux 宿主构建约束与 overlay/内存注意；⑤ 所有命令可复制执行且与 `package.json` 一致。
- **建议顺序**：与 RM-25（Tunnel 指引）同批交付，互相引用。

#### RM-10　文档紧急修订（失效链接 + 进度失真）　🟢 本轮已完成
- **问题**：`docs/ARCHITECTURE.md:9` 引用作者本机绝对路径 `C:/Users/zqs1q/.../docs/PRD.md`，仓库内不可用；`docs/MVP-TASKS.md:9-57` 十项任务全为 `- [ ]`，但代码已全部实现（t6 经 src/、public/、Dockerfile 核对），进度看板严重失真。
- **角色**：文档
- **来源**：t6 HIGH #1、#2
- **验收标准**：① 链接改为 `[PRD.md](PRD.md)`；② 十项据实勾选 `[x]` 或补“已完成/待验证”标注；③ 全仓 grep 无残留 `C:/Users` 绝对路径；④ 无其他悬空相对链接。
- **建议顺序**：无依赖、成本极低，可与 P0 并行立即完成。

---

### P1 — 首个维护迭代

#### RM-11　过期文件过滤（latest / recent / SSE / health）　🟢 已实现并验证
- **问题**：`src/server/storage.js:184-199`（`getLatestFile`/`listRecentFiles`）、`:213-218`（`getSummary`）未过滤 `isExpired()`；过期文件在定时清理前仍可作为“最新文件”返回/下载，并出现在 SSE snapshot、`/api/files/recent`、`/api/files/latest` 与 health 计数中。
- **角色**：后端
- **来源**：t1 P2 第 1 项；t3 潜在缺陷
- **验收标准**：① 三个方法均过滤 `isExpired()`；② SSE snapshot 与相关端点不含过期项；③ 过期文件下载返回 404；④ 补对应单元测试。
- **建议顺序**：RM-02 之后（共享 state 读取路径）。

#### RM-12　下载内容类型与文件名安全　🟢 已实现并验证
- **问题**：`src/server/app.js:129,155-159` 将上传请求的 `Content-Type` 原样存为 `mimeType`，`:301` 下载时原样输出；攻击者可上传 `text/html`/`image/svg+xml` 载荷（虽 attachment+nosniff 降低风险，仍不符 PRD「safe content types」）。另 t2 跨团队 A：`:302` 用 `encodeURIComponent` 而非 RFC5987，中文文件名乱码。
- **角色**：后端 + 安全
- **来源**：t5 #1；t2 跨团队 A
- **验收标准**：① 下载统一 `application/octet-stream` 或服务端扩展名白名单，忽略客户端声明；② 文件名按 RFC5987 `filename*` 编码，中文名在浏览器正确显示；③ 保留 `attachment` + `nosniff`；④ 补下载头测试。
- **建议顺序**：无强依赖，可与 RM-13 同批。

#### RM-13　安全响应头（CSP + 现代头）　🟢 已实现并验证
- **问题**：`src/server/app.js:10-16,18-25,181-183` 仅设置 Referrer-Policy、X-Frame-Options、X-Content-Type-Options、Cache-Control；无 CSP、HSTS、COOP/COEP/CORP、Permissions-Policy，未满足 PRD「conservative HTTP security headers」。
- **角色**：安全 + 后端
- **来源**：t5 #2
- **验收标准**：① 增加 `Content-Security-Policy: default-src 'self'; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'` 等；② 补充 HSTS（HTTPS 场景）、COOP/COEP/CORP、Permissions-Policy（按兼容性裁剪）；③ 不破坏 SSE 与静态资源加载；④ 补响应头存在性测试。
- **建议顺序**：与 RM-12 同批；需前端确认 CSP 不阻断脚本。

#### RM-14　SSE 连接治理与反向代理缓冲　🟢 已实现并验证
- **问题**：`src/server/app.js:107,171-176,214-225` clients Set 无上限、`broadcastEvent` 不检查背压、无心跳与空闲超时，512MB 容器下可被连接耗尽 DoS；SSE 无心跳（:214-224）、无 `X-Accel-Buffering`，nginx 60s / Cloudflare ~100s 会断流。
- **角色**：后端 + 运维 + 安全
- **来源**：t1 P2；t4 DEP-08；t5 #4
- **验收标准**：① clients Set 有并发上限；② 心跳注释/事件 + 空闲超时；③ 写失败时移除客户端并处理背压；④ SSE/静态/下载响应加 `X-Accel-Buffering: no`；⑤ 文档说明反代断流约束。
- **建议顺序**：依赖 RM-01（进程存活）；与 RM-25 文档联动。

#### RM-15　paste TTL 契约与死字段
- **问题**：`src/server/app.js:233` 忽略请求中的 `expiresInHours`，一律使用 `config.pasteTtlHours`；`:228` 的 524288 字节上限硬编码；`storage.js:133` 的 `burnAfterRead:false` 为死字段无 feature gate。`docs/ARCHITECTURE.md:166-168` 的请求示例仍含 `expiresInHours`，t6 与 t2 跨团队 D 均指出此偏差；t6 #7 亦指出 burn-after-read 应标注为规划中（PRD:119）。
- **角色**：后端 + 文档（前端可选：paste 过期选择 PRD:70）
- **来源**：t1 P2；t2 跨团队 D；t6 #4、#7
- **验收标准**：① 二选一并落实：实现 `expiresInHours`（含范围/上限校验）或从 API 与文档移除；② 524288 改为配置项；③ `burnAfterRead` 明确标为 post-MVP（或实现 + feature gate）；④ ARCHITECTURE 请求示例同步；⑤ 前端提供过期时间选择（对应 PRD:70）。
- **建议顺序**：与 RM-36 文档同步同批。

#### RM-16　live 内容上限对 JSON 转义误判
- **问题**：`src/server/app.js:202-206` 用原始字符串长度判断 `liveContentLimit`，JSON 转义后的内容可能被误判 413。
- **角色**：后端
- **来源**：t1 P2
- **验收标准**：① 按实际 UTF-8 字节与转义后长度正确计算；② 合法内容不再误 413；③ 补边界测试（含中文/emoji/转义字符）。

#### RM-17　上传失败孤儿 blob / 状态分叉 + 下载计数阻塞
- **问题**：t1 P2：上传失败会留下孤儿 blob 与状态分叉；`markFileDownloaded`（storage.js:200-207）同步 `persist()` 阻塞下载响应。
- **角色**：后端
- **来源**：t1 P2
- **验收标准**：① saveFile 失败时回滚临时文件与已写入状态；② 下载计数改为异步/批量，不阻塞响应；③ 补失败注入测试。
- **建议顺序**：依赖 RM-02 的串行写队列。

#### RM-18　state 条目 schema 校验　🟢 已实现并验证
- **问题**：t1 P2：启动加载与写入不校验条目字段，篡改 `storedName` 可致路径穿越。
- **角色**：后端 + 安全
- **来源**：t1 P2
- **验收标准**：① 加载时逐条校验 paste/file 字段与 `storedName` 格式（禁止路径分隔符与 `..`）；② 非法条目隔离而非参与路径拼接；③ 补篡改 state 的测试。
- **建议顺序**：依赖 RM-02。

#### RM-19　测试 P0 缺口补齐　🔵 本轮测试中（t13 待完成）
- **问题**：t3 P0：SSE `/api/events` 零测试；TTL/过期严重不足（`isExpired` 无单测、`getPaste`/`getFile` 过期返回 null 未测、`cleanupExpired` 仅测磁盘丢失分支）；上传/内容大小限制 413 无测试。
- **角色**：测试
- **来源**：t3 P0
- **验收标准**：① SSE（snapshot、live:updated、files:updated、断连清理）有测试；② `isExpired` 与过期读取、`cleanupExpired` 全分支有单测；③ 413（content-length 预检、FILE_TOO_LARGE、liveContentLimit）有测试；④ `npm test` 全绿。
- **建议顺序**：与 RM-01/02/03/11 修复同步补测（测试先行更佳）。

#### RM-20　构建门禁假绿修复　🟢 已实现并验证
- **问题**：t4 DEP-06：`scripts/build-check.js:4-12` 漏 `public/lib/clipboard.js` 与 `public/button-feedback.js`（被 `public/app.js:1-2` 直接 import）；lint 仅查 tab、无语法校验。t3 P2 亦指出 lint 仅覆盖 6 文件、build 非真实构建。
- **角色**：测试 + 运维
- **来源**：t4 DEP-06；t3 P2
- **验收标准**：① build-check requiredFiles 补齐两个缺失文件；② lint 覆盖 tests/、index.html 等并加语法校验（`node --check` 或等价）；③ 补“缺文件即失败”的负向测试。
- **建议顺序**：无依赖，可提前。

#### RM-21　前端 MEDIUM 关键体验项　🟢 已实现并验证
- **问题**：t2 M1–M10：长 URL/文件名无 `overflow-wrap` 致横向滚动风险（违反 PRD:91/96；styles.css:200-203,191-198,537-545）；Clear 无确认且会清空所有设备；移动端 tabbar 变 1 列 3 行 + Access 盒重复挤占首屏；触控目标 34-40px < 44px；连接/上传/复制反馈无 `aria-live`、tab 无 ARIA tabs；上传错误显示英文原文且不显示上限；文件大小恒显示 KB（50MB→51200 KB）；切语言重置上传进度/结果卡；paste 无过期选择（PRD:70）。
- **角色**：前端
- **来源**：t2 M1–M10
- **验收标准**：① 长文本 `overflow-wrap: anywhere`，320/375px 无横向滚动；② Clear 增加确认且不再与常用操作同权重相邻；③ 移动端 tabbar 不挤占首屏、Access 盒不重复；④ 触控目标 ≥ 44px；⑤ 状态反馈 `aria-live`、tab 用 ARIA tabs；⑥ 上传错误本地化并显示上限；⑦ 文件大小 KB/MB 自适应；⑧ 切语言不重置上传态；⑨ paste 支持过期选择。
- **建议顺序**：RM-04/05/06 之后。

#### RM-22　运行时硬化与日志轮转　🟢 已实现并验证
- **问题**：t4 DEP-04：无 `USER`/`no-new-privileges`/`cap_drop`/`read_only`/`logging`，json-file 日志可写满 nvme。
- **角色**：运维
- **来源**：t4 DEP-04
- **验收标准**：① 容器非 root USER、no-new-privileges、cap_drop、按需 read_only + tmpfs；② compose 配置 logging 限额；③ 硬化后启动与核心流程仍正常。
- **建议顺序**：依赖 RM-07 健康检查确认服务可用。

#### RM-23　compose 配置规范　🟢 已实现并验证
- **问题**：t4 DEP-05：无 image tag/项目名、无 `init`/`stop_grace_period`、端口不可参数化（前置 Tunnel 无法收窄 127.0.0.1）、资源限制用旧式 `mem_limit`（需与 `deploy.resources` 二选一）。
- **角色**：运维
- **来源**：t4 DEP-05
- **验收标准**：① 加 image tag 与项目名、`init: true`、`stop_grace_period`；② 端口参数化（可绑定 127.0.0.1 供 Tunnel）；③ 资源限制统一为 `deploy.resources` 或保留旧式但二选一；④ 与 RM-07 健康检查结果联动。
- **建议顺序**：与 RM-22 同批。

#### RM-24　.dockerignore 与残留文件清理　🟢 已实现并验证
- **问题**：t4 DEP-07：`.dockerignore` 漏 `.agent-teams/`、`tests/`、`docs/`、`.env*`、`*.bak-*`；根目录残留 `docker-compose.yml.bak-20261112-020035`（t6 #12 亦指出）。
- **角色**：运维
- **来源**：t4 DEP-07；t6 #12
- **验收标准**：① `.dockerignore` 补齐上述模式；② 删除残留 `.bak` 文件；③ 构建上下文内容核对，无敏感/无关文件入镜像。
- **建议顺序**：无依赖，可提前。

#### RM-25　Cloudflare Tunnel / 反向代理鉴权指引　🟢 已实现并验证
- **问题**：t5 #3：全量数据对任意客户端可见且无鉴权（SSE files:snapshot app.js:221、`/api/files/recent`、`/api/live`），符合 trusted-LAN 假设但 Tunnel 暴露指引不足（README.md:39-43 仅一句）；t4 DEP-08：当前不宜直暴，缺“先建 Access 应用→再发布路由”步骤与 ingress 兜底。
- **角色**：文档 + 运维 + 安全
- **来源**：t5 #3；t4 DEP-08
- **验收标准**：① README 给出“先建 Access 应用 → 再发布路由”步骤与 ingress 示例（`access.required`/`teamName`/`audTag`、`http_status:404` 兜底）；② 明确 MVP 无鉴权仅适用 trusted-LAN；③ 写明隧道暴露必须前置鉴权的风险提示；④ 与 RM-09、RM-14 互相引用。
- **建议顺序**：与 RM-09 同批；依赖 RM-14 的心跳/缓冲修复以免反代断流。

---

### P2 — 质量加固与工程化

#### RM-26　测试 P1 缺口补齐
- **来源/角色**：t3 P1；测试。
- **问题与验收**：为 `loadConfig`、Paste HTTP API、`createId` 唯一性/格式、文件名清洗边界（空串/截断/Windows 分隔符/Unicode）、HTTP 错误路径与 `/api/health`、`GET /api/files/:id` 与下载计数/Content-Disposition 补测试，全部通过。

#### RM-27　paste 正文存储模型
- **来源/角色**：t1 P2；后端。
- **问题与验收**：paste 正文全量存入 JSON 导致无界增长与全量重写放大；需为单条大小设上限或改为独立文件/分片，state 体积与重写开销有上界，补大 paste 压测。

#### RM-28　启动清理与优雅关闭
- **来源/角色**：t1 P2、t4 DEP-05；后端 + 运维。
- **问题与验收**：启动时清理过期 paste/file 与孤儿 blob；收到 SIGTERM/SIGINT 后停止接收请求、关闭 SSE、完成在途写后退出；compose `stop_grace_period` 配合。

#### RM-29　上传并发与磁盘配额
- **来源/角色**：t1 P2；后端。
- **问题与验收**：增加上传并发上限、磁盘剩余空间预检；配额耗尽返回明确 413/507 而非崩溃；补并发测试。

#### RM-30　路由与方法语义统一
- **来源/角色**：t1 P2；后端。
- **问题与验收**：统一 404/405 语义、路径参数校验、SSE 仅 GET 等；补路由测试。

#### RM-31　文件名清洗边界加固
- **来源/角色**：t5 #6；后端 + 安全。
- **问题与验收**：`storage.js:27-31` 未处理 Windows 保留设备名（CON/NUL/COM1…）、前导点、DEL/高 Unicode 控制字符；补齐并保持 ID 前缀防穿越；补参数化测试。

#### RM-32　GET 下载副作用评估
- **来源/角色**：t5 #7；后端。
- **问题与验收**：`GET /api/files/:id/download` 带 `markFileDownloaded` 副作用（app.js:299）；评估改为异步/幂等或移除；确认无 CSRF 回归；文档说明 `downloadCount` 语义。

#### RM-33　前端 LOW 批量清理
- **来源/角色**：t2 LOW 11 项；前端。
- **问题与验收**：补图标（PRD:94）、localStorage 脏值防御、i18n 遗漏与首屏中英闪烁、paste 静默 trim、paste 页返回入口、文件选择器 reset、progressbar ARIA、单复数修正、避免全局 `a{break-all}`、`prefers-reduced-motion`、favicon；并把 677 行的 `app.js` 按模块拆分。

#### RM-34　测试 P2 与 CI / 覆盖率
- **来源/角色**：t3 P2；测试。
- **问题与验收**：`public/app.js`（677 行）零单测；lint 纳入全部源文件；引入 c8/nyc 并设最低覆盖率阈值；接入 CI，在可运行环境执行 `npm test`/`npm run lint`/`npm run build`。

#### RM-35　CI 镜像冒烟
- **来源/角色**：t4 DEP-10；运维 + 测试。
- **问题与验收**：新增 `scripts/docker-smoke.sh`，用 15678 端口启动并检查 `/api/health` 与基本 API；CI 中构建后自动运行。

#### RM-36　文档全面同步实现
- **来源/角色**：t6 #5、#6、#8、#9、#10；文档。
- **问题与验收**：① ARCHITECTURE 补 `files:snapshot`/`files:updated` 与 `/api/files/latest`、`/api/files/recent`；② `multipart size limits` 措辞改为 raw body 流式限额（app.js:126-169）；③ Client Structure 补 `clipboard.js`/`button-feedback.js`；④ PRD:191 删除或补建 threat model/ADR 声明；⑤ 更新 PRD:304-311 已回答的 Open Questions（Q1 单房间、Q5 双语、Q6 MIT）与三处 Draft/Initial 状态标签。

#### RM-37　配置死项清理
- **来源/角色**：t4 DEP-11、t6 #3；后端 + 文档。
- **问题与验收**：确认 `CLIPCLIP_PUBLIC_BASE_URL` 实际用途（config.js:14 读取但 app.js 未见使用）——未用则移除或实现；config、README、PRD、compose 四处清单一致；不出现“文档声称支持但代码未用”的项。

---

### P3 — 后续开发候选（需产品决策）

> 以下来自 PRD Post-MVP（:114-129，经 t6 引用）与审计报告中的建议，**是候选而非承诺**，进入 backlog 前须先更新 PRD 状态与 Open Questions。

#### RM-38　Post-MVP 功能池　🟡 迭代二已实现 QR/PWA/burn/passphrase/curl+API（见开头迭代二实施记录），剪贴板历史仍为非目标
- **来源/角色**：PRD:114-129（via t6）、t2；文档 + 产品。
- **候选清单**：passphrase 保护粘贴、burn-after-read、多命名房间、QR 码、剪贴板历史（含保留策略）、admin 密码、粘贴内容端到端加密、PWA、完整 dark mode、API/CLI、WebDAV-like/curl 上传端点；另 `/api/config` 暴露上传上限（t2 跨团队 B）。
- **验收标准**：每项立任务前明确产品决策、更新 PRD 与 ARCHITECTURE、并纳入相应角色排期。

#### RM-39　发布治理
- **来源/角色**：t4 DEP-09；运维。
- **问题与验收**：固定 base tag 或改用摘要、依赖锁策略、镜像 LABEL；可复现构建并留存镜像来源信息。

---

## 四、建议执行顺序与依赖关系

```
Wave 0  热修复（发布/部署阻断）
  RM-01 进程崩溃防护 ─┐
  RM-02 存储竞态    ─┼─ 后端数据安全三件套（优先，互相独立但同批）
  RM-03 请求体校验  ─┘
  RM-07 健康检查 ───── 运维，可与后端并行
  RM-08 暂存迁卷 ───── 依赖 RM-02（同改 config/storage）
  RM-10 文档急救 ───── 无依赖，成本极低，立即做

Wave 1  前端可靠性 + 部署文档
  RM-04 死壳/错误页 ─┐
  RM-05 同步丢字    ─┼─ 前端主体验修复（RM-04 → RM-05 → RM-06）
  RM-06 暗色对比度  ─┘
  RM-09 部署文档 ──── 与 RM-25 同批
  RM-19 测试 P0 ───── 与 Wave 0 修复同步补测

Wave 2  安全 + 核心测试 + 工程化
  RM-11 过期过滤（依赖 RM-02）
  RM-12 下载头 ─┬─ RM-13 安全头 ─┬─ RM-14 SSE 治理（依赖 RM-01）
  RM-15 TTL 契约 ─ RM-36 文档同步
  RM-16 上限误判 ─ RM-17 孤儿/阻塞（依赖 RM-02）─ RM-18 state 校验（依赖 RM-02）
  RM-20 构建门禁 ─ RM-24 .dockerignore（可提前）
  RM-21 前端 MEDIUM（RM-04/05/06 之后）
  RM-22 运行时硬化 ─ RM-23 compose 规范（依赖 RM-07）
  RM-25 Tunnel 指引（依赖 RM-14）

Wave 3  质量加固
  RM-26 测试 P1 ─ RM-34 测试 P2/CI ─ RM-35 镜像冒烟
  RM-27~RM-33 存储/路由/前端 LOW 批量
  RM-37 配置死项清理

Wave 4  候选（产品决策后）
  RM-38 Post-MVP 功能池 ─ RM-39 发布治理
```

**关键依赖提示**
- RM-01（进程存活）是 RM-14、RM-25 的前置；SSE 与反代加固在崩溃修复后才稳定。
- RM-02（串行写队列）是 RM-08、RM-11、RM-17、RM-18 的前置。
- RM-07（健康检查）是 RM-04、RM-22、RM-23 判定服务可用的前提。
- RM-14（心跳/缓冲）是 RM-25（Tunnel 反代指引）的前置。
- RM-10、RM-20、RM-24 与代码解耦，可插入任意波次提前完成。

---

## 五、来源去重映射表

| 审计报告 | 原始发现 | 汇总到 |
| --- | --- | --- |
| t1 | H1、H3 | RM-01 |
| t1 | H2 | RM-02 |
| t1 | H4 | RM-03 |
| t1 | P2-1 过期文件 | RM-11（合 t3 潜在缺陷） |
| t1 | P2-live 上限误判 | RM-16 |
| t1 | P2-paste 死字段/硬编码 | RM-15（合 t2-D、t6 #4/#7） |
| t1 | P2-孤儿 blob / 下载阻塞 | RM-17 |
| t1 | P2-SSE 心跳/背压 | RM-14（合 t4 DEP-08、t5 #4） |
| t1 | P2-state 条目校验 | RM-18 |
| t1 | P2-paste 正文存储 / 启动清理 / 并发配额 / 路由语义 / config 校验 | RM-27、RM-28、RM-29、RM-30、RM-37 |
| t2 | H1、H2、H5 | RM-04 |
| t2 | H3、H4 | RM-05 |
| t2 | H6、M2 | RM-06 |
| t2 | M1、M3–M10 | RM-21 |
| t2 | LOW ×11 | RM-33 |
| t2 | 跨团队 A（文件名 RFC5987） | RM-12（合 t5 #1） |
| t2 | 跨团队 B（/api/config） | RM-38 |
| t2 | 跨团队 C（files:updated 广播） | RM-05 |
| t2 | 跨团队 D（expiresInHours） | RM-15 |
| t3 | P0 缺口 | RM-19 |
| t3 | P1 缺口 | RM-26 |
| t3 | P2 缺口 / 潜在缺陷 | RM-34 / RM-11 |
| t4 | DEP-01 | RM-07 |
| t4 | DEP-02 | RM-08（合 t5 #5） |
| t4 | DEP-03 | RM-09（合 t6 #3/#11） |
| t4 | DEP-04 / 05 / 06 / 07 / 08 | RM-22 / RM-23 / RM-20 / RM-24 / RM-25、RM-14 |
| t4 | DEP-09 / 10 / 11 | RM-39 / RM-35 / RM-37 |
| t5 | #1 | RM-12（合 t2-A） |
| t5 | #2 | RM-13 |
| t5 | #3 | RM-25 |
| t5 | #4 | RM-14 |
| t5 | #5 | RM-08 |
| t5 | #6 / #7 | RM-31 / RM-32 |
| t6 | #1 / #2 | RM-10 |
| t6 | #3 / #11 | RM-09（合 t4 DEP-03） |
| t6 | #4 / #7 | RM-15 |
| t6 | #5 / #6 / #8 / #9 / #10 | RM-36 |
| t6 | #12 | RM-24（合 t4 DEP-07） |

> 说明：所有条目均可在 t1–t6 的 output / 队长收件箱报告中找到对应原始发现；本文件未引入新的缺陷判断。
