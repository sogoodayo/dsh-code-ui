# dsh-code-ui × highlight.js 集成方案(替换自研 tokenizer)

> 状态:方案定稿,待实施
> 分支:`feature/highlight-js`
> 方向澄清(会话记录):不上 Monaco 整编辑器;本分支目标是**把手写 tokenizer 换成成熟的
> highlight.js**,修复随使用暴露的高亮 bug。Monaco(整编辑器升级)作为未来可选路径,
> 相关平台调研已在会话中留档,需要时可重启。
> 关键现状:**groundwork 已完成**——`tools/vendor-hljs.mjs` 重建管线与两份产物已就位,
> 仅剩 client.js 接线。

---

## 1. 背景与目标

插件已发布并在用,整体体验尚可;短板集中在**语法高亮层**:从零手写的 tokenizer
(覆盖有限、边界 bug 随使用不断暴露)。本方案将该层替换为
[highlight.js](https://highlight.js/)(成熟、193 语言、社区维护),**其余一切不动**:
叠层编辑架构(透明 textarea + 高亮 `<pre>`)、文件树/标签/状态栏、RPC 数据面、
引用/翻译链路、保存与外部同步、双布局、主题四态。

## 2. 现状盘点(代码事实)

### 2.1 编辑表面(叠层架构)

```
Editor()  client.js:1308
└─ cdex-codearea
   ├─ cdex-gutter        行号(纯文本 div,滚动跟随)
   └─ cdex-code-layer
      ├─ pre.cdex-code-pre     dangerouslySetInnerHTML = highlight(content, langOf(p))
      └─ textarea.cdex-code-ta 透明输入层(onChange → store → 整组件重渲染)
```

- 渲染链:每次按键 → `onChange` 更新 buffer/dirty → 重渲染 → **同步全量重跑
  `highlight()`**(client.js:1326)。
- 滚动同步:textarea → pre + gutter(:1328 `syncOverlayScroll`)。

### 2.2 自研 tokenizer(client.js:456 起)

逐字符扫描:行/块注释、字符串、数字、HTML 标签、关键字(按语言簇硬编码正则)、
标识符。输出 `<span class="cdx-tk-*">`。token 色:client.js:104-107,
`var(--cdex-tk-*)` + VS Code Dark+ 回退色。**这就是 bug 集中面,本方案替换对象。**

### 2.3 语言映射(client.js:428 `langOf`)

扩展名 → 语言名(jsx/tsx/py/…共 27 项)。引用链路(:787/:834)也用它,保持不动。

### 2.4 vendor 现状(已做,未接线)

`tools/vendor-hljs.mjs`(默认 11.12.0):
- `lib/vendor/highlight.full.min.js`——cdnjs core(common)+ 193 语言顺序拼接,
  **1.2MB**,带版本 banner,可重复重建;
- `lib/vendor/hljs-themes.css`——10 个精选官方主题,选择器加 `.cdex-syn-<id>`
  作用域前缀,**剥掉 `.hljs` 背景**(编辑器底色仍由主题四态管)。
- 两文件均未跟踪(`git status` 为 `??`)、client.js 无任何引用。

## 3. 平台事实(仅保留相关)

| 事实 | 来源 | 影响 |
|---|---|---|
| 客户端 bundle 只经 `/plugins` 组合脚本路由下发 client.js 本体,无静态资源机制;`webServer.register` 命名路由为官方认可用法 | `subsystems/client-modules.md`、`web-server.md` | vendor 两文件须经宿主面 HTTP 路由下发 |
| Electron 走 `file://` + IPC,不经 HTTP 服务器 | `subsystems/web-server.md` | 桌面端加载不到 hljs → 回退现有 tokenizer(天然降级) |

## 4. 设计决策

### D1:hljs 经宿主面 `exact` 路由伺服,不进 client.js

- 路由两个(无路径参数,天然无穿越面):
  `/dsh-code-ui/vendor/highlight.full.min.js`、`/dsh-code-ui/vendor/hljs-themes.css`;
- 文件定位:`new URL('./vendor/…', import.meta.url)`(lib/index.js 与 lib/vendor/
  同目录);仅 GET/HEAD;正确 MIME;`cache-control: immutable` + 以插件版本号作
  query 防陈旧。
- **被否**:拼进 client.js(1.2MB 全量预加载拖慢 SPA 启动;且在 ModuleLoader
  factory 内 eval 会让 UMD 走 CJS 分支挂到 module.exports 而非 window.hljs)。

### D2:懒加载 + 渐进增强,自研 tokenizer 降级保留

- 首次打开文件时并行注入 `<script>` + `<link>`(经典 script 标签,勿在 factory 内
  eval,理由同 D1);单例 Promise 防重复;
- 加载完成前:现有 tokenizer 照常渲染(零阻塞);完成后 bump store 重渲染切换到
  hljs 输出;
- 加载失败/超时(Electron、断网):**永久回退现有 tokenizer**,toast 提示一次;
- 自研 tokenizer 代码保留一个版本周期,稳定后再移除。

### D3:语法主题体系 —— 底色与语法色分治

- 编辑器底色:主题四态(跟随 DSH/系统/浅/深)继续管(vendor 已剥主题背景);
- 语法配色:默认**自动跟随明暗**(浅→github,深→github-dark),插件卡片可手动
  选 10 主题(vendor 清单:github / github-dark / atom-one-dark / atom-one-light /
  monokai / dracula / nord / vs / vs2015 / tokyo-night-dark,展示名表进 client.js);
- 切换 = 换 `pre` 上的 `.cdex-syn-<id>` 作用域 class,即时生效;
- 持久化:扩展现有 settings RPC(`get-self` 增字段 + 新端点 `set-syn-theme`,
  值 `auto` 或主题 id)。

### D4:语言映射 — 小归一表 + 别名解析 + 兜底

`langOf` 输出大多与 hljs 语言 id/别名一致,仅需归一少数:
`text→plaintext`、`jsx→javascript`、`tsx→typescript`(hljs 无独立 jsx/tsx 语法);
其余经 `hljs.getLanguage(name)` 解析别名(html→xml、shell→bash 等以实机核验为准),
解析失败回退 `plaintext`。`ignoreIllegals: true` 避免非常规代码抛错。

### D5:性能 — 防抖重高亮 + 大文件阈值

- 现状每次按键同步全量高亮;hljs 比手写 tokenizer 重,大文件需防抖:
  输入即时进 textarea(所见即所得),重高亮 debounce ~60ms(视觉上仅短暂无色);
- 超大文件(如 >512KB)直接 plaintext,不做全量高亮。

## 5. 实施计划

### 阶段 0 — 入库与默认对(0.5 小时)

- `git add lib/vendor tools`(vendor 产物与脚本纳入版本管理);
- 确认默认明暗主题对(light→github / dark→github-dark)。
- **验收**:仓库状态干净;`node tools/vendor-hljs.mjs` 可重复重建且产物一致。

### 阶段 1 — 宿主面静态路由(0.5 天)

- `lib/index.js` 新增 `registerVendorRoutes(ctx)`:两个 `exact` 路由;
  `fileURLToPath(new URL('./vendor/…', import.meta.url))` 读文件;MIME
  (text/javascript、text/css);`cache-control: public, max-age=31536000, immutable`;
  仅 GET/HEAD(其余 405);disposer 并入现有清理链。
- **验收**:浏览器直取两文件 200 且类型正确;非 GET 405;插件禁用→启用无残留。

### 阶段 2 — 客户端接线(1 天)

- `loadHljs()` 单例:注入 script + link,resolve `window.hljs`;超时(10s)与
  onerror → 标记失败并回退(D2);
- `highlight(code, lang)` 双轨改造:hljs 就绪 → `hljs.highlight(code, { language:
  normalize(lang), ignoreIllegals: true }).value`,`pre` 加 `cdex-syn-<id>` class;
  未就绪/失败 → 走原 tokenizer 分支;
- 尾部换行处理与现 pre 行为对齐(叠层末行可见性);加载完成 bump store 触发
  一次重渲染。
- **验收**:打开文件先见手写高亮、随即无缝切 hljs;Network 仅首次加载 vendor 两
  文件;断网/Electron 场景回退可用;危险字符文件(含 `<script>` 文本)无注入
  (hljs 默认转义)。

### 阶段 3 — 语法主题选择(0.5–1 天)

- 插件卡片新增「语法配色」下拉:自动(默认)+ 10 主题展示名表;
- host:settings 命名空间增 `synTheme` 字段 + `set-syn-theme` 端点;`get-self`
  返回当前值;client:切换即换 `pre` class,持久化;
- 自动模式:监听现有主题四态变化,明↔暗切换对应主题对。
- **验收**:卡片切换即时生效并持久化;四态明暗切换时自动对跟随;主题背景不
  覆盖编辑器底色。

### 阶段 4 — 性能与收尾(0.5 天)

- 重高亮 debounce(~60ms)与大文件阈值(>512KB→plaintext);
- 更新 `README.md`(功能、实现说明、更新日志加一行)与 `项目规划.md`
  (P0-1 标记为「hljs 路线已实施」并记录决策);
- `npm pack` → 本地 tgz 经自更新卡片安装 → 实机全流程验证。
- **验收**:大文件编辑不卡顿;tgz 安装开箱即用;文档与实际一致。

## 6. 安全清单

- [ ] 路由为 `exact` 无路径参数,无穿越面;仅 GET/HEAD;无目录列举
- [ ] 公共静态资产姿态与宿主 SPA 非索引资产一致(不含用户数据)
- [ ] 不新增任何写文件能力;RPC 面零新增语义(仅 `set-syn-theme` 一个设置项)
- [ ] hljs 输出默认 HTML 转义,`dangerouslySetInnerHTML` 输入安全
- [ ] `shell` 等别名与非常规代码(`ignoreIllegals`)实机核验

## 7. 边界与待验证

| 项 | 说明 | 处置 |
|---|---|---|
| Electron/桌面 | `file://` 不走 HTTP 服务器,vendor 路由不可达 | D2 天然回退 tokenizer;后续如需桌面 hljs 再议 |
| 包体积 | 全量 193 语言 1.2MB | 首期保持全量(功能全、本地加载快);如需瘦身可切 common 构建(~40 语言,约 1/4 体积),vendor 脚本改一处即可 |
| 每按键全量高亮 | 架构如此,hljs 更重 | D5 防抖 + 阈值;增量高亮属 Monaco 级改造,不做 |
| 自研 tokenizer 去留 | 立即删会失去降级面 | D2 保留一个版本周期,稳定后移除 |

## 8. 测试计划

- `node --test` 纯函数:语言归一表、主题 id/展示名表、自动模式明暗→主题对映射;
- 实机手测:加载/回退/切换主题/明暗自动/大文件性能/双布局/tgz 安装回归;
- 抽样文件回归:当前 tokenizer 出过 bug 的语言(CSS `#`、HTML 属性、模板字符串)
  逐一比对。

## 9. 与 Monaco 路线的关系

Monaco(整编辑器替换)的调研结论——宿主静态资产路由模式、懒加载、降级策略、
Electron 边界——与本方案 D1/D2 同源。若未来仍要升级到完整 VSCode 风格编辑器,
按会话中留档的方案重启即可;本方案不与其冲突(叠层架构与 RPC 面均保留)。
