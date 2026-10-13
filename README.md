# dsh-code-ui

在 DeepSeek Harness（DSH）里的 **Cursor 风格 AI 代码编辑器**插件：文件树、多标签页编辑、语法高亮、引用/翻译给 AI。

它把 Cursor 那种「边看代码、边跟 AI 对话」的体验搬进 DSH：一个带活动栏、文件树、多标签页编辑器的代码工作区。**v1.2.0 起支持两种布局**：右侧停靠（code UI 固定占屏幕右侧、与聊天并排，默认布局）或悬浮窗口（可拖拽浮动窗口，内嵌 AI 输入框），插件卡片里可随时切换。

## 界面一览

**右侧停靠布局（默认布局）**——对话与 code UI 左右并排，边聊边看代码：

![右侧停靠布局：对话与 code UI 左右并排](https://github.com/soGoodayo/dsh-code-ui/raw/main/image/%E4%B8%8A%E4%B8%8B%E6%96%87%E4%B8%8EcodeUI%20%E5%B7%A6%E5%8F%B3%E5%B8%83%E5%B1%80.png)

**悬浮窗口布局**——可拖拽、可缩放的浮动编辑器窗口，内嵌 AI 输入框：

![悬浮窗口布局](https://github.com/soGoodayo/dsh-code-ui/raw/main/image/%E6%82%AC%E6%B5%AE%E5%B8%83%E5%B1%80.png)

**两种切换按钮（插件卡片「切换按钮」可选）**——点击在 code UI 与 dsh UI（DSH 原生界面）之间切换，与布局任意组合：

| 会话头按钮 | 悬浮模式条（默认，可拖动） |
| :---: | :---: |
| ![会话头 ⌨ code UI 按钮](https://github.com/soGoodayo/dsh-code-ui/raw/main/image/%E4%BC%9A%E8%AF%9D%E5%A4%B4%E6%8C%89%E9%92%AE.png) | ![悬浮模式条](https://github.com/soGoodayo/dsh-code-ui/raw/main/image/%E6%82%AC%E6%B5%AE%E6%8C%89%E9%92%AE.png) |

> 📍 **所有配置都在：设置 → 插件 → 插件列表 → dsh-code-ui 的配置卡片**——编辑器界面（右侧停靠 / 悬浮窗口 / 隐藏）、编辑器主题、语法配色、切换按钮、启用开关、检查更新，切换即时生效并持久化保存。

## 功能

- **双布局可选**：右侧停靠（默认布局，与聊天并排） / 悬浮窗口（可拖拽缩放），插件卡片切换、即时生效
- **切换按钮可选**：悬浮模式条（默认，可拖动） / 会话头 `⌨ code UI` 按钮，与布局任意组合
- **界面模式可持久化**：code UI / dsh UI（**默认隐藏**，不自动占屏，入口按钮随时唤回），所有入口切换均同步记忆
- **Cursor 风格工作区**：活动栏 + 文件树侧边栏 + 多标签页编辑器 + 状态栏
- **侧栏收起与调宽**：« 按钮 / 📁 三态 / 拖到最窄自动收起，» 把手展开，右缘拖拽调宽
- **停靠面板拖宽**：左缘手柄实时调整面板宽度，DSH 界面自动跟随
- **语法高亮**：highlight.js 11（193 种语言）替换自研 tokenizer——宿主路由懒加载不拖累启动，10 款语法配色可选（自动随明暗 / GitHub / Dracula / Monokai…），加载失败或桌面端自动回退内置轻量高亮
- **文件浏览与编辑**：展开目录、打开文件、直接编辑、`Ctrl+S` 保存写回磁盘；外部修改自动同步
- **选中代码右键**：
  - 📋 复制
  - 📥 粘贴到备注
  - 📝 添加备注
  - 🌐 翻译（🌐 chip 直插输入框，交给 AI 翻译）
  - 🔗 引用给 AI
- **行内引用 chip**：引用/翻译后 chip 直接嵌入输入框句中（`1:文件名:起行-止行`，翻译带 🌐 前缀），点击跳转编辑器；`@` 菜单可把引用插入句中任意位置；发送时 chip 原位展开为引用行，随消息一次性消耗（chip 清空、【引用/备注】留档可查）；允许重复引用（chip 可见、可删）
- **内嵌 AI 输入框**（悬浮布局）：直接输入、`Ctrl+Enter` 发送；发送时不粘贴引用正文，只附一行引用指针，内容由 AI 调用 `get_referenced_snippets` 工具读取
- **主题四态**：跟随 DSH（默认）/ 跟随系统 / 浅色 / 深色，插件卡片切换
- **以此文件夹为根**：文件浏览器里可选任意目录作为工作区根
- **根目录按会话隔离**：切换对话自动换根，各会话的手动根互不污染；新建对话（未发消息）也能立即定位其工作区
- **标签页右键菜单**：关闭 / 关闭其他 / 关闭右侧标签页 / 关闭已保存 / 关闭全部 / 复制路径；关闭未保存文件前确认（保存并关闭 / 不保存 / 取消，保存失败者保留打开）
- **检查更新 / 一键更新**：设置 → 插件 → 插件列表 → dsh-code-ui 的配置卡片，支持在线检查 npm 新版本并一键更新；未发布/开发期可填本地 `.tgz` 路径安装（pnpm 流式进度展示，失败自动归类给出建议，完成后提示重启 DSH 生效）

## 安装

通过 `dsh plugin` 一键安装（已声明 `dsh.bundle`）：

```bash
dsh plugin --profile web add dsh-code-ui
```

安装完成后重启 DSH，编辑器**默认隐藏**（dsh UI，不自动占屏）；页面顶部出现可拖动的**悬浮模式条**（默认切换按钮），点 `code UI` 即可打开编辑器——默认布局为右侧停靠、默认根目录为**当前会话的工作区**，想换会话头 ⌨ 按钮或悬浮窗口，到 **设置 → 插件 → 插件列表 → dsh-code-ui** 的配置卡片里切换。

或手动安装：

```bash
cd $DSH_HOME/profiles          # Windows: %USERPROFILE%\.dsh\profiles
npm install dsh-code-ui
```

然后在 `cordis.patch.yml` 追加：

```yaml
- insert:
    - id: dsh-code-ui
      name: 'dsh-code-ui'
```

## 使用

1. 点顶部悬浮模式条的 `code UI` 打开编辑器（默认切换按钮；也可在插件卡片换成会话头 `⌨` 按钮），默认布局为右侧停靠
2. 在文件树/浏览器里打开文件
3. 选中代码右键 → 引用 / 翻译 / 备注 / 复制
4. 悬浮布局底部输入框直接发消息（`Ctrl+Enter` 发送）；停靠布局用 DSH 原生输入条，引用以行内 chip 嵌在输入框句中，正文由 AI 工具读取
5. 也可对 AI 说「读取我引用的代码」，AI 会调用 `get_referenced_snippets` 工具

## 目录结构

```
dsh-code-ui/
├── package.json      # 包声明（含 dsh.bundle.patch / dsh.client）
├── lib/
│   ├── index.js      # Host 端：connection.rpc 文件/引用/备注 RPC + get_referenced_snippets 工具
│   │                 #        + webServer exact 路由（下发 lib/vendor 静态资产）
│   ├── client.js     # Client 端：__ModuleLoader__ + 编辑器 UI（highlight.js 懒加载接线）
│   └── vendor/       # highlight.js 全量包 + 作用域化主题 CSS（脚本生成，勿手改）
├── tools/            # vendor 重建脚本：node tools/vendor-hljs.mjs [版本] [--themes-only]
└── cordis.patch.yml  # bundle 插接层
```

纯 JavaScript 手写实现，无需构建，可直接 `npm publish`。

## 实现说明

- **语法高亮**：`lib/vendor/` 下为 highlight.js 全量包（core + 193 语言）与作用域化主题 CSS，由 `tools/vendor-hljs.mjs` 从 CDN 生成；宿主经 `webServer` 注册两个 exact 路由下发，客户端首次需要高亮时以 `<script>`/`<link>` 懒加载（绝不内联进 client.js），失败或 Electron（`file://`）自动回退内置轻量 tokenizer；重高亮带 ~60ms 防抖与 512KB 大文件降级。
- **Host↔Client RPC**：Host 通过 `connection.rpc.handle("/dsh-code-ui", handler)` 注册文件系统/引用/备注端点；Client 通过 `connection.rpc.call("/dsh-code-ui", endpoint, payload)` 调用。RPC 返回值遵循 DSH 的 `RpcResult` 协议（`{ ok: true, value }` / `{ ok: false, error }`）。
- **模型工具**：注册 `get_referenced_snippets`，让 AI 读取用户标记的代码片段。
- **Client UI**：`window.__ModuleLoader__.load({ id, factory })` 注册，React 通过 `require("react")` 获取，slot 通过 `ctx.get("slots")` 注册（`shell.overlay`），样式用 `--dsw-alias-*` 主题变量。

## 二次开发

- `lib/index.js`：改文件读写、引用/备注存储、或新增 RPC 端点（在 `connection.rpc.handle` 的 handler 里加 `if (endpoint === ...)`）
- `lib/client.js`：改编辑器 UI 布局、配色（`styles` 模板串里的 CSS）、或新增右键菜单项
- 引用/备注数据存模块内存（运行期有效，重启清空）

## 更新日志

> 约定：每次版本升级在本节顶部追加一行（时间 | 版本 | 修复/新增内容）。

| 时间 | 版本 | 修复 / 新增 |
| --- | --- | --- |
| 2026-10-13 | v1.6.6 | 修复：**选中 zip 等二进制文件页面卡死**——双重根因：① 编辑器对任何文件都按文本渲染，zip 经截断读取的 4MB 乱码进 tokenizer/highlight 层（数万 span）瞬间撑爆页面；现对已知二进制扩展名（zip/gz/tar/7z/jar/exe/dll/png/jpg/pdf/woff/ttf/mp3/mp4 等 40+ 种）直接跳过文本预览，打开只显示占位提示与只读备注。② v1.6.5 引入的已发消息着色观察器在大 DOM 上每次变动都全量遍历（文本节点级祖先匹配，无法剪枝），编辑器载入大文件后与聊天区流式输出叠加把主线程拖死；现改元素级剪枝（TreeWalker 对 textarea/pre/code/.cdex-workbench/.cdex-dock 等命中即整棵子树跳过）+ 单轮扫描超 80ms 自动进入 1.5s 冷却让出主线程 |
| 2026-10-13 | v1.6.5 | 优化：**已发消息的引用标签着色**——chip 序列化进正文的 `N:文件名:起-止` / `🌐N:文件名` 标签在发出后以蓝色高亮展示（`--dsw-alias-state-business-primary`，与宿主输入框 chip 同色加粗），用户回看消息时能一眼看到引用了什么。实现：MutationObserver + TreeWalker 纯文本节点 overlay（只 split/wrap，不碰 React 管理结构；React 原位改文本时自愈 unwrap 重扫）；整文件引用强制要求扩展名（不误伤 `12:30` 时间文本），匹配点黏在更长单词内（`a2:app.ts:1-2`）跳过；跳过输入框/代码块/链接/宿主 chip 及本插件自有 UI 区域 |
| 2026-10-13 | v1.6.4 | 优化：发送后消息**保留引用标签文本**——chip 序列化从「空串隐身」改为输出编号标签（`2:package.json:2-3` / `🌐4:package.json:26-32`），编号取发送时刻冻结的 seq；消息里看得见引用了什么，AI 侧仍经宿主 systemPrompt 动态 section（`code-ui-references`）获知全部引用并调 `get_referenced_snippets` 读取 |
| 2026-10-13 | v1.6.3 | 优化：**引用指针不再出现在消息正文**——消息末尾的 `[code UI] 已标记 N 段代码引用…` 附加块整体移除（用户反馈：希望不展示出来但还让 AI 知道）；引用信息改由宿主 `systemPrompt` 动态 section（order 2950，按 session 头取 `lastRefBatches` 批次渲染）注入模型上下文，AI 对用户的观感不可见；客户端 chip serialize 返回空串、consumePendingRefs 每次发送带 `{ids, sessionId}` 调 `use-references`（空=清批次） |
| 2026-10-13 | v1.6.2 | 修复：**引用 chip 插入静默失败**（0.2.0 适配）——0.2.0 起 `inputTriggers.live.controllers` 改按 SessionBinding 对象键控，字符串 sid 取不到 controller；chip 插入改走 `shell.insertReference` 公共契约（实时取 `conversation.input.shell(sid).snapshot` 的 draft/draftRev 计算插入位置），0.1.5-rc.x 与 0.2.0-rc.x 双兼容 |
| 2026-10-13 | v1.6.1 | 修复：**0.2.0-rc.2 上 `Cannot read properties of undefined (reading 'resolve')` 崩溃**——插件 apply 早于 fs-sandbox 挂载时永久取到 undefined；fs 服务延迟获取（首次调用时才解析）+ 原生 `fs/promises` 兜底 |
| 2026-10-10 | v1.6.0 | 里程碑：**契约迁移到 DSH 官方 Typert Remote**——自定义 RPC 通道从 `connection.rpc.handle("/dsh-code-ui")`（0.1.5 起有 Cordis guard 405 bug，靠自挂 webServer 路由兜底）整体迁到 `/api` 通道：Host 侧 `CodeUiService` 经 `bindTypertRemote` + `@Remote` 标记注册并 `ctx.root.reflect.provide` 到宿主 root Context，api-gateway SRC 扫描自动发现（`internal/service` 事件失效缓存，插件后加载有效）；浏览器侧 `rpc.call('/api', 'dsh-code-ui/<端点>', { args: { args: payload } })`，33 个端点名/参数/返回值全部不变；handle 调用、自挂路由、Host/Origin 认证门整套删除。同一套代码兼容宿主 0.1.5-rc.x 与 0.2.0-rc.x。配套：peer 增加 `@deepseek-ai/dsh >=0.1.5-rc.1 <0.3.0`（宿主安装门强制校验）、`dsh-typert-protocol`/`dsh-tools` 补声明，`dsh-settings` 范围扩到 `<0.3.0`（旧 `^0.1.x` 范围在 0.2.0 宿主会被拒载）；`engines.dsh` 同步声明；`client.inject` 移除新版已不存在的 `dsh-client-runtime`；新增 `icon.svg` + `exports["./icon"]`（插件管理器不再回退默认图）；卸载卡 NO_ENDPOINT 识别覆盖 gateway 新错误文案；新增 `tools/typert-smoke.mjs` 冒烟（真实 cordis 4.0.2 + typert-protocol 0.1.5-rc.2 上验证注册全链路 11/11） |
| 2026-09-18 | v1.5.3 | 新增：**插件自卸载**——配置卡新增「卸载插件」危险区（两击确认防误触，5 秒不点第二下自动回弹）。主路径调官方 CLI（`dsh plugin --profile <p> remove dsh-code-ui`，自动识别三种启动形态：源码入口带 execArgv 再唤起 / POSIX 直装 / Windows .cmd shim 经 cmd.exe 引号包装）；CLI 不可用自动退路 pnpm remove（hoist 漂移先 pnpm install 重建再重试）；全程实时滚动 pnpm 日志；收尾按**磁盘真相**核对依赖行 / bundles 清单行 / node_modules（#65 幽灵清单保护：文件已删而清单未清时原子补删清单行，tmp+rename，防 profile 起不来）。成功绿字明确告知**需重启 DSH 彻底生效**（重启前插件仍运行，浏览器建议 Ctrl+F5）；幂等（已卸载再点显示已是未安装状态）；失败红字留档：错误码（PROFILE_NOT_FOUND / PLUGIN_CMD_FAILED / PNPM_FAILED / TIMEOUT / MANIFEST_LOCKED / FILES_STILL_PRESENT）+ 原因 + 逐条手动处理指导。旧宿主无此端点时给出「先升级插件再卸载」的 NO_ENDPOINT 兜底提示 |
| 2026-09-11 | v1.5.2 | 修复：停靠面板拖拽分界线不再折行——编辑区去掉 min-width 下限，面板标题/按钮/状态栏等文本全部 nowrap + 省略号截断，拖到多窄只截断、不把文字竖排成一列；停靠面板左缘拖到宽度 < 80px 时自动切回 dsh UI（还原拖前宽度，下次展开不残留细条） |
| 2026-09-11 | v1.5.0 | 里程碑：**引用体系全面升级——行内引用 chip**。引用/翻译后标签不再挂在输入框上方，而是以 chip 直接嵌入输入框句中（`1:文件名:起行-止行`，翻译带 🌐 前缀），点击跳转编辑器、退格即删；`@` 菜单可把引用插入句中任意位置；发送时 chip 原位展开为 `- 代码引用 / - 翻译引用 文件名:行号（路径）` 引用行，正文由 AI 经 `get_referenced_snippets` 读取。实现：注册宿主 InputTrigger 触发源（candidates/onPick/codec）+ ReferenceChipNode 装饰器直插（shell.insertReference，实时取 `conversation.input.shell(sid).snapshot` 的 draft/draftRev）；chip ref 自包含 JSON（抗刷新/重启）。配套：**引用一次性消耗**——发送即标记已使用、chip 清空、【引用/备注】留档可查；**允许重复引用**（chip 可见可删，取消 host 去重）；**引用编号全链路贯通**——标签/消息指针/引用卡/AI 工具输出同号，对 AI 说「引用N」即指对应条目；【引用/备注】条目右键菜单（复制 / 翻译 / 引用给AI）；消息区引用卡 + chip 文件图标/点击跳转；提示条 ✕ 手动关闭兜底；移除「引用消耗模式」配置项（固定一次性）与输入条上方 tag 条（被行内 chip 取代）。工程：发送补丁改挂 shell.submit 必经点（原生输入条回车/按钮走 keyboard.submit，原 inputActions 补丁只覆盖插件输入卡）；纯 chip 携带的发送同样消耗 |
| 2026-09-09 | v1.4.1 | 修复：编辑器**每敲一个字符文本抖动一下**。根因：hljs 就绪后，每次击键高亮层经历「tokenizer 顶上 → 60ms 防抖后换 hljs」**两次全量 innerHTML 重写**，浏览器重写 innerHTML 时 `scrollTop`/`scrollLeft` 被重置为 0——凡滚动过（垂直或水平）的文件，每次击键可见文本都会位移。修复：≤32KB 的文件改为**同步走 hljs**（单帧渲染直接出最终结果，无交换帧、工作量减半），>32KB 保留 60ms 防抖路径；并在每次渲染提交后从 textarea 回同步高亮层与行号滚动位（兜底所有 innerHTML 重写场景）。新增：**编辑器状态按会话记忆**——切换对话时快照当前会话的标签页/激活项并恢复目标会话的（此前 `applyRoot` 换根即清空标签与缓冲，切会话打开的文件全消失）；滚动位按文件路径记忆、标签恢复挂载即自动回滚；焦点不恢复，由用户自己点击决定；缓冲/脏标记以绝对路径为键全局保留，切走再切回未保存内容与 ● 状态原样还在，原「有脏文件暂不跟随根」守卫随之退役，根始终跟随新会话；**文件树展开状态同样按会话记忆**——目录展开与已加载子目录随会话快照/恢复（`applyRoot` 仅在 nodes 里没有该根节点时才重建树，同根换会话不再折叠），侧栏不再切一次对话就全部收起 |
| 2026-09-08 | v1.4.0 | 里程碑：**语法高亮升级 highlight.js 11**（193 种语言，替换自研 tokenizer）。宿主 `webServer` exact 路由下发 `lib/vendor/` 全量包与主题 CSS，客户端首次高亮时懒加载、不拖累 SPA 启动；Electron（file://）/断网/路由缺失自动回退原 tokenizer 保底可用。插件卡片新增「语法配色」：自动（默认，随编辑器明暗 GitHub ↔ GitHub Dark）+ 10 款固定主题（GitHub / Dracula / Monokai / Nord / VS…），仅染 token 色、编辑器底色仍归「编辑器主题」管理，切换即时生效并持久化。性能：重高亮 ~60ms 防抖 + >512KB 大文件自动降级轻量高亮。`tools/vendor-hljs.mjs` 重建管线入库（支持 `--themes-only`、fetch 超时重试、Dracula 取官方源）。兼容性：适配 dsh 0.1.2+ 新版 settings 服务——不再 import 已删除的 `installSettingsSection`/`settingsNamespace` 具名导出（具名导出缺失会让宿主启动即退出），照 dshmarket 内联 `register`/`watch` 接线（服务 API 新旧一致），旧宿主 0.1.0-rc.7+ 同样可跑。交互优化：文件树选中态改为实心选中色 + 选中文字反白 + 左缘 2px 白色强调条——底色跟随宿主 `--dsw-alias-button-info-fill` 令牌（与 dshUI「对话/轨迹」页签同源，回退 #4176e6），宿主换肤自动同步；原层级灰在浅色主题下与侧栏底色仅差 5/255，选中几乎隐形。文件树根目录**按会话隔离**：宿主以 sessionId→root 映射记忆各会话的手动根（「以此文件夹为根」只影响当前会话，不再全局污染），切换会话即解析新会话的 cwd 或其记忆根——修复「新会话打开仍是旧会话地址」（原手动根为宿主级全局变量，且客户端跟随标志不持久化导致刷新后跟随失效且无提示）。未发消息的新会话也能解析根目录：会话创建时所选工作区路径已写入不可变 `SessionHeader.cwd`，经 `sessions` 服务可查（原仅查 `agents`，agent 要到首条消息后才存在）；重启后重开旧对话（agent 尚未恢复）时经 `sessionController.inspect` 读持久化 header 兜底。空新对话（blank 会话）根因：宿主对 blank 会话隐藏会话头 chrome（hideChrome），插件 InputBridge 所在 slot 不渲染、捕获不到新会话 id——新增常驻 SessionWatch（root 作用域 `shell.overlay` + 标准 props `useSessions`）监听当前选中会话，blank 会话（宿主侧 agent 在 session/create 时即建、cwd=所选工作区）也能即时换根。标签页**右键菜单**：关闭 / 关闭其他 / 关闭右侧标签页 / 关闭已保存 / 关闭全部 + 复制路径（无对象项自动置灰）；关闭波及未保存文件时弹确认框（保存并关闭 / 不保存 / 取消，多文件列清单、>5 折叠计数，保存失败者保留打开）——原标签 ✕ 按钮静默丢弃未保存改动，一并接入同一确认流程 |
| 2026-09-02 | v1.3.2 | 调整：**切换按钮默认改为悬浮模式条**（原会话头 ⌨ 按钮，已保存选择的用户不受影响）；**文件树默认根跟随当前会话的工作区目录**——打开编辑器即定位到当前对话的项目根，会话切换自动换根（有未保存文件时暂不跟随并提示，保存后点 ⟳ 即切换）；手动「以此文件夹为根」后不再自动跟随 |
| 2026-09-02 | v1.3.1 | 调整：安装后编辑器**默认隐藏**（dsh UI，新装不自动占屏，⌨ / 模式条随时唤回），布局默认仍为右侧停靠；配置卡片「编辑器界面」三态说明与 README 措辞同步。新增：一键更新 / 本地包更新成功后按钮文案临时变为「需重启 DSH 生效」（置灰防误点）；README 增加「界面一览」（双布局与两种切换按钮截图）并明确配置入口路径（设置 → 插件 → 插件列表 → dsh-code-ui） |
| 2026-09-02 | v1.3.0 | 新增：文件树右键操作（真实磁盘）。右键文件：打开 / 引用给 AI（整个文件）/ 复制路径 / 在资源管理器中显示 / 重命名 / 删除；右键文件夹：新建文件 / 新建文件夹 / 以此文件夹为根 / 刷新 / 复制路径 / 定位 / 重命名 / 删除（递归强确认）；空白区右键：根目录新建 / 刷新 / 更换根；新建重命名输入弹窗（Enter 确认）、危险操作确认弹窗、工作区根禁删；重命名自动同步标签页/缓冲/watcher，删除自动清理该路径下全部标签。引用体系升级：整文件引用只传绝对路径由 AI 自行读取；停靠布局下 DSH 原生输入条发送也自动附加引用指针（挂钩 submit，两布局统一）。配置卡片：「布局模式 × 界面模式」合并为三态「编辑器界面」（右侧停靠/悬浮窗口/隐藏 dsh UI，隐藏时记住布局）。打开文件弹窗：输入路径回车直接认定（文件夹=设为根 / 文件=打开）。提示条移至顶部居中、可拖拽自定位置（⠿ 把手）。右键菜单视口边界自适应、点击菜单项后自动关闭；⟳ 刷新不再折叠整棵树 |
| 2026-09-02 | v1.2.0 | 里程碑：双布局与全面可配置。新增右侧停靠布局（code UI 固定占右侧、DSH 界面推到左侧并排，Cursor 式；左缘拖拽实时调宽，壳层帧用 [data-slot=root] 语义属性定位 + 内联 margin-right 推挤）；插件卡片新增「布局模式」（右侧停靠=默认 / 悬浮窗口）、「界面模式」（code UI / dsh UI，状态持久化、所有入口同步记忆）、「切换按钮」（会话头 ⌨ 按钮=默认 / 悬浮模式条，与布局任意组合），全部即时生效 + 持久化；文件树侧栏可收起（« / 📁 三态 / 拖窄收起）+ » 展开把手 + 右缘拖宽；侧栏标题不折行；停靠面板去投影；界面文案更名（Code UI→code UI、原始风格-ui→dsh UI）；悬浮布局也获得侧栏收起/调宽能力 |
| 2026-09-02 | v1.2.0-beta.1 | 里程碑：右侧停靠模式（feature/native-layout 分支）--会话头「⌨ Code UI」开关按钮，Code UI 固定占右侧、DSH 界面推到左侧并排（Cursor 式布局）；左缘拖拽实时调宽；文件树侧栏可收起（« 按钮 / 📁 三态 / 拖到最窄松手收起）+ » 展开把手 + 右缘拖拽调宽；侧栏标题不折行；移除停靠面板投影。推挤采用 [data-slot=root] 语义属性 + 内联 margin-right，不依赖哈希类名 |
| 2026-09-01 | v1.1.10 | 调整：底部状态栏不再用反色按钮样式，改用输入框同款背景（bg-overlay）+ 次要文字色 + 顶部分隔线，深浅色模式下均与编辑器融为一体 |
| 2026-09-01 | v1.1.9 | 修复：反色按钮文字色随主题反转（浅色=黑底白字 / 深色=白底黑字）——选中模式标签、发送按钮、状态栏等此前文字硬编码白色，DSH 深色下 brand-primary 为近白导致白底白字不可见；语法高亮 token 色改为随主题两套配色（浅色背景不再看不清代码）；「跟随 DSH」模式下实时监听宿主外观切换 token 色 |
| 2026-09-01 | v1.1.8 | 修复：主题默认值改为「跟随 DSH」（恢复随宿主外观的原行为，避免系统浅色+DSH 深色时编辑器意外变浅色）；补上文件树/标签栏遗漏的 --dsw-specific-sidebar-fill 变量（修复"只有目录是深色"的混色）；主题选项变四态：跟随 DSH / 跟随系统 / 浅色 / 深色 |
| 2026-09-01 | v1.1.7 | 新增：编辑器主题三模式（浅色/深色/跟随系统）--卡片内切换、即时生效、局部换肤不影响 DSH 其他界面、跟随系统实时响应 OS 外观；仓库公开化清理并重建 git 历史（.git 曾被意外重置，代码无损） |
| 2026-08-31 | v1.1.6 | 新增：外部修改自动同步--host 端 fs.watch 监听已打开文件，编辑器 1 秒内自动刷新；有未保存修改时标 ⚡ 徽标手动加载；自写保存回声抑制 |
| 2026-08-31 | v1.1.5 | 新增：无会话时输入框给出明确提示（常驻警告行 + 置灰按钮点击弹原因 + Ctrl+Enter 兜底提示） |
| 2026-08-28 | v1.1.4 | 新增：卡片内编辑器启用/禁用开关，切换即时挂载/卸载（无需重启/刷新），状态持久化 |
| 2026-08-28 | v1.1.3 | 改进：引用/翻译统一标签制--翻译引用加 🌐 标签，引用不再把代码正文粘贴进消息，AI 经工具读取 |
| 2026-08-28 | v1.1.2 | 改进：插件配置卡片样式与宿主卡片（PluginCard/fields）逐条统一 |
| 2026-08-28 | v1.1.1 | 修复：插件配置卡片不显示--补 host 端 settings 命名空间注册 + client inject 边 |
| 2026-08-27 | v1.1.0 | 新增：检查更新 / 一键更新 / 本地包安装（pnpm 流式进度、失败诊断、防降级） |
| 2026-08-27 | v1.0.1 | 改进：标准化 npm 插件包结构（dsh.bundle 声明、可 `dsh plugin add` 安装） |
| 2026-08-26 | v1.0.0 | 初版：Cursor 风格工作区（文件树、多标签、语法高亮、引用/备注/翻译、内嵌 AI 输入框） |

## License

MIT
