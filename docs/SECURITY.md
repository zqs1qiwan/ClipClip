# ClipClip 双模式安全契约（SECURITY CONTRACT）

> 状态：实现契约 / 验收基线
> 生成于 2026-11-23（安全审查员，任务 t8）
> 适用范围：`src/server/*`、`public/*`、`docker-compose.yml`、`Dockerfile`、`README.md` 及部署文档
> 配套文档：[PRD.md](PRD.md) Security Requirements、[ARCHITECTURE.md](ARCHITECTURE.md) Security Controls、[ROADMAP.md](ROADMAP.md)（RM-12/13/14/18/25/29/31）

本文是**规范性契约**，不是描述性现状报告。后端、前端、运维按本文实现；安全审查按本文第 8 节清单逐条验收。文中 `MUST` / `SHOULD` / `MAY` 为 RFC 2119 语义。

---

## 1. 安全目标与威胁模型

### 1.1 产品定位

ClipClip 是本地分享工具，两种部署形态差异巨大：

| 形态 | 信任边界 | 优先级 | 鉴权 |
| --- | --- | --- | --- |
| **本地模式**（LAN） | 受信局域网 | 零摩擦、易用 | 无登录 |
| **公网模式**（Internet 暴露） | 完全不可信 | 默认安全、防泄露/滥用 | 强制 token 登录 |

剪贴板内容可能包含口令、令牌、地址、个人隐私（PRD:16,158）。因此任何“无鉴权读取全部数据”的形态**只允许出现在本地模式**。

### 1.2 要防的威胁

- **T1 未授权数据读取**：匿名访问 `/api/live`、`/api/files/recent`、`SSE /api/events`、下载端点、`/p/:id` 页面即可拿到剪贴板/文件。
- **T2 凭据窃取与重放**：token 出现在 URL、日志、`localStorage`、明文 cookie；比较存在时序侧信道。
- **T3 存储型 XSS / 内容欺骗**：上传的 `Content-Type` 被原样回显导致 HTML/SVG 载荷；paste 内容被当作 HTML 渲染。
- **T4 路径穿越**：篡改 state 的 `storedName` 或文件名读取 `/data` 外文件。
- **T5 资源滥用 DoS**：SSE/上传/登录无限流，打满 512MB 容器（docker-compose.yml:5）。
- **T6 敏感信息泄露**：日志打印 token/正文/文件名；仓库内残留含明文凭据的 `data/`。

---

## 2. 双模式开关（SEC-01）

### 2.1 判定规则（MUST）

```
CLIPCLIP_ACCESS_TOKEN 未设置 / 空字符串  -> 本地模式 (local)
CLIPCLIP_ACCESS_TOKEN 非空字符串          -> 公网模式 (public)
```

- 模式在**进程启动时**由 `loadConfig()` 决定并冻结，运行中不得因环境变量变化而切换。
- `/api/health` 公开可用，MUST 返回布尔字段 `publicMode`（`true`=公网模式，`false`=本地模式），供前端探测是否显示登录入口；但**不得**回显 token 本身或其片段/哈希前缀。
- 启动时向 stdout 打印当前模式（如 `ClipClip access mode: public`），这是允许的运营日志。

### 2.2 本地模式行为（MUST）

- 所有数据端点与静态页面无需鉴权。
- 前端**不显示**登录入口、登录页、token 输入框；不得因 `/api/login` 存在而暴露 UI。
- 安全响应头按 [§4.3 本地模式的头裁剪](#43-本地模式头裁剪must) 裁剪，但 `X-Content-Type-Options: nosniff` 与 `X-Frame-Options` MUST 保留。
- 文档与启动日志需提示：“当前为 trusted-LAN 模式；若需公网暴露，请设置 `CLIPCLIP_ACCESS_TOKEN` 并前置 HTTPS/鉴权”。

### 2.3 公网模式行为（MUST）

- 除登录相关端点外，**一切**返回数据或执行副作用的端点都必须先通过鉴权（端点矩阵见 §9）。
- 未授权请求：
  - 对 `/api/*`（含 SSE）：返回 `401` + JSON `{"error":"Unauthorized"}`，不得泄露任何数据字段；
  - 静态资源（`/`、`/p/:id`、`/styles.css`、`/app.js`、`/button-feedback.js`、`/lib/clipboard.js`、`/js/*.js`）**本项目选择公开**：`200` 返回 `public/index.html` 或对应资源，登录 UI 由前端 index.html 渲染；静态资源本身不含数据，数据仅通过受保护 API 获取（t15 集成修复，替代 t9 早期“静态页 401”描述）。

---

## 3. 公网模式鉴权（SEC-02）

### 3.1 主凭据

- 唯一主凭据为环境变量 `CLIPCLIP_ACCESS_TOKEN`。SHOULD 至少 32 字节 CSPRNG（如 `openssl rand -base64 32`）生成。
- 该值 MUST NOT 出现在源码、日志、URL query、响应体、`localStorage`、`data/state/*`。

### 3.2 登录端点 `POST /api/login`（MUST）

请求体 JSON：`{ "token": "<CLIPCLIP_ACCESS_TOKEN>" }`。

实现要求：

1. **恒定时间比较**：先将“用户提交的 token”和“配置的 token”各自做 SHA-256 得到等长 32 字节摘要，再用 `crypto.timingSafeEqual` 比较。
   - 原因：`timingSafeEqual` 在长度不等时抛错且会泄露长度信息，MUST 先哈希规整为定长，再比较；不得用 `===` 或早退逐字节比较。
   - 当前实现：`src/server/auth.js` 的 `constantTimeEqual` 对输入先 `sha256()` 定长摘要，再 `crypto.timingSafeEqual` 比较；无明文长度早退。
2. **长度与类型边界**：`token` 必须是字符串且长度在合理范围（如 1–4096）后才进入比较；超长输入直接拒绝并计入失败，避免超大 buffer 打内存。
3. **失败计数限速**：见 [§6.1 登录失败限速](#61-登录失败限速must)。
4. **成功后签发 session**：
   - 生成**随机不透明** session id：`crypto.randomBytes(32).toString("base64url")`（不得把主 token、用户 token 直接当 cookie 值；不得使用可预测序号）。
   - 存入服务端内存 `Map<sessionId, { createdAt, expiresAt }>`，设置绝对过期（24h，与 cookie `Max-Age` 一致）与空闲过期（建议 30min，每次访问滑动续期）。
   - 登录成功返回 `200` + JSON `{ "ok": true }`，并通过 `Set-Cookie` 下发 session。
5. **失败响应（锁定契约，MUST 精确匹配）**：
   - token 错误：`401` + `{ "error": "Invalid token" }`；
   - 触发限速：`429` + `{ "error": "Too many attempts" }`（SHOULD 另带 `Retry-After` 头）；
   - 不得区分“token 错误”与“用户不存在/已锁定”等具体原因（避免用户枚举）。
6. **登出端点**：`POST /api/logout` → `200` + `{ "ok": true }`（详见 §3.6）。

### 3.3 Session Cookie（MUST）

`Set-Cookie` 属性：

```
Set-Cookie: clipclip_session=<random>; HttpOnly; SameSite=Strict; Path=/; Max-Age=86400[; Secure]
```

- Cookie 名 MUST 为 `clipclip_session`，值为不透明随机串（见 §3.2 第 4 点）。
- `HttpOnly`、`SameSite=Strict`、`Path=/`、`Max-Age=86400`：MUST；禁止 JS 读取、抗 CSRF。`Max-Age` 为锁定契约值（24h），服务端 session 绝对过期应与之匹配（见 §3.2）。
- `Secure`：当请求为 HTTPS，或请求头 `X-Forwarded-Proto: https`（隧道/反代场景）时 MUST 设置。
  - 安全前提：应用不得直接对公网暴露，只有可信反代/隧道才能设置 `X-Forwarded-Proto`；否则客户端可伪造该头绕过 Secure。
- **禁止**把 token/session 写入 `localStorage` 或 `sessionStorage`（前端 MUST 不主动读取/存储；依赖 HttpOnly cookie 自动携带）。

**HTTPS 判定（Cloudflare Tunnel / 反代关键坑）**：应用容器内通常看到的是 `http`（TLS 在隧道/反代终止）。因此 `Secure` 判定规则锁定为：请求为 HTTPS **或** `X-Forwarded-Proto: https` 时加 `Secure`。运维 MUST 确保应用端口不直接暴露于公网、且只有可信反代会设置该头（否则可被伪造，导致 cookie 在明文 HTTP 下发送）。

### 3.4 Bearer token 兼容（MUST）

- 除 cookie 外，鉴权中间件 MUST 接受 `Authorization: Bearer <CLIPCLIP_ACCESS_TOKEN>`。
- Bearer 比较同样走 §3.2 的 SHA-256 + `timingSafeEqual` 定长比较，不得 `===`。
- Bearer 仅建议用于 curl/脚本；文档需提示其风险（主凭据长期持有、无 session 过期）。不得在前端 JS 中使用 Bearer。

### 3.5 鉴权中间件覆盖范围（MUST）

- 在路由分发前统一拦截，避免遗漏端点。
- 覆盖：`/api/*` 所有数据端点（含 `GET/POST/PUT`、`GET /api/events` SSE、所有下载）。**静态页面与静态资源不在鉴权范围**（`/`、`/p/<id>`、`/app.js`、`/styles.css`、`/js/*.js` 等均公开，以便前端渲染内嵌登录视图）；静态资源不含敏感数据，数据面统一受控。
- 白名单（公开，无需 session）：`/api/health`、`POST /api/login`、`POST /api/logout`，以及所有非 `/api/` 的静态资源。不存在独立的 `/login` 路由——登录 UI 是 index.html 内嵌视图。
- 任何新增 `/api/*` 端点 MUST 默认落入鉴权范围（白名单制，而非黑名单制）。
- **验收关键点**：公网模式下，用未授权请求依次打 §9 矩阵中每个端点，均不得返回任何剪贴板/文件/paste 数据。

### 3.6 登出（锁定契约，MUST）

- `POST /api/logout` → `200` + `{ "ok": true }`：删除服务端 session 记录并下发同属性、`Max-Age=0` 的过期 cookie。
- 公开端点（无需 session）：`POST /api/logout`。未授权调用返回 `200 {ok:true}`（幂等清 cookie 与 session，避免登录页退出按钮死壳）。

---

## 4. 安全响应头（SEC-03）

### 4.1 公网模式默认头（MUST，所有响应）

```
Content-Security-Policy: default-src 'self'; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'
Strict-Transport-Security: max-age=31536000; includeSubDomains        （仅 HTTPS 响应）
X-Content-Type-Options: nosniff
Referrer-Policy: no-referrer
X-Frame-Options: DENY
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
Cross-Origin-Resource-Policy: same-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()
X-Accel-Buffering: no                                                （SSE 至少；建议全局）
Cache-Control: no-store                                              （所有含数据的响应）
```

- CSP 的 `connect-src 'self'` 覆盖 `fetch` 与 `EventSource`（SSE），不会阻断同源 SSE。
- 现有前端全部使用外链 module 脚本（`public/index.html:143` `<script type="module" src="/app.js">`，`public/app.js:1-2` 外链 import），paste 视图用 `textContent`（`public/app.js:583`），无内联脚本/内联事件处理器/`<style>` 内联块，因此**严格 CSP 无需 `'unsafe-inline'`**。实现 MUST 保持这一性质：优先消除内联脚本，而不是放宽 CSP。
- 注意 `public/app.js:240` 用 `element.style.inlineSize`（CSSOM 写入，允许）而非 `setAttribute('style', ...)`；若前端改为设置 `style` 属性则会被 CSP `style-src` 拦截，需改用 CSSOM 或 nonce。

### 4.2 HSTS 注意

- 仅在确认 HTTPS 时发送；`includeSubDomains` 对共享父域有锁定影响，若域名为共享父域可去掉该指令，改用 `max-age=31536000`。
- 首次 HTTP→HTTPS 跳转场景需规划 preload（可选）。

### 4.3 本地模式头裁剪（MUST）

- 至少保留：`X-Content-Type-Options: nosniff`、`X-Frame-Options: DENY`、`Referrer-Policy: no-referrer`。
- MAY 关闭 HSTS/COOP/COEP（纯 HTTP LAN 下 COEP: require-corp 无意义且可能影响书签/嵌入）；`X-Accel-Buffering: no` 仍 SHOULD 保留于 SSE。

---

## 5. 下载安全（SEC-04）

适用于 `GET /api/files/:id/download`（当前实现 `src/server/app.js:291-309`）。

1. **Content-Type（MUST）**：统一 `application/octet-stream`，或使用**服务端扩展名白名单**映射（如 `.txt→text/plain`、`.pdf→application/pdf`），**忽略**客户端上传时声明的 `Content-Type`（当前 `app.js:129,155-159` 直接反射，属缺陷）。白名单之外一律 `application/octet-stream`。
   - 禁止回显 `text/html`、`image/svg+xml`、`text/javascript` 等可执行类型。
2. **Content-Disposition（MUST）**：
   ```
   Content-Disposition: attachment; filename="<ascii-fallback>"; filename*=UTF-8''<percent-encoded-utf8>
   ```
   - `filename*` 按 RFC 5987/6266 编码（UTF-8 + 百分号编码），解决中文名乱码；`filename` 为 ASCII 回退名（非 ASCII 字符替换为 `_` 或移除）。
   - 当前 `app.js:302` 用 `encodeURIComponent` 仅生成单一 `filename=`，既不规范也导致中文乱码，MUST 修正。
   - 对 ASCII 与 `filename*` 值做引号/反斜杠/CRLF 过滤，杜绝响应头注入。
3. **强制保留**：`attachment` + `X-Content-Type-Options: nosniff` + `Cache-Control: no-store`。
4. **静态资源 MIME**：`getMimeType`（`app.js:51-61`）仅作为本地静态 JS/CSS 的返回类型，MUST 与下载逻辑分离，不得把用户文件名交给该映射决定下载类型。

---

## 6. 限速与并发（SEC-05）

内存级限制即可（单进程、单实例），但需在文档注明重启清零、多实例不共享。

### 6.1 登录失败限速（MUST）

- 按 IP（信任反代时取 `X-Forwarded-For` 最左可信值，注意伪造风险）：**5 次/分钟**失败后：
  - 返回 `429` + `Retry-After`，并对后续尝试施加递增延迟或临时锁定（如 15 分钟）；
  - 记录计数时不写 token 明文。
- 成功后重置该 IP 的失败计数。
- 代理信任开关：`CLIPCLIP_TRUST_PROXY=1`（或 `true`）时按 `X-Forwarded-For` 最左非空且通过 IPv4/IPv6 校验的地址计数；默认 `false`，按 `socket.remoteAddress` 计数（安全默认）。**仅当应用不直暴公网、且前置可信反代会覆盖 XFF 时才能开启**；否则攻击者可伪造 XFF 绕过限速或制造共享 IP 的 429 DoS。README/compose/部署文档 MUST 同步说明该开关（本文件只记录契约）。

### 6.2 SSE 并发上限（MUST）

- `clients` Set（`app.js:107,171-176,214-225`）MUST 有上限（建议 50–100）；超限新连接返回 `429`。
- MUST 实现：心跳注释行（如 `: ping\n\n`，间隔 ≤25s）+ 空闲超时 + 写失败/`req.close` 时移除客户端并处理背压。
- 反代/隧道（nginx 默认 60s、Cloudflare ~100s 无活动断连）依赖心跳保活；SSE 响应 MUST 带 `X-Accel-Buffering: no`。

### 6.3 上传并发上限（MUST）

- 限制同时进行中的上传数（建议 5–10）与单连接速率/时长；超限返回 `429`/`503`。
- 保留现有 `Content-Length` 预检与 `UploadLimitStream`（`app.js:89-104,130-136`），无 `Content-Length` 时仍靠流式限制兜底。
- 磁盘写入失败/超限 MUST 清理临时文件（当前 `app.js:146-151` 已清理，保持）。

### 6.4 Paste reveal 失败限速（MUST — 迭代二实现）

针对 `POST /api/pastes/:id/reveal` 的口令暴破防护（配合 §7.4 的口令哈希）：

- **双键计数**：失败桶按 `客户端 IP + pasteId` 独立计数（不同 paste 之间互不干扰）；IP 由 `auth.js` 导出的 `getRequestIp(req, trustProxy)` 取得——`trustProxy` 为真时取 `X-Forwarded-For` 最左合法 IPv4/IPv6，否则取 `socket.remoteAddress`。本地模式与公网模式均按同一 `CLIPCLIP_TRUST_PROXY` 开关生效（信任代理的伪造风险与 §6.1 相同）。
- **阈值与响应**：**5 次/分钟**失败后，第 6 次返回 `429 {"error":"Too many attempts"}` 并带 `Retry-After: 60`（秒）。到达上限后，即便随后提交正确口令也被拒绝，直到窗口过期。
- **计数清理**：reveal 成功即清除该桶；paste 不存在/已焚毁/过期返回 `404` 时不计数并清除该桶。
- **配置**：`CLIPCLIP_REVEAL_RATE_LIMIT`（默认 `5`）与 `CLIPCLIP_REVEAL_RATE_WINDOW_MS`（默认 `60000`）由 `src/server/config.js` 的 `revealRateLimit` / `revealRateWindowMs` 读取。
- **实现边界**：内存级单实例（重启清零、多实例不共享），定时器 `unref` 定期清理陈旧桶，`server close` 时清理；登录限速（§6.1）未改动。

---

## 7. 敏感数据与日志（SEC-06）

### 7.1 现有数据泄露处置（MUST — 立即）

- `data/state/clipclip-state.json` 的 `liveClipboard.content` **当前含明文疑似凭据**：某工具链的 `client id`、`client secret`、`API key`、`Bearer token` 及密码片段（本文不复述具体值，避免二次扩散）。
- 处置流程（由运维/用户执行，安全审查不代改运行时数据）：
  1. 立即在对应服务方**轮换/吊销**上述所有凭据（假定已泄露）；
  2. 清理该剪贴板内容（在 UI 点 Clear 或重置 state）；
  3. 复核 `data/` 是否被提交/备份/同步到外部，必要时清理历史；
  4. 确认 `.gitignore:15` 与 `.dockerignore:2` 已排除 `data/`，镜像/仓库不含运行时数据。

### 7.2 日志约束（MUST）

- 日志 MUST NOT 记录：token、session id、剪贴板正文、paste 正文、上传字节/文件内容、文件名（超出必要运营元数据时）。
- 允许：状态码、路由模板、耗时、字节计数、错误类型/堆栈（但需确认堆栈不含敏感参数值）。
- 当前 `console.error(error)`（`app.js:326`、`index.js:15`）仅用于异常，保持；若异常对象可能含请求体，需脱敏后再打印。

### 7.3 前端约束（MUST）

- token/session 仅通过 HttpOnly cookie 传递；前端 JS MUST NOT 将 token 写入 `localStorage`/`sessionStorage`、URL、或日志。
- 登录页的 token 输入框：提交后清空内存中的值，不缓存、不自动填充到 DOM 持久属性。

### 7.4 Paste passphrase 安全说明（迭代二实现）

迭代二的粘贴口令保护用于**阻止随手窥探**，不是抗离线攻击的加密方案，必须如实告知用户其强度边界：

- **存储方式**：passphrase 只存**无盐 SHA-256 hash**（`passphraseHash`）+ `hasPassphrase` 标志，绝不落明文（无盐意味着相同口令 hash 相同）。
- **威胁边界**：若 `data/state/clipclip-state.json` 泄露，弱口令可被**离线爆破**（无 salt、单次 SHA-256、无慢哈希 KDF）。因此口令保护仅适用于「防止他人随手打开链接」的场景，**不能保护面对有离线算力攻击者的高敏内容**；高敏内容应使用端到端加密（当前为 Post-MVP 候选）。
- **口令建议**：建议用户选择**高熵口令**（如 16+ 随机字符、口令管理器生成），不要使用字典词、生日或短口令。长度限制 1–128 字符，比较用 SHA-256 + `timingSafeEqual` 定长、恒定时间。
- **在线防护**：`reveal` 端点已有失败限速——5 次/分钟 + `Retry-After: 60`，按 `IP + pasteId` 双键计数，`trustProxy` 下取 `X-Forwarded-For` 最左合法地址（详见 §6.4）。该限速只能缓解在线暴破，不能替代高熵口令或抵御 state 泄露后的离线爆破。
- **读取约束**：受保护粘贴的 `GET /api/pastes/:id` 返回 `403 {"error":"Passphrase required"}` 且**不含任何内容**；须经 `POST /api/pastes/:id/reveal` 提交正确口令。口令不明文写入日志或 state。

---

## 8. 边界校验与健壮性（SEC-07）

1. **state 条目 schema 校验（MUST）**：加载 state（`storage.js:75-92`）与写入前，逐条校验 paste/file 字段类型与格式；`storedName` MUST 匹配生成格式（`<id>-<safeName>`，其中 id 为 base64url，safeName 不含路径分隔符），**禁止** `..`、`/`、`\`、绝对路径与空值。非法条目隔离（跳过/删除）而非参与 `path.join`（当前 `storage.js:98,108,151,181,191,197` 直接使用 `storedName` 拼路径）。对应 ROADMAP RM-18。
2. **缺失 blob 不崩溃（MUST）**：下载时先 `stat`/`access` 校验 blob 存在，或对 `fs.createReadStream(...).pipe(res)`（`app.js:307`）挂载 `error` 监听；文件缺失返回 `404`，**不得**因未处理的 stream `error` 事件导致进程退出。静态 `sendFile`（`app.js:18-25`）同理需防 TOCTOU。
3. **畸形输入不崩溃（MUST）**：畸形 URL、非法 percent 编码、超大头、坏 JSON（`readJsonBody`，`app.js:27-41`）均返回 4xx，进程存活；全局需有兜底异常处理，任何单请求异常不得终止进程。
4. **文件名清洗（SHOULD）**：补齐 Windows 保留设备名（CON/NUL/COM1…）、前导点、DEL/高位控制字符处理（对应 RM-31）；继续保留 ID 前缀防穿越。

---

## 9. 端点鉴权矩阵（验收依据）

| 端点 | 本地模式 | 公网模式 | 备注 |
| --- | --- | --- | --- |
| `GET /api/health` | 公开 | 公开（含 `publicMode` 布尔，无数据） | 不得泄露 token/数据 |
| `POST /api/login` | 可用/或禁用 | 公开 | 限速保护；`200 {ok:true}` / `401 {error:"Invalid token"}` / `429 {error:"Too many attempts"}` |
| `POST /api/logout` | 可选 | 需鉴权 | `200 {ok:true}` + 清除 session/cookie |
| `GET/PUT /api/live` | 公开 | **401 未授权** | |
| `GET /api/events`（SSE） | 公开 | **401 未授权** | 含 files:snapshot |
| `POST /api/pastes`、`GET /api/pastes/:id` | 公开 | **401 未授权** | 含 `/p/:id` 页面；受口令保护的 paste `GET` 返回 `403`（无内容） |
| `POST /api/pastes/:id/reveal` | 公开 | **401 未授权** | 口令提交；失败 5 次/分钟 → `429` + `Retry-After: 60`（§6.4，按 IP+pasteId 双键） |
| `POST/GET /api/files*` | 公开 | **401 未授权** | metadata + 下载 |
| 静态页面 `/`、`/p/:id` 及静态资源 | 公开 | 公开（index.html 200，登录 UI 前端渲染；数据仍走受保护 API） | 本项目选择；不返回数据 |

---

## 10. 部署建议

### 10.1 本地模式（LAN，零摩擦）

```bash
docker run --rm -p 5678:5678 \
  -v clipclip-data:/data \
  -e CLIPCLIP_HOST=0.0.0.0 \
  clipclip:local
```

- **不要**设置 `CLIPCLIP_ACCESS_TOKEN`。
- 仅绑定可信 LAN 接口；用防火墙限制源 IP。
- 明确：此模式**无鉴权**，任何人接入该 LAN 即可读写全部剪贴板/文件。仅限受信网络。

### 10.2 公网模式（Internet 暴露）

```bash
docker run --rm -p 5678:5678 \
  -v clipclip-data:/data \
  -e CLIPCLIP_ACCESS_TOKEN="$(openssl rand -base64 32)" \
  clipclip:local
```

- 必须设置强随机 `CLIPCLIP_ACCESS_TOKEN` 并安全保存（密钥管理/密码管理器），不要写进仓库或 compose 明文提交。
- **必须**经 HTTPS 暴露（TLS 在反代/隧道终止），并确认反代正确转发 `X-Forwarded-Proto: https`，使 cookie 带上 `Secure`（§3.3）。
- 前置一层鉴权（Cloudflare Access / 反代 Basic Auth）作为纵深防御（§10.3）。
- 完成 §7.1 的凭据轮换后再上线。

### 10.3 Cloudflare Tunnel + Access（公网推荐路径）

顺序**必须是“先建 Access 应用 → 再发布隧道路由”**，否则空窗期直接裸奔：

1. 在 Cloudflare Zero Trust → Access → Applications 创建应用，选择 `Access App`（或 self-hosted），配置登录方式（邮件 OTP / GitHub / PIN）。
2. 添加访问策略（Allow 指定邮箱/域名/IP），并创建 Service Token（若需程序化访问）。
3. 在 Access 应用的 Advanced 中获取 `teamName`、`audTag`（application audience tag）。
4. 在 `cloudflared` 的 `config.yml` 中先用 `http_status:404` 兜底 ingress，再发布 ClipClip 路由，并声明 Access 保护（示意，**以实际 Cloudflare 文档为准**）：
   ```yaml
   ingress:
     - hostname: clip.example.com
       service: http://clipclip:5678
       # 通过 Cloudflare Access 应用强制鉴权：
       # 在 Zero Trust 控制台将该 hostname 绑定到上一步的 Access 应用
       # （旧版 cloudflared 参数 access.required/teamName/audTag 已迁移至控制台配置）
     - service: http_status:404   # 兜底：未匹配流量直接 404
   ```
5. 验证：匿名访问 `https://clip.example.com` 必须被 Access 拦截；通过 Access 后再输入 ClipClip token。
6. 隧道模式下应用看到的是内网 HTTP：确保反代/隧道转发 `X-Forwarded-Proto: https` 且只有可信来源可达应用端口，使 cookie 正确带 `Secure`（§3.3）。
7. SSE 依赖客户端→边缘→隧道的持续连接：保留心跳与 `X-Accel-Buffering: no`，并在 Access/隧道侧确认不缓冲、超时足够。

> 参考（部署时核对最新版本）：Cloudflare Docs — Cloudflare Access、Cloudflare Tunnel ingress 规则。实施由运维在 README/部署文档中落实（对应 ROADMAP RM-09/RM-25）。

### 10.4 可信代理与 X-Forwarded-For（CLIPCLIP_TRUST_PROXY）

- 默认 `CLIPCLIP_TRUST_PROXY=false`：登录失败限速按 `socket.remoteAddress` 计数，不信任客户端提交的 XFF。
- 公网经 Cloudflare Tunnel/反向代理时，应用看到的是反代源地址；若所有用户共享同一地址，任一攻击者 5 次失败即可能 429 锁死全部用户（t14 M1）。此时可在**应用端口不直暴公网且前置可信反代会覆盖 X-Forwarded-For**的前提下设置 `CLIPCLIP_TRUST_PROXY=1`（或 `true`），按 XFF 最左非空且通过 IPv4/IPv6 校验的地址独立限速。
- **禁止**在应用直接暴露公网、或反代不覆盖 XFF 时开启；否则攻击者可伪造 XFF 绕过限速。README/compose 的环境变量清单应加入该项并标注默认 `false`（由运维/文档维护）。

---

## 11. 实现验收审查清单（审查阶段执行）

> 后端/前端/运维实现完成后，按本清单逐条验证；每项给出“通过/失败 + 证据（文件:行号 或 实测响应头/状态码）”。

### 11.1 模式与开关
- [ ] `CLIPCLIP_ACCESS_TOKEN` 未设置 → 本地模式：无需登录可读数据，UI 无登录入口。
- [ ] 设置后 → 公网模式：health 报告 `publicMode: true`，未回显 token。

### 11.2 公网模式“无授权零数据”（最高优先）
- [ ] 未带 cookie/Bearer 请求 §9 矩阵中每个数据端点/SSE/下载，均 `401` 且响应体无数据字段。
- [ ] SSE 未授权建立失败；授权后可收到 snapshot。
- [ ] 静态页面按本项目策略公开：`/`、`/p/:id` 及静态资源未登录返回 200（index.html/资源），登录 UI 由前端渲染；数据端点仍全部 401。

### 11.3 鉴权实现
- [ ] `POST /api/login` 用 SHA-256+`timingSafeEqual` 定长比较（长度不等不抛错、无早退）。
- [ ] 响应体精确匹配：成功 `200 {ok:true}`、token 错误 `401 {error:"Invalid token"}`、限速 `429 {error:"Too many attempts"}`。
- [ ] 成功签发随机 session（内存 Map + 过期）；`POST /api/logout` → `200 {ok:true}` 且 session 失效、cookie 过期。
- [ ] Cookie 属性逐项核对：cookie 名 `clipclip_session`、`HttpOnly`、`SameSite=Strict`、`Path=/`、`Max-Age=86400`、`Secure`（HTTPS 或 X-Forwarded-Proto:https 时）。
- [ ] Bearer 兼容且同样恒定时间比较。
- [ ] token/session 不出现在 localStorage、URL、日志。

### 11.4 响应头
- [ ] 公网默认 CSP 精确等于 §4.1 指令集，且**无** `'unsafe-inline'`。
- [ ] SSE/fetch 在严格 CSP 下正常工作（浏览器无 CSP 违规、无功能回退）。
- [ ] HSTS 仅 HTTPS 下发；COOP/COEP/CORP/Permissions-Policy/X-Accel-Buffering 存在且值正确。
- [ ] 本地模式保留 nosniff + X-Frame-Options。

### 11.5 下载头
- [ ] Content-Type 为用户可控类型时下载仍为 `application/octet-stream`（或白名单类型），不回显 `text/html`/`svg`。
- [ ] Content-Disposition 含 `attachment` + ASCII `filename` + RFC5987 `filename*`；中文名浏览器正确显示；无 CRLF/引号注入。
- [ ] 保留 `nosniff` + `no-store`。

### 11.6 限速与并发
- [ ] 登录连续失败 5 次/分钟触发 429 + `Retry-After`，成功后计数重置。
- [ ] SSE 并发达上限返回 429；心跳/空闲超时/写失败清理生效。
- [ ] 上传并发达上限返回 429/503；临时文件被清理。

### 11.7 边界与健壮性
- [ ] 篡改 `storedName`（含 `..`、`/`、绝对路径）的 state 条目被隔离，不发生路径穿越。
- [ ] state 声明但磁盘缺失的 blob 下载返回 404，进程不退出。
- [ ] 畸形 URL/坏 JSON/超大 body 均返回 4xx，进程存活。

### 11.8 敏感数据
- [ ] §7.1 凭据已轮换、剪贴板已清理、data/ 未入库入镜像。
- [ ] 日志抽样检查：无 token/正文/文件名。

> 本清单执行结果将作为独立审查记录；审查员不修改源码，仅给出符合性结论与修复建议。
