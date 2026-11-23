# ClipClip 全量验证报告

> 最后更新：2026-11-23（覆盖 t13 / t21 / t27 与队长实测）。
> 本报告是累积记录：A–B 为迭代一方案，C–D 为迭代一实测，E 为迭代二，F 为品牌重塑回归。

## 权威结论（当前版本）

- **测试总数：114/114 通过**（`node --test tests/**/*.test.js`，路由器 Linux 实跑；server 48 + client 66）。
- build-check PASS（11 必需文件 / 1 HTML / 19 浏览器模块）；lint-check PASS（38 JS + 1 CSS）；`node --check` 38/38。
- 路由器真实 Docker：镜像构建成功、容器 `Up (healthy)`、本地/公网双模式 E2E 全通过；CDP 截图 320/375/1280px 无横向滚动；DOM 契约 68/68、a11y 结构检查通过。
- 下方各章中的 **61/61、92/92、109/109** 是当时迭代的**历史快照数字**，不是当前值；每轮新增测试后总数递增，当前权威值以本节 **114/114** 为准。

> 队长实测结论（迭代一，2026-11-23）：用户指定「用路由器上的真实 clipclip Docker 做更新测试」，已由队长在 192.168.2.1 完成：备份旧副本 → 同步源码 → `docker compose build` → 重建容器 → 本地模式 15 项 HTTP 实测 + 公网模式 15 项 HTTP 实测，**全部通过**。详见 **D 节**。期间发现并修复 1 个真实集成缺陷：compose 未透传 `CLIPCLIP_TRUST_PROXY`，导致公网 XFF 限速失效；已补齐 compose 与 README 环境变量表并复测通过。

---

## A. 本地静态验证（本环境实际执行）

### A.1 执行环境与方法

| 项 | 值 |
| --- | --- |
| Node | 打包版 `C:\Users\zqs1q\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe`（v24.21.0） |
| 工作副本 | 工作区文件逐字镜像到 `C:\Users\zqs1q\AppData\Local\Temp\dsh-01IqLh\clipclip-t13` |
| 为何用镜像 | 系统 `npm.ps1`/`node.exe` 触发沙箱 named-pipe 拒绝；UNC 工作区路径 `\\istoreos\...` 对 pwsh/node/python 子进程均不可达（EPERM）。镜像内容与工作区一致（后端直接复用 t9 验证镜像中已确认一致的源码，前端/测试/脚本按工作区读取内容逐字重建）。 |
| 逐文件执行 | `node --test` 生成器模式因沙箱禁止 spawn 子进程（EPERM）整体失败；改为对每个测试文件直接 `node tests/...test.js` 进程内执行（Node 内置 test runner 支持单文件直接运行）。 |

### A.2 命令清单与结果

| 命令 | 结果 | 证据 / 说明 |
| --- | --- | --- |
| `node --test`（生成器模式） | **环境受限（非缺陷）** | 8 个测试文件全部 `Error: spawn EPERM`（沙箱禁止子进程）。改用逐文件执行，见下。 |
| `node tests/server/storage.test.js` | **PASS 12/12**（exit 0） | 含 40 并发 persist、损坏恢复、storedName 穿越隔离、过期过滤、tmp 清理。 |
| `node tests/server/app.test.js` | **PASS 19/19**（exit 0） | 含畸形 URL→400、clientError→400、缺失 blob→404、null/数组/非字符串 body→400、过期文件隐藏、下载头 octet-stream+RFC5987、双模式/登录/cookie/限速/logout/SSE。 |
| `node tests/client/clipboard.test.js` | **PASS 2/2**（exit 0） | 既有：`execCommand` 与 `prompt` 回退。 |
| `node tests/client/button-feedback.test.js` | **PASS 1/1**（exit 0） | 既有：按钮反馈状态恢复。 |
| `node tests/client/format.test.js`（新增） | **PASS 6/6**（exit 0） | formatBytes/formatDateTime/formatDurationHours 边界。 |
| `node tests/client/i18n.test.js`（新增） | **PASS 5/5**（exit 0） | 语言规范化、`t()` 变量替换与回退、document.lang。 |
| `node tests/client/state.test.js`（新增） | **PASS 7/7**（exit 0） | 偏好读写容错、createState 脏标记/登录状态初值。 |
| `node tests/client/api.test.js`（新增） | **PASS 7/7**（exit 0） | HTTP→错误码映射、网络/abort、401 全局钩子（login 例外）、createPaste 有效期参数、login/logout 端点。 |
| **合计** | **59/59 全部通过** | 12+19+2+1+6+5+7+7 = 59。 |
| `node scripts/build-check.js` | **PASS**（exit 0） | `Build check passed (11 required files, 1 HTML page(s), 14 browser module(s) verified).` |
| `node scripts/lint-check.js` | **环境受限（非缺陷）** | 扫描 30 个 JS + 1 CSS，tab 检查通过（无 tab 报错）；但每条 `node --check` 均因内部 `spawnSync` 触发沙箱 EPERM 而报 30 条 "Failed to run node --check ... EPERM"，退出 1。 |
| `node --check <file>`（逐文件，直接继承 stdio，无重定向/管道） | **PASS 30/30**（exit 0） | 独立复验：全部 30 个 JS 语法正确，证明 lint 的失败纯属子进程沙箱限制，非源码语法问题。 |
| build-check 负向测试 | **PASS（如期失败 exit 1）** | 删除 `public/lib/clipboard.js` 后输出 `Missing required source file` + `public/js/ui.js imports missing module: ../lib/clipboard.js`，共 2 问题。 |
| lint-check 负向测试 | **PASS（如期检测到 tab）** | 注入前导 tab 后输出 `Tabs detected in public/js/format.js.`（EPERM 噪声同上，属环境限制）。 |

> **结论**：本地可验证范围内，59 个测试全部通过；build-check 正/负向均符合预期；lint-check 的 tab 检查与语法检查逻辑均正确（语法已由独立 `node --check` 30/30 佐证），其退出码 1 仅因沙箱禁止 `spawnSync`。**未发现真实代码缺陷。**

### A.3 本轮新增/更新的文件（仅 tests/ 范围内）

| 文件 | 说明 |
| --- | --- |
| `tests/client/format.test.js`（新增） | 6 用例：formatBytes/formatDateTime/formatDurationHours。 |
| `tests/client/i18n.test.js`（新增） | 5 用例：语言规范化、setLanguage、t() 变量替换/回退。 |
| `tests/client/state.test.js`（新增） | 7 用例：偏好存取容错、createState 脏标记/登录状态机初值。 |
| `tests/client/api.test.js`（新增） | 7 用例：错误码映射、网络/abort、401 钩子、createPaste、login/logout。 |

后端测试（`tests/server/app.test.js` 19 用例、`tests/server/storage.test.js` 12 用例）由 t9 已补齐，本轮复核全部通过，未重复修改。

### A.4 目标项覆盖对照（t13 任务 1–4）

| 要求 | 覆盖用例 | 结果 |
| --- | --- | --- |
| 畸形 URL / 缺失 blob 返回错误且进程存活 | app.test：`malformed request target...` / `clientError...` / `missing blob...`（均随后断言 health 200） | PASS |
| 40 并发 persist 无丢更新/ENOENT | storage.test：`concurrent writes are serialized...` | PASS |
| body null/数组/非字符串 content→400，合法清空可用 | app.test：`invalid JSON bodies...` + `live clipboard accepts high-escape content...` | PASS |
| getLatestFile/listRecentFiles/getSummary 过滤过期 | storage.test：`expired files are filtered...` + app.test：`expired files are hidden...` | PASS |
| 双模式：本地放行 / 公网 401 / login / cookie / 限速 / Bearer | app.test 6 个鉴权用例 | PASS |
| 下载头 octet-stream + RFC5987 + attachment + nosniff | app.test：`download headers use...` | PASS |
| 前端纯函数/逻辑（i18n/format/脏标记/登录状态机） | 4 个新 client 测试文件 | PASS |
| build-check 缺文件负向 / lint 覆盖 | 负向测试 + 独立语法复验 | PASS（带环境限制说明） |

---

## B. 路由器真实 Docker HTTP 实测方案（由队长统一执行）

> **重要**：按用户指定，本轮以路由器真实部署 HTTP 实测为主验证。以下方案供队长在路由器上执行；测试工程师不自行 SSH，避免并发部署冲突。
> 假设：SSH 别名 `router`（root@192.168.2.1，iStoreOS x86_64）；运行副本 `/mnt/nvme0n1-4/docker/clipclip`（容器 `clipclip`，镜像 `clipclip:0.1.0`，宿主端口 5678，卷 `./data:/data`）；源码 `/mnt/nvme0n1-4/projects/clipclip`。
> 部署前健康基线（旧版本）：`{"status":"ok","version":"0.1.0","storage":{"pastes":0,"files":3}}`。
> **注意**：新版本 `/api/health` 已移除 `storage` 字段并新增 `publicMode`/`needsAuth`，部署后无 `storage` 属预期变化，不是回归。

### B.1 部署步骤（队长执行）

```bash
ssh router
cd /mnt/nvme0n1-4/docker/clipclip

# 1) 备份旧副本（含运行时数据）
tar czf ~/clipclip-backup-$(date +%F-%H%M).tar.gz -C /mnt/nvme0n1-4/docker clipclip
# 2) 同步源码（仅运行时需要的文件；.dockerignore 已排除 tests/docs/data）
rsync -av --delete \
  --exclude='.agent-teams' --exclude='data' --exclude='tests' --exclude='docs' \
  /mnt/nvme0n1-4/projects/clipclip/ /mnt/nvme0n1-4/docker/clipclip/

# 3) 构建 + 重启（本地模式：确保 CLIPCLIP_ACCESS_TOKEN 未设置或为空）
cd /mnt/nvme0n1-4/docker/clipclip
# 编辑 .env / compose 环境，确保 CLIPCLIP_ACCESS_TOKEN=  (空)
docker compose build
docker compose up -d
docker compose ps           # 状态应为 Up (healthy)
docker compose logs -f --tail=50   # 应见启动模式日志
```

回滚：`docker compose down` → 还原备份 tar → `docker compose up -d`。

### B.2 通用约定

```bash
BASE=http://127.0.0.1:5678
# 封装：打印状态码 + 响应头 + body
req() { curl -sS -i "$@"; echo; }
```

本地模式与公网模式是两次独立部署（切换 token 后需 `docker compose up -d --force-recreate` 重启，因为模式在进程启动时冻结）。

---

### B.3 本地模式用例（CLIPCLIP_ACCESS_TOKEN 为空）

| # | 目的 | curl（节选） | 预期 |
| --- | --- | --- | --- |
| L1 | health 公开且为本地模式 | `curl -s $BASE/api/health` | JSON `status:"ok"`, `publicMode:false`, `needsAuth:false`，**无** `storage` 字段；HTTP 200 |
| L2 | 安全头（本地裁剪） | `curl -sI $BASE/api/health` | `X-Content-Type-Options: nosniff`、`X-Frame-Options: DENY`、`Referrer-Policy: no-referrer`、`X-Accel-Buffering: no` 存在；**无** `Content-Security-Policy`（本地模式不设） |
| L3 | live 读 | `curl -s $BASE/api/live` | 200 JSON `{roomId:"main",content:...,updatedAt:...}` |
| L4 | live 写 + 清空 | `curl -s -X PUT $BASE/api/live -H 'Content-Type: application/json' -d '{"content":"hello-lan"}'` | 200，返回 content=`hello-lan`、updatedAt 非空；再 GET 确认一致；`-d '{"content":""}'` 清空仍 200 |
| L5 | live 非法 body | `curl -s -o /dev/null -w '%{http_code}' -X PUT $BASE/api/live -H 'Content-Type: application/json' -d 'null'` | 400 |
| L6 | SSE 快照 | `timeout 3 curl -sN $BASE/api/events` | 首帧 `data: {"type":"live:snapshot",...}`，次帧 `data: {"type":"files:snapshot",...}`；有 `: keep-alive` 心跳；头含 `X-Accel-Buffering: no` |
| L7 | paste 创建 | `curl -s -X POST $BASE/api/pastes -H 'Content-Type: application/json' -d '{"content":"share-me"}'` | 201，返回 `{id,url:"/p/<id>",expiresAt}` |
| L8 | paste 读取 | `curl -s $BASE/api/pastes/<id>` | 200，content=`share-me`；错误 id → 404 `{"error":"Paste not found."}` |
| L9 | paste 有效期 | `curl -s -X POST $BASE/api/pastes -H 'Content-Type: application/json' -d '{"content":"x","expiresInHours":1}'` | 201，expiresAt 约为 1 小时后；`expiresInHours:999`（>168）→ 400 `Invalid expiresInHours.` |
| L10 | 文件上传 | `curl -s -X POST $BASE/api/files -H 'Content-Type: text/plain' -H "X-File-Name: $(printf '测试 文件.txt' \| jq -sRr @uri)" --data-binary 'hello-file'` | 201，`fileName` 为解码后的中文名，`downloadUrl` 形如 `/api/files/<id>/download` |
| L11 | 文件列表/最新 | `curl -s $BASE/api/files/recent` / `$BASE/api/files/latest` | 200，最新上传在最前；无文件时 latest→404 |
| L12 | 下载 + 安全头 | `curl -sI $BASE/api/files/<id>/download` | 200；`Content-Type: application/octet-stream`（即便上传时声明 text/html）；`Content-Disposition: attachment; filename="..."; filename*=UTF-8''%E6%B5%8B...`；`X-Content-Type-Options: nosniff`；`Cache-Control: no-store` |
| L13 | 缺失 blob | 手动删除卷中某上传文件后下载 | 404 JSON `{"error":"File not found."}`，容器**不退出**（`docker compose ps` 仍 healthy） |
| L14 | 静态页 | `curl -s $BASE/ \| grep -o 'id="login-view"'` | 200 HTML，含 `id="app-shell"`、`id="login-view"`、`<script type="module" src="/app.js">` |
| L15 | 405 / 400 | `curl -s -o /dev/null -w '%{http_code}' -X DELETE $BASE/api/live`；`printf 'BROKEN\r\n\r\n' \| timeout 2 nc 127.0.0.1 5678` | 405；后者连接收到 `400 Bad Request` 且服务存活 |

---

### B.4 公网模式用例（设置 CLIPCLIP_ACCESS_TOKEN 并强制重启）

```bash
# 切换公网模式（token 用强随机值，仅本轮使用）
export TOKEN='qa-public-token-1234567890'
# 编辑 compose/.env 设置 CLIPCLIP_ACCESS_TOKEN=$TOKEN 后：
docker compose up -d --force-recreate
```

| # | 目的 | curl（节选） | 预期 |
| --- | --- | --- | --- |
| P1 | health 报告公网模式且不回显 token | `curl -s $BASE/api/health` | 200，`publicMode:true`, `needsAuth:true`，无 `storage`、无 token 字段 |
| P2 | 公网安全头 | `curl -sI $BASE/api/health` | `Content-Security-Policy: default-src 'self'; ...`（无 unsafe-inline）、`Cross-Origin-Opener-Policy`、`Cross-Origin-Resource-Policy`、`Permissions-Policy`、`X-Content-Type-Options`、`X-Frame-Options`、`Referrer-Policy`、`X-Accel-Buffering`。HTTP 下**无** `Strict-Transport-Security` |
| P3 | 未授权数据端点（核心） | `for p in /api/live /api/files/recent /api/files/latest /api/events /api/pastes/xxx; do curl -s -o /dev/null -w "%{http_code} " $BASE$p; done` | 全部 **401**，响应体 `{"error":"Unauthorized"}`，无任何数据字段 |
| P4 | 未授权写 | `curl -s -o /dev/null -w '%{http_code}' -X PUT $BASE/api/live -H 'Content-Type: application/json' -d '{"content":"x"}'` | 401 |
| P5 | 登录失败 | `curl -s -X POST $BASE/api/login -H 'Content-Type: application/json' -d '{"token":"wrong"}'` | 401 `{"error":"Invalid token"}` |
| P6 | 登录成功 + Cookie 属性 | `curl -s -i -X POST $BASE/api/login -H 'Content-Type: application/json' -d "{\"token\":\"$TOKEN\"}"` | 200 `{"ok":true}`；`Set-Cookie: clipclip_session=<base64url>; HttpOnly; SameSite=Strict; Path=/; Max-Age=86400`（HTTP 下无 Secure） |
| P7 | Secure 条件 | 同上加 `-H 'X-Forwarded-Proto: https'` | Set-Cookie 追加 `; Secure`；响应头出现 `Strict-Transport-Security: max-age=31536000; includeSubDomains` |
| P8 | Bearer 访问（主 token） | `curl -s -H "Authorization: Bearer $TOKEN" $BASE/api/live` | 200 |
| P9 | Cookie 访问（会话） | `curl -s $BASE/api/live -b 'clipclip_session=<P6返回的session值>'` | 200 |
| P10 | 错误 Bearer | `curl -s -o /dev/null -w '%{http_code}' -H 'Authorization: Bearer nope' $BASE/api/live` | 401 |
| P11 | 限速（5 次/分钟） | 连续 5 次 P5，再发第 6 次（即使用正确 token） | 第 6 次 429 `{"error":"Too many attempts"}`，建议带 `Retry-After`；成功后计数重置需换 IP 或等窗口过期再验 P6 |
| P12 | 登出 | `curl -s -i -X POST $BASE/api/logout -b 'clipclip_session=<session>'` | 200 `{"ok":true}`；`Set-Cookie: clipclip_session=; ... Max-Age=0`；随后用旧 cookie 访问 /api/live → 401 |
| P13 | SSE 鉴权 | 未授权 `curl -sN $BASE/api/events` → 401；带 Bearer/Cookie → 200 收到 snapshot | 与 P3 一致的 401 体；授权后见 L6 的快照帧 |
| P14 | 授权后下载头 | 带 Bearer 下载文件 | 与 L12 一致（octet-stream + filename* + nosniff + no-store） |
| P15 | 静态页策略 | `curl -s -o /dev/null -w '%{http_code}' $BASE/` 与 `$BASE/p/<id>` | **200**（当前实现：静态页公开，前端 JS 读取 health.publicMode 后显示登录页；API 数据受保护）。若队长要求静态页也 401/跳登录，需反馈后端调整（契约 §9 标为可选） |

> **限速测试注意**：P11 会锁定来源 IP 1 分钟，建议在 P6/P8/P9/P12 之后再执行 P11，或改用不同来源 IP；P11 之后如需再测登录请等待 60 秒窗口过期。

---

## C. 仍存限制与目标宿主补验清单

1. **Docker / 浏览器**：本环境无 Docker、无浏览器 DOM，故真实容器部署、CSP 在浏览器中的执行、EventSource 长连接保活、中文文件名浏览器显示、CSS 响应式与对比度需由队长按 B 节在路由器/浏览器补验。
2. **UNC 沙箱**：本地无法直接执行 `npm test`/`npm run lint`（named-pipe EPERM + UNC 子进程不可达），采用镜像 + 打包 Node 逐文件执行；在目标宿主（Linux 路由器）上这些限制不存在，可直接：
   ```bash
   cd /mnt/nvme0n1-4/projects/clipclip
   npm run verify      # = lint && build && test（node --test 在 Linux 无 spawn 限制）
   ```
3. **测试文件随源码部署**：本轮新增的 4 个 client 测试文件位于 `tests/client/`，但 `.dockerignore` 已排除 `tests`，镜像内不含测试；在路由器源码目录直接 `npm test` 即可执行全部 59 用例。
4. **动态行为补验**：SSE 空闲超时、上传并发上限、登录失败限速的跨重启清零（内存级）属运行时行为，建议在路由器用真实进程做一次长连接与限速窗口观察。
5. **潜在缺陷复查**：t3 基线曾发现 `getLatestFile/listRecentFiles/getSummary` 不过滤过期项；t9 已修复并由 `expired files are filtered...`（storage）与 `expired files are hidden...`（app）两个用例覆盖，本地 PASS；路由器可用一个 TTL=0 的文件（L10 后手动改 state 的 expiresAt 为过去时间并重启）验证 `/api/files/latest` 返回 404。

---

## D. 路由器实测执行结果（队长已执行，2026-11-23）

**环境**：iStoreOS x86_64，SSH `router`→root@192.168.2.1；运行副本 `/mnt/nvme0n1-4/docker/clipclip`；容器 `clipclip`（镜像 `clipclip:0.1.0`，Docker 27.3.1 / Compose v5.1.3）；健康探针在容器内以 Node 22 运行（宿主 Node 20.18.3 不参与构建）。

**部署流程（全部成功）**：
1. 备份旧运行副本 → `/mnt/nvme0n1-4/docker/clipclip-backup-20261123-112630`（2.6M）。
2. tar 同步工作区源码 → 运行副本（排除 `data/`、`.git/`、`.agent-teams/`、`*.bak-*`），数据完整保留。
3. `chown -R 1000:1000 data`（非 root 容器所需）。
4. `docker compose config -q` → OK；`docker compose build` → 成功（`b2e74a8ce1d6`，含 HEALTHCHECK/USER node）。
5. `docker compose up -d --force-recreate` → 容器 `Up (healthy)`。

**本地模式（无 token）实测 —— 全部通过**：

| 用例 | 结果 |
| --- | --- |
| `/api/health` | `{"status":"ok","version":"0.1.0","publicMode":false,"needsAuth":false}` |
| 首页 `/` 与 8 个静态模块（含 `/js/*.js`） | 全部 200 |
| live GET / PUT / GET 回读 | 200，内容一致；SSE snapshot 帧正确推送 |
| paste 创建（`expiresInHours:1`）/ 读取 / `/p/<id>` 页面 | 201/200/200；expiresAt 恰为 +1h（TTL 契约生效） |
| 文件上传（`X-File-Name`）/ 下载内容 / `/api/files/recent` | 上传 201、下载内容正确、recent 列表含新文件 |
| 下载安全头 | `Content-Type: application/octet-stream`、`Content-Disposition: attachment; filename="..."; filename*=UTF-8''...`、`X-Content-Type-Options: nosniff` |
| 安全头（本地） | `nosniff` / `X-Frame-Options: DENY` / `X-Accel-Buffering: no`；无强制 CSP（符合本地零摩擦设计） |

**公网模式（`CLIPCLIP_ACCESS_TOKEN` + `CLIPCLIP_TRUST_PROXY=true`）实测 —— 全部通过**：

| 用例 | 结果 |
| --- | --- |
| health | `publicMode:true, needsAuth:true`（不含 token/数据） |
| 未授权数据端点 `/api/live`、`/api/events`、`/api/files/recent`、`/api/pastes/x` | 全部 401 `{"error":"Unauthorized"}` |
| 静态资源 `/`、`/p/abc`、`/app.js`、`/js/api.js`、`/styles.css` | 全部 200（登录 UI 可渲染） |
| 安全头 | CSP（无 `unsafe-inline`，`connect-src 'self'` 不阻断 SSE）、COOP、CORP、Permissions-Policy、**COEP: require-corp** |
| 登录：错误 token / 正确 token | 401 `Invalid token` / 200 `{ok:true}` + `Set-Cookie: clipclip_session=<base64url>; HttpOnly; SameSite=Strict; Path=/; Max-Age=86400` |
| 登录后访问：session cookie / Bearer 主 token | 均 200，返回 live 数据 |
| 登出 | 200 `{ok:true}`，旧 cookie 失效 |
| 限速（同 IP 6 次失败） | 前 5 次 401、第 6 次 429 |
| **XFF 独立限速（trustProxy=true）** | `X-Forwarded-For: 10.0.0.1` 第 6 次 429；换 `10.0.0.2` 仍为独立 401（桶相互独立）✅ |

**集成缺陷发现与修复（实测中发现）**：
- 现象：首轮公网测试 `CLIPCLIP_TRUST_PROXY=true` 未生效，不同 XFF 仍共享同一限速桶。
- 根因：`docker-compose.yml` 的 `environment:` 段未透传该变量，`docs/SECURITY.md` 与 README 亦未纳入部署说明。
- 修复：compose environment 补齐 `CLIPCLIP_TRUST_PROXY` 及 t9 新增的全部变量（PASTE_TTL_MAX_HOURS / PASTE_CONTENT_LIMIT / SESSION_TTL_SECONDS / MAX_SSE_CLIENTS / SSE_HEARTBEAT_MS / SSE_IDLE_TIMEOUT_MS），README 环境变量表同步；复测确认变量进入容器（`printenv` → `true`）且 XFF 限速正确。
- 另修复 SECURITY.md §3.5/§3.6 残留的“独立 /login 路由”“静态页受保护”“logout 需鉴权”三处与实现不符的描述。

**最终状态**：服务已恢复本地模式（`publicMode:false`），无测试 token 残留；路由器工作区完整测试套件 **61/61 通过**，build-check / lint-check 通过；旧副本备份保留以便回滚。

---

## E. 迭代二实测方案与结果（t21；队长执行）

> 依据 `docs/ITERATION-2.md`。迭代二新增：QR 快速配对、PWA、paste 口令/焚毁、multipart curl 上传。
> 本节上半为本地可验证结果（测试工程师已执行），下半为路由器真实 Docker 实测 curl 清单（队长统一执行，测试工程师不自行 SSH）。

### E.1 本地验证环境与结果（本环境已执行）

| 项 | 值 |
| --- | --- |
| Node | 打包版 v24.21.0（`C:\Users\zqs1q\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe`） |
| 方法 | 工作区逐字镜像到 `C:\Users\zqs1q\AppData\Local\Temp\dsh-01IqLh\clipclip-t21`，逐文件 `node <test>` 进程内执行（沙箱禁止 spawn/UNC 子进程，与 t13 同） |

**全量测试：11 个文件 92/92 全部通过。**

| 测试文件 | 用例数 | 结果 | 覆盖 |
| --- | --- | --- | --- |
| `tests/server/storage.test.js` | 14 | PASS | t19 新增 passphrase hash/readPaste/reveal/burn 并发/legacy 兼容 |
| `tests/server/app.test.js` | 29 | PASS | t19 新增 burn 首读/次读、passphrase GET 403/错误 reveal 403/正确 reveal 200、state 无明文、并发 reveal、multipart UTF-8+RFC5987/413/公网 401、trustProxy |
| `tests/client/clipboard.test.js` | 2 | PASS | 迭代一回归 |
| `tests/client/button-feedback.test.js` | 1 | PASS | 迭代一回归 |
| `tests/client/format.test.js` | 6 | PASS | t13 新增 |
| `tests/client/i18n.test.js` | 5 | PASS | t13 新增 |
| `tests/client/state.test.js` | 7 | PASS | t13 新增 |
| `tests/client/api.test.js` | 7 | PASS | t13 新增 |
| **`tests/client/qr.test.js`（t21 新增）** | 9 | PASS | QR 结构/确定性/ECC 回退/UTF-8/版本选择/超长报错/finder/timing pattern/SVG 渲染 |
| **`tests/client/sw.test.js`（t21 新增）** | 6 | PASS | SW 监听器注册、绝不拦截 /api/*、忽略非 GET/跨域、静态 cache-first、导航 network-first、预缓存列表无 API |
| **`tests/client/iteration2.test.js`（t21 新增）** | 6 | PASS | createPaste 可选字段省略规则、revealPaste 端点/口令体、403→forbidden 映射、pastePage 状态机、qrTargetUrl 仅 origin+pathname 不含 token |

**门禁**：`node --check` 全部 36 个 JS → 36/36 通过；`build-check` → PASS（11 必需文件 / 1 HTML / 17 浏览器模块）；`lint-check` 的 tab 检查通过，其内部 `spawnSync(node --check)` 因沙箱 EPERM 退出 1（环境限制，语法已由独立 node --check 全绿佐证）。`node --test` 生成器模式同样因沙箱 spawn EPERM 不可用，逐文件执行全绿。

> **复核结论**：t19 后端 43/43 已有测试覆盖 burn/passphrase/multipart/鉴权，本轮全部复核通过，未重复修改；t18 前端可测逻辑（QR URL 构造、SW 缓存策略、paste 口令状态机）此前无自动化测试，本轮由 3 个新测试文件（21 用例）补齐。

### E.2 路由器迭代二实测 curl 清单（队长执行）

```bash
ssh router
cd /mnt/nvme0n1-4/docker/clipclip
# 同步迭代二源码 → 备份 → build → up -d --force-recreate（沿用 D 节流程）
BASE=http://127.0.0.1:5678
```

**① QR 码配对**
| # | 用例 | curl / 检查 | 预期 |
| --- | --- | --- | --- |
| Q1 | 首页含扫码按钮与模块 | `curl -s $BASE/ \| grep -oE 'id="qr-button"\|js/qr-modal.js\|js/qr.js'` | 命中 `qr-button`、`/js/qr.js`、`/js/qr-modal.js` |
| Q2 | QR 模块可加载 | `curl -s -o /dev/null -w '%{http_code}' $BASE/js/qr.js` 与 `$BASE/js/qr-modal.js` | 均 200，MIME `text/javascript` |
| Q3 | 二维码内容 = 实例 URL | 浏览器打开首页 → 点「扫码」→ 检查二维码下方 URL 文本 = `location.origin + location.pathname`（如 `http://192.168.2.1:5678/`），**不含 token/剪贴板内容** | URL 正确且无 token |
| Q4 | 模态框无障碍 | 打开模态 → ESC 关闭、点遮罩关闭、Tab 焦点环、焦点恢复；`role=dialog aria-modal=true` | 全部符合 |

**② PWA**
| # | 用例 | curl / 检查 | 预期 |
| --- | --- | --- | --- |
| W1 | manifest | `curl -sI $BASE/manifest.json` | 200，MIME `application/manifest+json` 或 `application/json` |
| W2 | icon | `curl -sI $BASE/icon.svg` | 200，MIME `image/svg+xml` |
| W3 | service worker | `curl -sI $BASE/sw.js` | 200，MIME `text/javascript`；内容含 `clipclip-static-` 版本缓存名 |
| W4 | SW 不缓存 API | 代码审查：`sw.js` 的 fetch 监听对 `/api/*` 直接 `return`；浏览器 DevTools → Application → Cache Storage 中无任何 `/api/*` 条目 | 无 API 响应被缓存 |
| W5 | SW 注册限制 | http LAN 下 `isSecureContext=false` → 不注册（控制台无报错）；HTTPS/localhost 下注册成功 | 符合契约 |

**③ burn-after-read**
| # | 用例 | curl / 检查 | 预期 |
| --- | --- | --- | --- |
| B1 | 创建 burn paste | `RESP=$(curl -s -X POST $BASE/api/pastes -H 'Content-Type: application/json' -d '{"content":"burn-me","burnAfterRead":true}')`；echo `$RESP` | 201，含 `id`、`burnAfterRead:true` |
| B2 | 首读 | `ID=$(echo $RESP \| jq -r .id)`；`curl -s $BASE/api/pastes/$ID` | 200，content=`burn-me` |
| B3 | 次读 | 再 `curl -s -o /dev/null -w '%{http_code}' $BASE/api/pastes/$ID` | **404** |

**④ passphrase**
| # | 用例 | curl / 检查 | 预期 |
| --- | --- | --- | --- |
| S1 | 创建带口令 paste | `PRESP=$(curl -s -X POST $BASE/api/pastes -H 'Content-Type: application/json' -d '{"content":"secret-data","passphrase":"/pass123"}')`；echo `$PRESP` | 201，`hasPassphrase:true`，响应**不含口令** |
| S2 | GET 受保护粘贴 | `PID=$(echo $PRESP \| jq -r .id)`；`curl -s -i $BASE/api/pastes/$PID` | **403** `{"error":"Passphrase required"}`，**不含** `secret-data` |
| S3 | reveal 错口令 | `curl -s -o /dev/null -w '%{http_code}' -X POST $BASE/api/pastes/$PID/reveal -H 'Content-Type: application/json' -d '{"passphrase":"wrong"}'` | **403** `{"error":"Invalid passphrase"}` |
| S4 | reveal 对口令 | `curl -s -X POST $BASE/api/pastes/$PID/reveal -H 'Content-Type: application/json' -d '{"passphrase":"/pass123"}'` | 200，content=`secret-data` |
| S5 | 口令不明文落盘 | 在容器内 `grep -F '/pass123' /data/state/clipclip-state.json` | **无匹配**（仅存 SHA-256 hash） |
| S6 | burn+口令组合 | 创建 `{content,passphrase,burnAfterRead:true}` → reveal 正确一次 200 → 再 reveal 404 | 焚毁生效 |

**⑤ multipart curl 上传（CLI 友好）**
| # | 用例 | curl / 检查 | 预期 |
| --- | --- | --- | --- |
| M1 | 一行上传 | `printf 'hello-multipart' > /tmp/clip-mp.txt`；`MRESP=$(curl -s -F "file=@/tmp/clip-mp.txt" $BASE/api/files)`；echo `$MRESP` | 201，`fileName:"clip-mp.txt"`，含 `downloadUrl` |
| M2 | 中文字名（RFC5987） | `printf '中文' > /tmp/测试文件.txt`；`curl -s -F "file=@/tmp/测试文件.txt" $BASE/api/files` | 201，`fileName` 为「测试文件.txt」 |
| M3 | 下载头 | `MID=$(echo $MRESP \| jq -r .id)`；`curl -sI $BASE/api/files/$MID/download` | `Content-Type: application/octet-stream`、`Content-Disposition` 含 `attachment` + `filename*=UTF-8''`、`nosniff` |
| M4 | CLI `curl -OJ` | `cd /tmp && curl -OJ $BASE/api/files/$MID/download` | 按 filename* 正确保存文件名 |
| M5 | 大小限制 | 上传 > maxUploadMb 的文件（默认 50MB；或临时设 `CLIPCLIP_MAX_UPLOAD_MB=1` 重启） | 413 |

**⑥ 回归**
| # | 用例 | curl / 检查 | 预期 |
| --- | --- | --- | --- |
| R1 | 本地模式零摩擦 | `curl -s $BASE/api/health` | `publicMode:false`；首页无登录提示、扫码/口令/焚毁控件可用但无需登录 |
| R2 | 公网模式未授权 401 | 设 token 重启后：`curl -s -o /dev/null -w '%{http_code}' $BASE/api/pastes/x/reveal -X POST` 与 `$BASE/api/files/recent` | 均 401 `{"error":"Unauthorized"}`（新端点默认受保护） |
| R3 | 公网模式静态资源放行 | `curl -s -o /dev/null -w '%{http_code}' $BASE/manifest.json`、`$BASE/sw.js`、`$BASE/js/qr.js` | 均 200（PWA/QR 静态资源不受鉴权影响） |

> **执行提示**：S5 需在容器内读取卷文件；若容器以只读根运行，用 `docker compose exec clipclip sh -c 'grep ... /data/state/clipclip-state.json'`（`/data` 为可写绑定卷）。B/S 组测试会写 state，测试后可用 UI 或清理 state 恢复；公网模式测试后务必恢复本地模式，避免 token 残留。下载的 PDF/HTML 类 mime 一律 octet-stream，验证 XSS 防护未回退。

### E.3 迭代二仍存限制

1. **浏览器相关**：QR 实际可扫码识别、模态焦点环、PWA「添加到主屏」与 SW 离线缓存需真机/浏览器验证（curl 只能验证资源可达与 MIME）；纯 HTTP LAN 下 SW 不注册属契约预期。
2. **口令 hash 存储**：本地已由 `passphrase is persisted only as a SHA-256 hash` 用例验证；路由器 S5 为端到端复核。
3. **并发 reveal**：已在本地 `concurrent reveal of a burn paste succeeds only once` 用例（并发 Promise）验证；路由器可用并发 curl 抽样，但单飞队列语义以单测为准。

### E.4 迭代二路由器实测执行结果（队长已执行，2026-11-23）

**部署**：备份迭代一运行副本 → `clipclip-backup-iter1-20261123-124850`；同步源码 → 路由器完整测试 **97/97 通过**（server 48 + client 49）；build-check（18 模块）/ lint-check（37 JS）/ compose config 全部通过；`docker compose build` 成功（`c79ce7e62602`）→ 重建容器 `(healthy)`，本地模式。

| 用例组 | 结果 |
| --- | --- |
| A 健康/静态 | health `publicMode:false`；`/`、`/js/qr.js`、`/manifest.json`、`/sw.js`、`/icon.svg` 全 200 |
| B PWA MIME | manifest→`application/json`；sw.js→`text/javascript`；icon.svg→`image/svg+xml` |
| C burn-after-read | 创建含 `burnAfterRead:true`；首读 200 返回内容；**次读 404**（自动焚毁生效） |
| D passphrase | GET 受保护粘贴→403 `Passphrase required`（无内容）；错口令 reveal→403 `Invalid passphrase`；对口令→200 完整内容 |
| E 口令不明文 | state 中只有 `passphraseHash`（64 位 SHA-256）+ `hasPassphrase:true`，**无明文口令**（grep 计数 0） |
| F multipart | `curl -F "file=@...;filename=报告.txt"` 上传成功，中文名正确；下载头 `attachment` + `filename*=UTF-8''%E6%8A%A5%E5%91%8A.txt` + octet-stream；下载内容正确 |
| G QR（CDP 真实浏览器） | 扫码按钮存在；模态框 `role=dialog` 打开；SVG 二维码 path 4160 字符；显示 URL=`http://127.0.0.1:5678/`；**hasToken:false**；manifest/icon link 齐全；`isSecureContext` 下 SW 支持 |
| H 公网回归 | 设 token 后 health `publicMode:true`；reveal 与 multipart 未授权均 **401**；PWA 静态资源 200；恢复本地模式成功 |

**reveal 暴破限速（t23 加固）**：由自动化测试覆盖（5 次错误→429+Retry-After、双键独立、成功清零、404 不计数、XFF 生效），路由器单测 48/48 通过。

**数据清理**：实测写入的 burn paste、passphrase paste、multipart 测试文件已精准删除；用户原有 3 个文件完好；服务恢复本地模式、无 token 残留。

**剩余限制**：QR 真机扫码识别、PWA 安装与离线缓存、模态焦点环仍需真机/浏览器人工确认（CDP 已验证 DOM/模态/SVG 结构正确）；纯 HTTP LAN 下 SW 不注册属契约预期。

---

## F. 品牌重塑验证（t27；纸墨编辑风）

> t25 从头重写了 `public/index.html` 与 `styles.css`，并新增 `public/brand/*` 品牌资产。视觉重构最大的风险是「改坏功能 DOM 契约」。本章记录防止功能回退的回归网、本地结果，以及队长用真实浏览器 CDP 截图验收的方案。契约依据 `docs/BRAND.md` §6（DOM）与 §8（视觉验收）。

### F.1 本地验证结果与新增测试

| 项 | 值 |
| --- | --- |
| Node | 打包版 v24.21.0；工作区逐字镜像到 `C:\Users\zqs1q\AppData\Local\Temp\dsh-01IqLh\clipclip-t27`，逐文件进程内执行（沙箱 spawn/UNC 受限，同前几轮） |
| 全量测试 | **13 个测试文件 109/109 全部通过**（server storage14 + app29 = 43；client clipboard2 + button1 + format6 + i18n5 + state7 + api7 + qr9 + sw6 + iteration2 6 = 43；本轮新增 brand-contract8 + a11y9 = 17） |
| `node --check` | 全部 38 个 JS → 38/38 通过 |
| `build-check` | PASS（11 必需文件 / 1 HTML / 17 浏览器模块；含新 brand 资产引用校验） |
| `lint-check` | tab 检查通过（无 tab）；内部 `spawnSync(node --check)` 因沙箱 EPERM 退出 1，已由独立 node --check 38/38 佐证（环境限制，同前几轮） |

**新增测试文件：**

- `tests/client/brand-contract.test.js`（8 用例）：从 `docs/BRAND.md` §6 的 `- IDs:` 代码段**动态解析出全部 68 个契约 id**，逐一断言在 `index.html` 中存在且唯一；校验 `data-i18n` / `data-i18n-placeholder` / `data-i18n-aria-label` / `data-tab` / `data-panel` / `data-lang` / `data-alert` / `data-role="copy"` 及具体 hook 值；校验 alert 结构（`.alert-text`/`.alert-action`）与模板类（`.result-title`/`.mini-badge`/`.result-sub`/`.link-button`/`.result-meta`/`.history-*`/`.dropzone`/`.tab-button`/`.lang-button`）；校验 HTML 引用的每个 i18n key 在中英词典都存在、两词典 key 集合完全一致、rebrand 新增键（brand.*/footer.*/actions.qr/actions.copied/qr.*/paste.burn*/pasteLock.*）齐全、`actions.copied` 用文字符号「✓」非 emoji。
- `tests/client/a11y.test.js`（9 用例，纯结构检查）：3 个 `role=tab`（含 aria-selected/aria-controls）、3 个 `role=tabpanel`（含 aria-labelledby）、tablist 有可访问名、QR 模态 `role=dialog aria-modal=true aria-labelledby`、status/aria-live/progressbar 语义、所有 `<img>` 有 alt（装饰图空 alt）、表单控件有 label/aria 钩子、语言按钮 aria-pressed、无 emoji-only 按钮。对比度不在此测（需 CDP，见 F.2）。

> **复核结论**：t25 重构完整保留了 BRAND §6 的 68 个契约 id 与全部 data-hook/i18n key，回归网 17 用例全绿；未发现功能回退。**测试工程师仅改 tests/，未触碰 public/src/docs/data。**

### F.2 队长用真实浏览器 CDP 截图验证方案（待执行）

> 对比度（BRAND §8：正文≥7:1、强调按钮≥4.5:1、元信息≥4.5:1）与视觉观感必须真机验证。队长在路由器部署后用 Chrome/Edge CDP（`--headless --remote-debugging-port` 或 DevTools Protocol）按以下 4 个场景截图：

```bash
# 在能访问路由器的机器上，用 Chrome headless + CDP（示例）
BASE=http://192.168.2.1:5678
# 浅色 375px
chrome --headless --disable-gpu --screenshot=/tmp/cc-light-375.png --window-size=375,900 --force-color-profile=srgb "$BASE/"
# 深色 375px（模拟 prefers-color-scheme: dark）
chrome --headless --disable-gpu --screenshot=/tmp/cc-dark-375.png --window-size=375,900 --force-dark-mode "$BASE/"
# 浅色 320px（窄屏无横滚）
chrome --headless --disable-gpu --screenshot=/tmp/cc-light-320.png --window-size=320,800 "$BASE/"
# 桌面浅色 1280px
chrome --headless --disable-gpu --screenshot=/tmp/cc-desktop.png --window-size=1280,900 "$BASE/"
# 或用 CDP Emulation.setEmulatedMedia({features:[{name:'prefers-color-scheme',value:'dark'}]})
#     + Emulation.setDeviceMetricsOverride + Page.captureScreenshot 精确控制
```

CDP 可补充的自动检查（队长可执行 JS 表达式）：
```js
// 无横向滚动：scrollWidth <= clientWidth
document.documentElement.scrollWidth <= document.documentElement.clientWidth
// 触控目标 ≥44px（遍历交互元素检查 getBoundingClientRect）
[...document.querySelectorAll('button,a,input,select,[role=tab]')]
  .filter(e => e.offsetParent !== null)
  .map(e => ({t: e.textContent.trim().slice(0,12), h: Math.round(e.getBoundingClientRect().height)}))
  .filter(x => x.h > 0 && x.h < 44)
// 焦点环：Tab 后 getComputedStyle(document.activeElement).outlineWidth
// 对比度：对正文/按钮/元信息取 computed color 与背景色算 WCAG 比值
// 色板核验：getComputedStyle(document.documentElement).getPropertyValue('--paper') 等
```

### F.3 视觉验收清单（对照 BRAND.md §8）

| # | 验收项 | 通过标准 |
| --- | --- | --- |
| V1 | 品牌资产齐全 | `public/brand/` 含 logo/mark/lockup/icon/og-image，风格统一（朱红印章 + 回形夹） |
| V2 | 纸墨语言 | 暖纸底 #F4F1EA、发丝线、衬线大标题、等宽元信息、朱红克制点缀；**无**旧蓝 #1368bf、无药丸、无大阴影、无彩色渐变 |
| V3 | 对比度 | 正文 ≥7:1、朱红按钮白字 ≥4.5:1、元信息 ≥4.5:1（CDP 计算） |
| V4 | 响应式 | 375/320px 无横向滚动；触控目标 ≥44px；移动端 tab 保持 3 列；textarea 首屏 ≥40vh |
| V5 | 键盘可达 | 全键盘可达、朱红 2px 焦点环可见；tab 方向键/Home/End 切换 |
| V6 | 深色模式 | 暖黑 #171715「夜读纸」而非简单反转；QR 框固定纸白保证可扫 |
| V7 | DOM 契约 | 68 契约 id + data/i18n key 保留 → 本轮 17 用例 + 全量 109/109 全绿（已验证 ✅） |
| V8 | 真实截图 | 浅色/深色/375/320px 截图确认视觉；README 门面更新（docs-maintainer 负责） |

> **说明**：V1/V2/V7 已由本地测试与产物核验覆盖；V3/V4/V5/V6/V8 的视觉与对比度结论由队长 CDP 截图后在验收清单勾选。静态 DOM/a11y 结构已由本轮 17 用例保证，浏览器侧的对比度计算不属于静态测试范围。

