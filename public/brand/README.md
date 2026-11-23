# ClipClip 品牌资产

方向：**纸墨编辑风（Paper & Ink Editorial）**。设计依据见仓库 `docs/BRAND.md`。
本目录只放矢量资产，全部使用品牌色板，无外部字体或图片请求。

## 文件

| 文件 | 用途 |
| --- | --- |
| `logo.svg` | 主标：朱红印章方块 + 回形夹 + `CLIPCLIP` 等宽字标 |
| `logo-mark.svg` | 纯图形标记：favicon、界面品牌栏、小尺寸场景 |
| `logo-lockup.svg` | 横排组合（图形 + 衬线字标 + 等宽标语），README 门面用 |
| `icon.svg` | PWA / 主屏图标（512 与 192 共用同一矢量，含遮罩安全区） |
| `og-image.svg` | 1200×630 Open Graph / GitHub 预览图 |

运行时引用路径：`/brand/logo-mark.svg`、`/brand/icon.svg`；清单文件 `public/manifest.json` 引用 `/brand/icon.svg`。

## 色板

| Token | Light | Dark | 用途 |
| --- | --- | --- | --- |
| `--paper` | `#F4F1EA` | `#171715` | 页面纸底 |
| `--paper-2` | `#FBF9F4` | `#201F1C` | 卡片 / 输入面 |
| `--paper-3` | `#EAE5DA` | `#2A2824` | 次级底纹 |
| `--ink` | `#1C1B19` | `#EDE8DC` | 正文墨色 |
| `--ink-soft` | `#55524B` | `#B8B2A4` | 次级文字 |
| `--ink-faint` | `#8A857A` | `#8A857A` | 装饰性淡墨（不用于正文） |
| `--rule` | `#D8D2C4` | `#37342E` | 细分隔线 |
| `--rule-strong` | `#B9B1A0` | `#514C42` | 强分隔线 / 输入边框 |
| `--vermilion` | `#C0392B` | `#E0604E` | 朱红：印章、主按钮、强调 |
| `--vermilion-d` | `#96271C` | `#F07B6A` | 朱红按下态 |
| `--vermilion-w` | `#FFF3F0` | `rgba(224,96,78,.14)` | 朱红淡底 |
| `--moss` | `#4B6B4F` | `#86B489` | 成功 / 已连接 |
| `--ochre` | `#9A6B1F` | `#D0A24E` | 警告 |

### 派生的可读性 Token

品牌色板中 `--ink-faint`、`--ochre`、`--vermilion` 在浅色纸面上不足以承载小字号正文（低于 4.5:1）。界面因此派生以下文本专用 token（不改动品牌主色板）：

| Token | Light | Dark | 最低对比度 |
| --- | --- | --- | --- |
| `--ink-meta` | `#6B6659` | `#9C9689` | 4.56:1（paper-3）/ 5.00:1（paper-3） |
| `--ochre-ink` | `#835A19` | `#D0A24E` | 4.86:1（paper-3）/ 6.28:1 |
| `--on-vermilion` | `#FBF9F4` | `#171715` | 5.17:1 / 5.09:1 |
| `--badge-ink` | `#C0392B` | `#F07B6A` | 5.01:1（vermilion-w）/ 5.12:1 |

元信息文字使用 `--ink-meta`，不使用 `--ink-faint`；`--ink-faint` 仅用于装饰（规则线端点、禁用态、图形）。

## 字体

全部为系统字体栈，零外部请求：

- 标题（衬线）：`"Iowan Old Style", "Palatino Linotype", Palatino, "Songti SC", "Noto Serif CJK SC", Georgia, serif`
- 正文（无衬线）：`"Inter", -apple-system, "PingFang SC", "Microsoft YaHei", system-ui, sans-serif`
- 标签 / 元信息 / 数字（等宽）：`"SF Mono", "JetBrains Mono", "Cascadia Code", Consolas, "Liberation Mono", monospace`

## Logo 用法

- 优先使用 `logo-mark.svg` 或 `logo-lockup.svg`；不要重绘、拉伸、改色或加阴影。
- 最小留白：图形高度的 1/2。
- 朱红方块内的回形夹必须保持纸白（`#FBF9F4`），不得反色。
- 小尺寸（16–24px）只使用 `logo-mark.svg`，不要使用带字标的版本。
- 深色界面使用同一标记（朱红方块本身提供足够对比），不要改成墨底白夹。

## OG 图

`og-image.svg` 为 1200×630，纸底 + 大号衬线标题 + 一句宣言 + 图形标记。社交平台若要求位图，可由负责人用浏览器截图为 PNG 后替换引用。

## 已知限制

- 图标为 SVG；部分旧平台（如部分 iOS 主屏场景）对 SVG apple-touch-icon 支持有限，会在后续补充 192/512 PNG 导出。
- `logo*.svg` 中的字标使用系统字体渲染；不同系统字距会有细微差异，这是零外部字体约束下的预期行为。