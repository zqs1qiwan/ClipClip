# ClipClip 品牌与视觉设计系统 v1.0（BRAND.md）

> 2026-11-23。方向：**纸墨编辑风（Paper & Ink Editorial）**。
> 目标：去除「模板感 / AI 味」，建立有明确主张、可识别、克制而精密的视觉语言。
> 这是**从头重做**，不是改色；本文件是前端重构与 README 门面的唯一设计依据。

---

## 1. 设计主张

ClipClip 是一本「放在桌上、随时可用的精密小工具手册」，不是 SaaS 后台，不是营销落地页。

- **纸的质感**：暖白纸底、细腻分隔线、极轻的纸张纹理（CSS 渐变，不用图片）。
- **墨的理性**：墨黑正文，衬线大标题承担情绪，等宽字体承担标签/元信息/数字。
- **朱红的克制**：只用一种强调色——朱红（vermilion），像印章与批注，点到为止。
- **编辑式排版**：明确的字号层级、宽松的行距、编号小节、页边距感；内容为王。
- **无圆角甜腻**：小圆角或直角；细边框代替阴影；拒绝彩色渐变按钮、拒绝玻璃拟态。

反模式（明令禁止）：系统默认蓝色 `#1368bf`、大阴影、彩色渐变、emoji 当图标、千篇一律的居中白色卡片、廉价 green success pill。

---

## 2. 色板（CSS 变量）

浅色（默认）：
```
--paper:      #F4F1EA   /* 纸底：暖白，不用纯白 */
--paper-2:    #FBF9F4   /* 卡片/输入面：更亮的纸 */
--paper-3:    #EAE5DA   /* 次级底纹 */
--ink:        #1C1B19   /* 主文字：墨黑 */
--ink-soft:   #55524B   /* 次级文字 */
--ink-faint:  #8A857A   /* 元信息 */
--rule:       #D8D2C4   /* 细分隔线 */
--rule-strong:#B9B1A0   /* 强分隔线 */
--vermilion:  #C0392B   /* 朱红：主强调/印章/CTA */
--vermilion-d:#96271C   /* 按下态 */
--vermilion-w:#FFF3F0   /* 朱红淡底 */
--moss:       #4B6B4F   /* 成功：苔绿 */
--ochre:      #9A6B1F   /* 警告：赭石 */
```
深色（prefers-color-scheme: dark，不是简单反转，仍是「夜读纸」）：
```
--paper:      #171715
--paper-2:    #201F1C
--paper-3:    #2A2824
--ink:        #EDE8DC
--ink-soft:   #B8B2A4
--ink-faint:  #8A857A
--rule:       #37342E
--rule-strong:#514C42
--vermilion:  #E0604E
--vermilion-d:#F07B6A
--vermilion-w:rgba(224,96,78,.14)
--moss:       #86B489
--ochre:      #D0A24E
```
对比度：正文 ≥ 7:1；朱红按钮白字 ≥ 4.5:1（如不足改用 `--paper-2` 文字）；元信息 ≥ 4.5:1。

---

## 3. 字体

- **标题**：衬线——`"Iowan Old Style", "Palatino Linotype", Palatino, "Songti SC", "Noto Serif CJK SC", Georgia, serif`。大号（32–44px）、负字距（-0.02em）、行高 1.1。
- **正文**：无衬线——`"Inter", -apple-system, "PingFang SC", "Microsoft YaHei", system-ui, sans-serif`，15–16px、行高 1.6。
- **标签/元信息/数字/按钮微标**：等宽——`"SF Mono", "JetBrains Mono", "Cascadia Code", Consolas, "Liberation Mono", monospace`，11–13px、字距 0.04em、大写化（英文）。

零外部字体请求（全部系统字体栈）。

---

## 4. Logo 与品牌资产（frontend-engineer 产出）

目录 `public/brand/`：

1. **logo.svg**：主标，方形印章式构图——朱红实心方块（圆角 2px）内，一个极简「回形夹」符号（两道折线），下方或右侧小字 `CLIPCLIP`（等宽大写、字距）。必须能在 16px favicon 与 512px 主屏图标下都清晰。
2. **logo-mark.svg**：仅图形符号（无字），用于 favicon / SW 图标 / 所有小尺寸。
3. **logo-lockup.svg**：图形 + 字标横排，用于 README 顶部与 PWA 启动图。
4. **icon.svg**（PWA 512/192 用同一 SVG，矢量自适应）：基于 logo-mark，朱红底 + 纸白符号。
5. **og-image.svg**（或 PNG）：1200×630，纸底 + 大衬线标题「ClipClip」+ 一行宣言 + logo-mark，供 GitHub/Open Graph 预览。
6. **palette 与字体说明**：写入 README「Design」小节与 `public/brand/README.md`。

设计原则：几何、克制、可缩放；避免细节在小尺寸糊掉；只使用色板内颜色。

---

## 4.5 文案边界（重要）

**品牌文案只在 README / 品牌资产里表达，产品界面不放营销性语句。**

- 界面只保留**功能性文字**：章节标题（实时剪贴板 / 分享链接 / 文件中转）、按钮（复制 / 立即同步 / 生成 / 上传）、状态（已连接 / 等待首次同步）。
- 品牌**风格**体现在配色、字体、排版、朱红点缀与 logo 上，不靠 slogan。
- 禁止在界面出现 `本地优先 · 零依赖`、`一块剪贴板，所有屏幕。`、`不登录，不装客户端。`、"纸与墨" 等宣言式文案——这些属于 README（见 §7）。
- 首屏主角必须是可输入的剪贴板文本域（用户清空 localStorage 后默认 `live` tab，文本域可见）。
- 页脚只保留品牌名 + 版本号，不放艺术字。

---

## 5. 界面结构（从头重构）

### 5.1 布局
- 页面是「一页式工具手册」：顶部品牌栏（logo-mark + 字标 + 连接状态 + 语言/扫码/退出），下面是编号小节。
- 最大宽度 1080px，纸面两侧留白明显（桌面 ≥ 48px，移动 20px）。
- 三个功能区（剪贴板 / 分享链接 / 文件）用 tab 切换，但视觉上是「手册的三章」——tab 采用编辑式标签（细下划线 + 编号 01/02/03），不是药丸按钮。
- 页脚：一行等宽小字 `CLIPCLIP · LOCAL-FIRST CLIPBOARD · v0.1.0` + 版本。

### 5.2 组件语言
- **卡片**：纸面 `--paper-2`，1px `--rule` 边框，圆角 ≤ 4px，**无阴影**；hover 时边框变 `--rule-strong`。
- **主按钮**：朱红实底 + 纸白字，直角/2px 圆角，等宽大写微标；hover 变 `--vermilion-d`；按下有 1px 位移。
- **次按钮**：透明底 + `--rule-strong` 边框 + 墨色字。
- **危险按钮**：不用红色块——用文字按钮 + 朱红下划线，仅在 hover 显色（避免满屏红）。
- **输入框/文本域**：纸白底、1px 边框、无内阴影；focus 时朱红边框 + 2px 朱红淡晕；等宽光标。
- **状态徽标**：小圆点 + 等宽文字，连接=苔绿、断开=朱红；不用彩色药丸背景。
- **连接/成功提示**：段落式，左侧 2px 朱红/苔绿竖线（编辑式 callout），不用浮夸 toast。
- **分隔线**：1px `--rule`，章节间用带编号的标题 + 细线。

### 5.3 微交互
- 过渡 120–180ms ease，仅 opacity/transform/border-color；尊重 `prefers-reduced-motion`。
- 复制成功：按钮文字变「已复制 ✓」（用文字符号，不用 emoji），1.5s 后恢复。
- 焦点环：朱红 2px + 2px offset，全键盘可达。

### 5.4 响应式
- 375px / 320px 无横向滚动；触控目标 ≥ 44px；移动端 tab 保持三列，编号隐藏或缩小。
- 文本域在移动端占据主视觉（≥ 40vh），保持「剪贴板是主角」。

---

## 6. 必须保留的 DOM 契约（功能不回退）

现有 `public/js/*.js` 依赖这些 id / 属性，重构时**必须原样保留**（可加类、加结构，不可改名/删除）：

- IDs: `app-shell, connection-badge, qr-button, logout-button, app-alert, tab-live, tab-paste, tab-files, panel-live, panel-paste, panel-files, remote-notice, remote-apply, remote-dismiss, live-textarea, live-status, live-copy, live-sync, live-clear, live-alert, paste-fill, paste-create, paste-textarea, paste-expiry, paste-burn, paste-passphrase, paste-result, paste-alert, file-input, file-input-label, file-browse, file-upload, file-selection-meta, upload-progress, upload-bar, upload-status, upload-alert, file-current, file-count, file-history-empty, file-history, login-view, login-form, login-token, login-submit, login-error, paste-view, paste-content, paste-meta, paste-copy, paste-burn-badge, paste-error, paste-error-message, paste-error-retry, paste-error-back, paste-lock, paste-lock-form, paste-lock-passphrase, paste-lock-submit, paste-lock-error, qr-modal, qr-code, qr-url, qr-close, qr-copy, a11y-status, tpl-result-card, tpl-history-item`
- attributes: `data-i18n`, `data-i18n-placeholder`, `data-i18n-aria-label`, `data-tab`, `data-panel`, `data-lang`, `data-alert`, `data-role="copy"`, `role`/`aria-*`
- 所有 i18n key 保留（可新增 `brand.*` / `footer.*`）。

JS 仅通过 id/data 属性工作，因此**允许彻底重写 HTML 结构与全部 CSS**；但按钮文案由 i18n 注入，HTML 内的中文只是 fallback。

---

## 7. README 门面（docs-maintainer）

- 顶部：logo lockup（引用 `public/brand/logo-lockup.svg`）+ 一句宣言（衬线大字）。
- 徽章行：不用一堆彩色 badges；用一行等宽小字：`LOCAL-FIRST · ZERO-DEPENDENCY · DOCKER-READY · MIT`。
- 截图区：引用真实浏览器截图（队长提供）。
- 章节顺序：What → Why → Quick start → Two modes → Features → Design → Docs → License。
- 语气：克制、精准、工具手册式；去掉营销形容词。
- 补 LICENSE（MIT，若缺失）。

---

## 8. 验收

- [ ] 品牌资产齐全（logo/mark/lockup/icon/og-image），风格统一。
- [ ] 界面完全重构，符合纸墨语言；无任何旧蓝色/药丸/大阴影残留。
- [ ] 对比度：正文≥7:1、强调按钮≥4.5:1、元信息≥4.5:1。
- [ ] 375/320px 无横滚，触控≥44px；键盘可达、焦点环可见。
- [ ] 所有 DOM id/data/i18n key 保留 → 功能测试全绿。
- [ ] 真实浏览器截图（浅色/深色/移动）确认视觉；README 门面更新。
