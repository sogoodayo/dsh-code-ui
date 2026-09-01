# dsh-code-ui

在 DeepSeek Harness（DSH）里的 **Cursor 风格 AI 代码编辑器**插件：文件树、多标签页编辑、语法高亮、引用/翻译给 AI。

它把 Cursor 那种「边看代码、边跟 AI 对话」的体验搬进 DSH：一个带活动栏、文件树、多标签页编辑器的代码工作区，底部直接内嵌 AI 输入框。

## 功能

- **Cursor 风格工作区**：活动栏 + 文件树侧边栏 + 多标签页编辑器 + 状态栏
- **语法高亮**：内联轻量 tokenizer，覆盖 JS/TS/Python/HTML/CSS 等
- **文件浏览与编辑**：展开目录、打开文件、直接编辑、`Ctrl+S` 保存写回磁盘
- **选中代码右键**：
  - 📋 复制
  - 📥 粘贴到备注
  - 📝 添加备注
  - 🌐 翻译（创建翻译引用，交给 AI 翻译）
  - 🔗 引用给 AI
- **引用 chip**：引用后输入框上方显示 `文件名(起行-止行)` + ✕，删除引用
- **内嵌 AI 输入框**：直接输入、`Ctrl+Enter` 发送；发送时不粘贴引用正文，只附一行引用指针，内容由 AI 调用 `get_referenced_snippets` 工具读取
- **主题跟随**：使用 DSH 的 `--dsw-alias-*` 语义变量，浅色/深色自动切换
- **窗口化/全屏**：可拖拽、可缩放、可全屏/还原
- **以此文件夹为根**：文件浏览器里可选任意目录作为工作区根
- **检查更新 / 一键更新**：设置 → 插件 → 插件配置 中的 dsh-code-ui 卡片，支持在线检查 npm 新版本并一键更新；未发布/开发期可填本地 `.tgz` 路径安装（pnpm 流式进度展示，失败自动归类给出建议，完成后提示重启 DSH 生效）

## 安装

通过 `dsh plugin` 一键安装（已声明 `dsh.bundle`）：

```bash
dsh plugin --profile web add dsh-code-ui
```

安装完成后重启 DSH，页面顶部出现 `Code UI` / `原始风格-ui` 切换浮条，点 `Code UI` 进入编辑器。

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

1. 点顶部 `Code UI` 进入编辑器
2. 在文件树/浏览器里打开文件
3. 选中代码右键 → 引用 / 翻译 / 备注 / 复制
4. 底部输入框直接发消息（`Ctrl+Enter` 发送）；引用只以标签显示，正文由 AI 工具读取
5. 也可对 AI 说「读取我引用的代码」，AI 会调用 `get_referenced_snippets` 工具

## 目录结构

```
dsh-code-ui/
├── package.json      # 包声明（含 dsh.bundle.patch / dsh.client）
├── lib/
│   ├── index.js      # Host 端：connection.rpc 文件/引用/备注 RPC + get_referenced_snippets 工具
│   └── client.js     # Client 端：__ModuleLoader__ + 编辑器 UI
└── cordis.patch.yml  # bundle 插接层
```

纯 JavaScript 手写实现，无需构建，可直接 `npm publish`。

## 实现说明

- **Host↔Client RPC**：Host 通过 `connection.rpc.handle("/dsh-code-ui", handler)` 注册文件系统/引用/备注端点；Client 通过 `connection.rpc.call("/dsh-code-ui", endpoint, payload)` 调用。RPC 返回值遵循 DSH 的 `RpcResult` 协议（`{ ok: true, value }` / `{ ok: false, error }`）。
- **模型工具**：注册 `get_referenced_snippets`，让 AI 读取用户标记的代码片段。
- **Client UI**：`window.__ModuleLoader__.load({ id, factory })` 注册，React 通过 `require("react")` 获取，slot 通过 `ctx.get("slots")` 注册（`shell.overlay`），样式用 `--dsw-alias-*` 主题变量。

## 二次开发

- `lib/index.js`：改文件读写、引用/备注存储、或新增 RPC 端点（在 `connection.rpc.handle` 的 handler 里加 `if (endpoint === ...)`）
- `lib/client.js`：改编辑器 UI 布局、配色（`styles` 模板串里的 CSS）、或新增右键菜单项
- 引用/备注数据存模块内存（运行期有效，重启清空）

## 发布

```bash
npm publish --dry-run
npm publish
```

发布前确认 `name` 未被占用，必要时改为 scope 如 `@yourname/dsh-code-ui`。

## 更新日志

> 约定：每次版本升级在本节顶部追加一行（时间 | 版本 | 修复/新增内容）。

| 时间 | 版本 | 修复 / 新增 |
| --- | --- | --- |
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
