// Host half of dsh-code-ui.
// Standard DeepSeek Harness bundle plugin — hand-written JS, no build step.
// Exposes the editor UI's file / reference / note operations as a Typert Remote
// service (namespace dsh-code-ui on the official /api RPC channel), and a model
// tool get_referenced_snippets.

import { Remote, bindTypertRemote } from "@deepseek-ai/dsh-typert-protocol";
import { defineTool } from "@deepseek-ai/dsh-tools";
import z from "@deepseek-ai/schemastery";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, watch, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// 引用与备注：模块级内存存储，由 RPC 读写。
const references = [];
const notes = [];
let idSeq = 1;

function now() {
  return new Date().toISOString();
}
function baseName(p) {
  const parts = String(p || "").split(/[\\/]/).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : String(p || "");
}

// —— 自更新：版本自识 / registry 检查 / pnpm 安装（照 dsh-updater / dshmarket 实战经验）——
// 版本单点：name/version 一律从自身 package.json 读取，源码里绝不硬编码同步。
const HERE = dirname(fileURLToPath(import.meta.url));
function readJsonSafe(p) {
  try { return JSON.parse(readFileSync(p, "utf8")); } catch (_) { return null; }
}
const SELF_MANIFEST = readJsonSafe(join(HERE, "..", "package.json")) || { name: "dsh-code-ui", version: "0.0.0" };
const SELF_NAME = SELF_MANIFEST.name;
const SELF_VERSION = SELF_MANIFEST.version;

// —— highlight.js 静态资产：宿主 webServer exact 路由下发 ——
// /plugins 组合脚本只承载 client.js 本体，vendor 产物（全量包 + 作用域化主题 CSS）无从经其
// 下发；exact 路由无路径参数，天然无目录穿越面。产物由 tools/vendor-hljs.mjs 生成
// （升级：node tools/vendor-hljs.mjs <版本号>；只补主题：--themes-only）。
const VENDOR_ASSETS = {
  "/dsh-code-ui/vendor/highlight.full.min.js": {
    file: join(HERE, "vendor", "highlight.full.min.js"),
    type: "text/javascript; charset=utf-8",
  },
  "/dsh-code-ui/vendor/hljs-themes.css": {
    file: join(HERE, "vendor", "hljs-themes.css"),
    type: "text/css; charset=utf-8",
  },
};
// 语法配色可取值（与 lib/client.js 的 SYN_THEMES 表、tools/vendor-hljs.mjs 的 THEMES 一一对应）
const SYN_THEME_IDS = [
  "auto", "github", "github-dark", "atom-one-dark", "atom-one-light",
  "monokai", "dracula", "nord", "vs", "vs2015", "tokyo-night-dark",
];
function registerVendorRoutes(ctx) {
  // webServer 为可选宿主服务（web profile 提供）：无该服务的宿主上回调不运行，
  // 编辑器自动回退自研 tokenizer，不影响其它功能
  ctx.inject(["webServer"], (c) => {
    const disposers = [];
    for (const [path, asset] of Object.entries(VENDOR_ASSETS)) {
      disposers.push(
        c.webServer.register({
          kind: "exact",
          path,
          handler: (req, res) => {
            if (req.method !== "GET" && req.method !== "HEAD") {
              res.writeHead(405, { allow: "GET, HEAD", "content-length": "0" });
              res.end();
              return;
            }
            let body = null;
            try {
              if (existsSync(asset.file)) body = readFileSync(asset.file);
            } catch (_) {}
            if (body === null) {
              res.writeHead(404, { "cache-control": "no-store" });
              res.end();
              return;
            }
            res.writeHead(200, {
              "content-type": asset.type,
              "content-length": String(body.length),
              // 客户端以 ?v=<插件版本> 作 cache-bust：同版本字节不变，可放心长缓存
              "cache-control": "public, max-age=31536000, immutable",
            });
            res.end(req.method === "HEAD" ? undefined : body);
          },
        }),
      );
    }
    c.effect(() => () => { for (const d of disposers) { try { d(); } catch (_) {} } }, "dsh-code-ui: vendor assets");
  });
}

// profile 根 = 向上找 package.json 含 dsh.profile.bundles 的目录（不数层级、不硬编码路径）
function findProfileRoot() {
  let dir = HERE;
  for (let i = 0; i < 8; i++) {
    const m = readJsonSafe(join(dir, "package.json"));
    if (m && m.dsh && m.dsh.profile && Array.isArray(m.dsh.profile.bundles)) return dir;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
  return null;
}

// semver 比较（照 dshmarket updates.js：仅严格更高才算有更新，绝不把降级当更新）
const SEMVER_RE = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/;
function parseSemver(v) {
  const m = SEMVER_RE.exec(String(v || "").trim());
  if (m === null) return null;
  return { core: [Number(m[1]), Number(m[2]), Number(m[3])], pre: m[4] === undefined ? [] : m[4].split(".") };
}
function compareVersions(a, b) {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  if (pa === null || pb === null) return null;
  for (let i = 0; i < 3; i++) {
    if (pa.core[i] !== pb.core[i]) return pa.core[i] - pb.core[i];
  }
  if (pa.pre.length === 0 || pb.pre.length === 0) return pb.pre.length - pa.pre.length;
  for (let i = 0; i < Math.max(pa.pre.length, pb.pre.length); i++) {
    const x = pa.pre[i];
    const y = pb.pre[i];
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    if (x === y) continue;
    const nx = /^\d+$/.test(x);
    const ny = /^\d+$/.test(y);
    if (nx && ny) return Number(x) - Number(y);
    if (nx !== ny) return nx ? -1 : 1;
    return x < y ? -1 : 1;
  }
  return 0;
}
function isUpgrade(installed, latest) {
  if (!installed || !latest) return false;
  const cmp = compareVersions(latest, installed);
  return cmp !== null && cmp > 0;
}

const REGISTRY_DEFAULT = "https://registry.npmjs.org";
const REGISTRY_MIRROR = "https://registry.npmmirror.com";

// -- settings 命名空间：「插件配置」页按 host 服务的命名空间分发卡片 --
// 卡片的 key 必须是一个 host 实际注册的 settings 命名空间，否则卡片永不渲染
//（ui-settings-plugins 的 tab-store 只分发 key ∈ 已服务命名空间的卡片，照 dshmarket 的 settings.ts 做法）。
// 不 import @deepseek-ai/dsh-settings：该包 0.1.2 起删除了 installSettingsSection /
// settingsNamespace 具名导出（ESM 缺失具名导出 = 模块求值期 SyntaxError，宿主直接退出 1），
// 而服务本身 sctx.settings.register(ns, schema, { base }) 从 0.1.0-rc.7 到 0.1.2 完全一致。
// 照 dshmarket settings.js 的做法内联等价接线；下为旧 settingsNamespace() 的校验规则。
const SETTINGS_NS_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const CODE_UI_SETTINGS_NS = "dsh-code-ui";
if (!SETTINGS_NS_PATTERN.test(CODE_UI_SETTINGS_NS)) {
  throw new TypeError(`settings namespace "${CODE_UI_SETTINGS_NS}" must match ${SETTINGS_NS_PATTERN}`);
}
const CodeUiSettingsSchema = z.object({
  // 检查更新用的 registry（只影响在线「检查」；安装仍走 profile 自己的 .npmrc）
  updateRegistry: z.string().default(REGISTRY_DEFAULT),
  // 编辑器总开关：false 时 client 端不挂载编辑器 UI（配置卡片始终保留，可随时再开）
  enabled: z.boolean().default(true),
  // 编辑器主题：dsh(默认,跟随 DSH 宿主外观) / system(跟随操作系统) / light(浅色) / dark(深色)
  theme: z.string().default("dsh"),
  // 布局模式：dock(右侧停靠,默认) / float(悬浮窗口)
  layout: z.string().default("dock"),
  // 界面模式：native(隐藏编辑器,默认——新装不自动占屏,由 ⌨ 按钮唤出) / codeui(显示编辑器)
  uiMode: z.string().default("native"),
  // 切换按钮样式：bar(悬浮模式条,默认) / header(会话头 ⌨ 按钮)
  toggle: z.string().default("bar"),
  // 语法配色：auto(默认,随编辑器明暗 GitHub/GitHub Dark) 或 SYN_THEME_IDS 之一
  synTheme: z.string().default("auto"),
});
// 解析后的当前值：settings 服务未挂载/未写入时保持默认
const selfSettings = { updateRegistry: REGISTRY_DEFAULT, enabled: true, theme: "dsh", layout: "dock", uiMode: "native", toggle: "bar", synTheme: "auto" };
// settings 服务引用（「启用/禁用」开关写入用；由 installSelfSettings 捕获）
let settingsServiceRef = null;
function installSelfSettings(ctx) {
  // 组合基线（base）：settings 服务缺席/卸载时的回落取值
  const entry = { updateRegistry: selfSettings.updateRegistry, enabled: selfSettings.enabled, theme: selfSettings.theme, layout: selfSettings.layout, uiMode: selfSettings.uiMode, toggle: selfSettings.toggle, synTheme: selfSettings.synTheme };
  let source = () => entry;
  const onChange = () => {
    try {
      const v = source() || {};
      if (typeof v.updateRegistry === "string" && /^https?:\/\//.test(v.updateRegistry)) {
        selfSettings.updateRegistry = v.updateRegistry.replace(/\/+$/, "");
      }
      if (typeof v.enabled === "boolean") selfSettings.enabled = v.enabled;
      if (v.theme === "dsh" || v.theme === "system" || v.theme === "light" || v.theme === "dark") selfSettings.theme = v.theme;
      if (v.layout === "dock" || v.layout === "float") selfSettings.layout = v.layout;
      if (v.uiMode === "codeui" || v.uiMode === "native") selfSettings.uiMode = v.uiMode;
      if (v.toggle === "header" || v.toggle === "bar") selfSettings.toggle = v.toggle;
      if (typeof v.synTheme === "string" && SYN_THEME_IDS.indexOf(v.synTheme) >= 0) selfSettings.synTheme = v.synTheme;
    } catch (_) {}
  };
  // inject 是优雅降级边界：无 settings 服务的宿主上回调不运行，基线值照常生效
  //（等价于旧 installSettingsSection：inject + register + watch + 卸载回落，照 dshmarket settings.js）
  ctx.inject(["settings"], (sctx) => {
    settingsServiceRef = sctx.settings; // 写路径（set-* RPC）用服务级 update(ns, patch)，新旧版签名一致
    const scope = sctx.settings.register(CODE_UI_SETTINGS_NS, CodeUiSettingsSchema, { base: entry });
    source = () => scope.get();
    // 卸载恢复基线取值，避免路由读到无人可见/可改的值
    sctx.effect(() => () => { source = () => entry; onChange(); });
    onChange();
    scope.watch(onChange);
  });
}

async function fetchLatestVersion(name, registry) {
  const res = await fetch(registry.replace(/\/+$/, "") + "/" + encodeURIComponent(name) + "/latest", {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(12000),
  });
  if (res.status === 404) return { notFound: true };
  if (!res.ok) throw new Error("HTTP " + res.status);
  const meta = await res.json();
  return { version: typeof meta.version === "string" ? meta.version : null };
}

// 更新任务单例：perform-update 立即返回，client 轮询 get-update-progress
//（connection.rpc 底层是独立 HTTP POST，天然并发，长任务不会阻塞轮询）
const updateRun = {
  active: false, startedAt: 0, source: null, spec: null,
  phase: "idle", lines: [],
  done: false, ok: false, timedOut: false, exitCode: null,
  beforeVersion: null, afterVersion: null, error: null, hint: null,
};
function feedLine(text) {
  updateRun.lines.push(String(text).slice(0, 300));
  if (updateRun.lines.length > 150) updateRun.lines.shift();
  updateRun.phase = String(text).slice(0, 160);
}
// pnpm --reporter=ndjson 逐行事件 -> 可读文本。字段名以 pnpm 11 实测为准：
// progress/fetching-progress 用 packageId，pnpm:stage 用 stage，_dependency_resolved 用 resolution；
// scope/context/execution-time 等无信息量 debug 事件直接丢弃；非 JSON 行（老版 pnpm）原样保留。
function makeLineFeeder(push) {
  const emit = push || feedLine;
  let buffer = "";
  return (chunk) => {
    buffer += chunk;
    let nl;
    while ((nl = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (line === "") continue;
      if (line.startsWith("{")) {
        let t = null;
        let parsed = false;
        try {
          const ev = JSON.parse(line);
          parsed = true;
          const n = ev && ev.name ? String(ev.name) : "";
          const pkgId = (ev && (ev.pkgId || ev.packageId)) || "";
          if (n === "pnpm:stage" && ev.stage) t = "[阶段] " + ev.stage;
          else if ((n === "progress" || n === "pnpm:progress") && pkgId) t = "[解析] " + pkgId;
          else if ((n === "fetching-progress" || n === "pnpm:fetching-progress") && pkgId) t = "[下载] " + pkgId;
          else if (n === "pnpm:_dependency_resolved" && ev.resolution) t = "[依赖] " + ev.resolution;
          else if (n === "lifecycle" && pkgId) t = "[构建] " + pkgId + " " + (ev.script || "");
          else if ((n === "stats" || n === "pnpm:stats") && ev.added !== undefined) t = "[链接] 新增 " + ev.added + " 个包";
          else if (n === "error" || (ev && ev.level === "error")) t = "[错误] " + (ev.message || (ev.err && ev.err.message) || "");
          else if (n === "pnpm" && ev.msg) t = "[pnpm] " + ev.msg;
          else if (n === "pnpm:summary") t = "[统计] 安装流程结束";
        } catch (_) {}
        if (parsed) {
          if (t !== null) emit(t);
          continue;
        }
      }
      emit(line);
    }
  };
}

// Windows：pnpm 是 .cmd shim，必须走 cmd.exe /d /s /c + 逐 token 引号（避开 DEP0190 的 shell:true）
const WIN_CMD = process.platform === "win32";
const COMSPEC = process.env.ComSpec || "cmd.exe";
const CMD_METACHARS = /[\s"&|<>^()%!]/;
function quoteCmdArg(arg) {
  return CMD_METACHARS.test(arg) ? '"' + arg.replace(/"/g, '""') + '"' : arg;
}
function selfSpawnEnv() {
  const sep = WIN_CMD ? ";" : ":";
  const nodeBin = dirname(process.execPath);
  const parts = (process.env.PATH || "").split(sep).filter((x) => x !== "");
  if (!parts.includes(nodeBin)) parts.push(nodeBin);
  // CI 模式：pnpm 在无 TTY 下遇到交互提示会永久挂起
  return Object.assign({}, process.env, { CI: "true", PATH: parts.join(sep) });
}
function killTree(child) {
  if (WIN_CMD && child.pid !== undefined) {
    try { spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], { stdio: "ignore" }); return; } catch (_) {}
  }
  try { child.kill("SIGKILL"); } catch (_) {}
}
function pnpmAdd(spec, profileRoot, extraArgs) {
  return new Promise((resolveP) => {
    const workspace = existsSync(join(profileRoot, "pnpm-workspace.yaml"));
    const args = ["add"].concat(workspace ? ["-w"] : [], [spec, "--reporter=ndjson"], extraArgs);
    feedLine("$ pnpm " + args.join(" "));
    const stdio = ["ignore", "pipe", "pipe"];
    let child;
    if (!WIN_CMD) {
      child = spawn("pnpm", args, { cwd: profileRoot, env: selfSpawnEnv(), stdio, shell: false });
    } else {
      const cmdline = ["pnpm"].concat(args).map(quoteCmdArg).join(" ");
      child = spawn(COMSPEC, ["/d", "/s", "/c", '"' + cmdline + '"'], {
        cwd: profileRoot, env: selfSpawnEnv(), stdio, shell: false, windowsVerbatimArguments: true,
      });
    }
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; killTree(child); }, 10 * 60 * 1000);
    const feed = makeLineFeeder();
    if (child.stdout) child.stdout.on("data", feed);
    if (child.stderr) child.stderr.on("data", feed);
    child.on("error", (err) => {
      clearTimeout(timer);
      feedLine("[spawn-error] " + err.message);
      resolveP({ ok: false, exitCode: 127, timedOut: false });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolveP({ ok: code === 0 && !timedOut, exitCode: code == null ? -1 : code, timedOut });
    });
  });
}
// 失败归类 + 可操作建议（不把 pnpm 原始错误直接甩给用户）
function diagnoseUpdateFailure(output) {
  const s = String(output || "");
  if (/EAI_AGAIN|ECONNREFUSED|ECONNRESET|ETIMEDOUT|ENOTFOUND|network|proxy|socket hang up|fetch/i.test(s))
    return "网络或 registry 连接出错，多为瞬时故障，点「重试」往往能成功；长期失败请检查代理/镜像设置。";
  if (/npmmirror|No matching version|not found while fetching|404/i.test(s))
    return "镜像可能尚未同步该版本。profile 的 .npmrc 已指向官方源；若刚发布，稍等几分钟再试。";
  if (/EPERM|EACCES|EBUSY|permission denied/i.test(s))
    return "文件被占用或权限不足（Windows 上常见于文件句柄未释放）。重启 DSH 后再点一次更新。";
  if (/ERR_PNPM_IGNORED_BUILDS|Ignored build scripts|allowBuilds/i.test(s))
    return "pnpm 拦截了构建脚本（allowBuilds）。本插件无原生构建，通常可忽略；如反复出现请检查 profile 的 pnpm 配置。";
  if (/ERR_PNPM_UNEXPECTED_STORE|store-dir/i.test(s))
    return "pnpm store 位置不一致，可在 profile 目录执行 pnpm install 重建后再试。";
  if (/ERR_PNPM_PUBLIC_HOIST_PATTERN_DIFF/i.test(s))
    return "profile 的 node_modules 由旧版 pnpm 创建，先在 profile 目录执行一次 pnpm install 重建，再回来更新。";
  if (/ERR_PNPM_ADDING_TO_ROOT|workspace root/i.test(s))
    return "pnpm 拒绝在 workspace 根安装（-w 参数问题），请把此反馈给插件作者。";
  return "未能识别的失败。可展开输出查看详情后重试，或手动在 profile 目录执行 pnpm add " + SELF_NAME + "@latest。";
}
async function runSelfUpdate(spec, profileRoot, source) {
  const before = readJsonSafe(join(profileRoot, "node_modules", SELF_NAME, "package.json"));
  Object.assign(updateRun, {
    active: true, startedAt: Date.now(), source: source, spec: spec,
    phase: "starting", lines: [], done: false, ok: false, timedOut: false, exitCode: null,
    beforeVersion: before && before.version ? before.version : null,
    afterVersion: null, error: null, hint: null,
  });
  let result = await pnpmAdd(spec, profileRoot, []);
  let output = updateRun.lines.join("\n");
  // 已知坑自动恢复：minimumReleaseAge 拦截 / 瞬时网络失败（各自动重试一次）
  if (!result.ok && !result.timedOut && /ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION|NO_MATURE_MATCHING_VERSION|minimumReleaseAge/i.test(output)) {
    feedLine("[code-ui] 命中 pnpm minimumReleaseAge 拦截，自动附加 --config.minimumReleaseAge=0 重试一次");
    result = await pnpmAdd(spec, profileRoot, ["--config.minimumReleaseAge=0"]);
  } else if (!result.ok && !result.timedOut && /EAI_AGAIN|ECONNREFUSED|ECONNRESET|ETIMEDOUT|ENOTFOUND|socket hang up|network/i.test(output)) {
    feedLine("[code-ui] 瞬时网络失败，自动重试一次");
    result = await pnpmAdd(spec, profileRoot, []);
  }
  output = updateRun.lines.join("\n");
  if (result.ok) {
    const after = readJsonSafe(join(profileRoot, "node_modules", SELF_NAME, "package.json"));
    updateRun.afterVersion = after && after.version ? after.version : null;
    if (updateRun.beforeVersion && updateRun.afterVersion === updateRun.beforeVersion) {
      // pnpm 的 minimumReleaseAge 会静默保持旧版并退出 0——干净退出不等于更新成功
      updateRun.ok = false;
      updateRun.error = "pnpm 成功退出但版本没有变化";
      updateRun.hint = "新版本可能被 minimumReleaseAge 静默保持旧版，或安装源与当前版本相同；可稍后重试。";
    } else {
      updateRun.ok = true;
      feedLine("[完成] " + (updateRun.beforeVersion || "?") + " -> " + (updateRun.afterVersion || "?") + "，重启 DSH 后生效");
    }
  } else {
    updateRun.error = result.timedOut ? "更新超时，已终止（可重试）" : "pnpm 失败（退出码 " + (result.exitCode == null ? "unknown" : result.exitCode) + "）";
    updateRun.hint = diagnoseUpdateFailure(output);
  }
  updateRun.done = true;
  updateRun.active = false;
  updateRun.phase = updateRun.ok ? "done" : "failed";
}

// —— 自卸载（v1.5.3）：配置卡「卸载插件」——
// 官方依据：DSH 0.1.6-alpha.2「插件管理支持运行时卸载，请开发者检查插件加载和卸载逻辑」。
// 宿主 0.1.5-rc.2 无运行时卸载 → 卸载 = 从 profile 移除依赖 + dsh.profile.bundles 清单 + node_modules，
// 完成后必须告知用户重启 DSH（当前进程内插件仍运行到重启为止，这是预期行为不是 bug）。
// 策略：优先官方 CLI（dsh plugin --profile <p> remove <name>，exit 0 时官方 CLI 自己同步清单）；
// CLI 不可用退 pnpm remove + 手动补删 bundles 行；失败按磁盘真相 reconcile
//（#65 写序保护：pnpm 可能在删完 node_modules 后、写 package.json 前被文件锁打断，留下幽灵清单行
// 会让整个 profile 下次起不来——所以磁盘已删而清单未清时必须补删清单行）。
const uninstallRun = {
  active: false, startedAt: 0, phase: "idle", lines: [],
  done: false, ok: false, timedOut: false, exitCode: null,
  alreadyGone: false, cliUsed: null, manifestReconciled: false, filesGone: false,
  error: null, code: null, hint: null, manualSteps: null,
};
function uFeedLine(text) {
  uninstallRun.lines.push(String(text).slice(0, 300));
  if (uninstallRun.lines.length > 150) uninstallRun.lines.shift();
  uninstallRun.phase = String(text).slice(0, 160);
}
function pnpmRemove(profileRoot, extraArgs) {
  return new Promise((resolveP) => {
    const workspace = existsSync(join(profileRoot, "pnpm-workspace.yaml"));
    const args = ["remove"].concat(workspace ? ["-w"] : [], [SELF_NAME, "--reporter=ndjson"], extraArgs);
    uFeedLine("$ pnpm " + args.join(" "));
    const stdio = ["ignore", "pipe", "pipe"];
    let child;
    if (!WIN_CMD) {
      child = spawn("pnpm", args, { cwd: profileRoot, env: selfSpawnEnv(), stdio, shell: false });
    } else {
      const cmdline = ["pnpm"].concat(args).map(quoteCmdArg).join(" ");
      child = spawn(COMSPEC, ["/d", "/s", "/c", '"' + cmdline + '"'], {
        cwd: profileRoot, env: selfSpawnEnv(), stdio, shell: false, windowsVerbatimArguments: true,
      });
    }
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; killTree(child); }, 10 * 60 * 1000);
    const feed = makeLineFeeder(uFeedLine);
    if (child.stdout) child.stdout.on("data", feed);
    if (child.stderr) child.stderr.on("data", feed);
    child.on("error", (err) => {
      clearTimeout(timer);
      uFeedLine("[spawn-error] " + err.message);
      resolveP({ ok: false, exitCode: 127, timedOut: false });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolveP({ ok: code === 0 && !timedOut, exitCode: code == null ? -1 : code, timedOut });
    });
  });
}
// 再唤起启动本宿主的 CLI 执行官方卸载。三种启动形态（照 dshmarket dshArgv 实战）：
// ① 源码/本地入口启动（pnpm dsh web 等，argv[1] 指向 bin）→ node <execArgv> <entry> plugin --profile ...
//    （必须带 execArgv 且 cwd=入口目录，否则 tsx/esm 导入解析不到，MODULE_NOT_FOUND）
// ② POSIX 直装 → 裸 dsh
// ③ Windows 直装 → dsh 是 .cmd shim，必须 cmd.exe /d /s /c + 逐 token 引号（同更新器 pnpm 套路）
function dshPluginRemove(profileName) {
  return new Promise((resolveP) => {
    const pluginArgs = ["plugin", "--profile", profileName, "remove", SELF_NAME];
    const entry = process.argv[1];
    let child;
    if (entry && /[\\/](?:bin\.(?:js|ts)|dsh)$/.test(entry)) {
      uFeedLine("$ node " + basename(entry) + " " + pluginArgs.join(" "));
      child = spawn(process.execPath, process.execArgv.concat([resolve(entry)], pluginArgs), {
        cwd: dirname(entry), env: selfSpawnEnv(), stdio: ["ignore", "pipe", "pipe"], shell: false,
      });
    } else if (!WIN_CMD) {
      uFeedLine("$ dsh " + pluginArgs.join(" "));
      child = spawn("dsh", pluginArgs, { env: selfSpawnEnv(), stdio: ["ignore", "pipe", "pipe"], shell: false });
    } else {
      const cmdline = ["dsh"].concat(pluginArgs).map(quoteCmdArg).join(" ");
      uFeedLine("$ dsh " + pluginArgs.join(" ") + "    (windows cmd shim)");
      child = spawn(COMSPEC, ["/d", "/s", "/c", '"' + cmdline + '"'], {
        env: selfSpawnEnv(), stdio: ["ignore", "pipe", "pipe"], shell: false, windowsVerbatimArguments: true,
      });
    }
    let timedOut = false;
    let out = "";
    const collect = (chunk) => { out = (out + chunk.toString()).slice(-8192); };
    const timer = setTimeout(() => { timedOut = true; killTree(child); }, 10 * 60 * 1000);
    const feed = makeLineFeeder(uFeedLine);
    if (child.stdout) child.stdout.on("data", (c) => { collect(c); feed(c); });
    if (child.stderr) child.stderr.on("data", (c) => { collect(c); feed(c); });
    child.on("error", (err) => {
      clearTimeout(timer);
      uFeedLine("[spawn-error] " + err.message);
      resolveP({ ok: false, exitCode: 127, timedOut: false, output: (out + "\n" + err.message).slice(-8192) });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolveP({ ok: code === 0 && !timedOut, exitCode: code == null ? -1 : code, timedOut, output: out });
    });
  });
}
// 磁盘真相：dep 有无 / bundles 有无 / node_modules 有无
function manifestUninstallState(profileRoot) {
  const m = readJsonSafe(join(profileRoot, "package.json"));
  const depPresent = !!(m && m.dependencies && Object.prototype.hasOwnProperty.call(m.dependencies, SELF_NAME));
  const bundles = m && m.dsh && m.dsh.profile && Array.isArray(m.dsh.profile.bundles) ? m.dsh.profile.bundles : null;
  const bundlePresent = !!bundles && bundles.indexOf(SELF_NAME) >= 0;
  const filesPresent = existsSync(join(profileRoot, "node_modules", SELF_NAME, "package.json"));
  return { manifestOk: !!m, depPresent: depPresent, bundlePresent: bundlePresent, filesPresent: filesPresent };
}
// 清单收尾（原子写：tmp + rename；Windows 目标被锁 → "locked"）。dropDep=false 只删 bundles 行。
function dropManifestRows(profileRoot, dropDep) {
  const file = join(profileRoot, "package.json");
  const m = readJsonSafe(file);
  if (!m) return "unreadable";
  let touched = false;
  if (dropDep && m.dependencies && m.dependencies[SELF_NAME] !== undefined) {
    delete m.dependencies[SELF_NAME];
    touched = true;
  }
  const bundles = m.dsh && m.dsh.profile && Array.isArray(m.dsh.profile.bundles) ? m.dsh.profile.bundles : null;
  if (bundles && bundles.indexOf(SELF_NAME) >= 0) {
    m.dsh.profile.bundles = bundles.filter((b) => b !== SELF_NAME);
    touched = true;
  }
  if (!touched) return "clean";
  try {
    const tmp = file + ".code-ui-uninstall.tmp";
    writeFileSync(tmp, JSON.stringify(m, null, 2) + "\n", "utf8");
    renameSync(tmp, file);
    return "removed";
  } catch (_) {
    return "locked";
  }
}
// 每个错误码对应可执行的手动处理步骤（用户照做就能完成卸载）
function manualStepsFor(code, profileName) {
  const cli = "dsh plugin --profile " + profileName + " remove " + SELF_NAME;
  const table = {
    PROFILE_NOT_FOUND: [
      "确认 DSH_HOME 位置（默认 ~/.dsh，Windows 为 C:\\Users\\<你>\\.dsh）",
      "检查 profiles/web/package.json 是否存在且含 dsh.profile.bundles",
    ],
    PLUGIN_CMD_FAILED: [
      "关闭 DSH（文件被运行中的进程占用是最常见原因）",
      "终端执行：" + cli,
      "仍失败则进入 profile 目录执行：pnpm remove " + SELF_NAME,
      "完成后重启 DSH",
    ],
    PNPM_FAILED: [
      "关闭 DSH（文件占用是最常见原因）",
      "进入 profile 目录执行：pnpm remove " + SELF_NAME,
      "若报 EPERM/EBUSY：结束所有 node 进程或重启电脑后重试",
      "完成后重启 DSH",
    ],
    TIMEOUT: [
      "pnpm 卡住（锁/网络），稍后重试一次",
      "仍卡住：删除 profile/node_modules/.pnpm 下的锁残留后重试",
      "或手动执行：" + cli,
    ],
    MANIFEST_LOCKED: [
      "关闭 DSH",
      "手动编辑 profile/package.json：删除 dependencies 里的 \"" + SELF_NAME + "\" 行，以及 dsh.profile.bundles 数组里的 \"" + SELF_NAME + "\" 项",
      "进入 profile 目录执行：pnpm install",
      "重启 DSH",
    ],
    FILES_STILL_PRESENT: [
      "清单已清但文件仍在（被运行中进程占用）：关闭 DSH",
      "手动删除 node_modules 下的 " + SELF_NAME + " 目录（及 node_modules/.pnpm 内对应目录）",
      "或重启 DSH 后再卸载一次",
    ],
  };
  return table[code] || ["终端执行：" + cli, "或进入 profile 目录执行：pnpm remove " + SELF_NAME, "完成后重启 DSH"];
}
async function runSelfUninstall(profileRoot) {
  const profileName = basename(profileRoot);
  Object.assign(uninstallRun, {
    active: true, startedAt: Date.now(), phase: "starting", lines: [],
    done: false, ok: false, timedOut: false, exitCode: null,
    alreadyGone: false, cliUsed: null, manifestReconciled: false, filesGone: false,
    error: null, code: null, hint: null, manualSteps: null,
  });
  const verdict = (okFlag, code, message, hint) => {
    uninstallRun.ok = okFlag;
    if (code) {
      uninstallRun.code = code;
      uninstallRun.error = message || "";
      uninstallRun.hint = hint || "";
      uninstallRun.manualSteps = manualStepsFor(code, profileName);
    }
    uninstallRun.done = true;
    uninstallRun.active = false;
    uninstallRun.phase = okFlag ? "done" : "failed";
    uFeedLine(okFlag ? "[完成] 已从 profile 移除，重启 DSH 后彻底生效" : "[失败] " + code + " " + (message || ""));
  };
  try {
    let st = manifestUninstallState(profileRoot);
    if (!st.manifestOk) return verdict(false, "PROFILE_NOT_FOUND", "profile package.json 不可读", "profile 目录异常");
    if (!st.depPresent && !st.bundlePresent && !st.filesPresent) {
      uninstallRun.alreadyGone = true;
      uFeedLine("[code-ui] profile 中已无本插件，无需卸载");
      return verdict(true, null, null);
    }
    // 主路径：官方 CLI（exit 0 时官方自己同步 dependencies + bundles）
    let cli = await dshPluginRemove(profileName);
    uninstallRun.exitCode = cli.exitCode;
    uninstallRun.timedOut = cli.timedOut;
    if (cli.ok) {
      uninstallRun.cliUsed = "dsh";
    } else if (cli.timedOut) {
      return verdict(false, "TIMEOUT", "dsh plugin remove 超时，已终止", "可重试或按手动步骤执行");
    } else if (cli.exitCode === 127 || /not recognized|不是内部或外部命令|command not found|cannot find/i.test(cli.output || "")) {
      // CLI 不可用（拿不到 dsh 命令）→ 退路：pnpm remove
      uFeedLine("[code-ui] dsh CLI 不可用，退路：pnpm remove");
      let r = await pnpmRemove(profileRoot, []);
      let out = uninstallRun.lines.join("\n");
      if (!r.ok && !r.timedOut && /ERR_PNPM_PUBLIC_HOIST_PATTERN_DIFF|hoist/i.test(out)) {
        uFeedLine("[code-ui] node_modules 由旧版 pnpm 创建，先重建再重试");
        const rb = await spawnPnpmInstallRebuild(profileRoot);
        if (rb.ok) r = await pnpmRemove(profileRoot, []);
      }
      uninstallRun.exitCode = r.exitCode;
      uninstallRun.timedOut = r.timedOut;
      if (r.ok) {
        uninstallRun.cliUsed = "pnpm";
      } else if (r.timedOut) {
        return verdict(false, "TIMEOUT", "pnpm remove 超时，已终止", "可重试或按手动步骤执行");
      } else {
        return verdict(false, "PNPM_FAILED", "pnpm remove 失败（退出码 " + r.exitCode + "）", "详见输出与手动步骤");
      }
    } else {
      // CLI 在但执行失败：多为文件占用；按磁盘真相收尾，能救则救
      uFeedLine("[code-ui] CLI 退出码 " + cli.exitCode + "，按磁盘真相收尾");
    }
    // 收尾：按磁盘真相 reconcile（#65 幽灵清单保护）
    st = manifestUninstallState(profileRoot);
    if (!st.filesPresent && (st.depPresent || st.bundlePresent)) {
      const r = dropManifestRows(profileRoot, st.depPresent);
      uninstallRun.manifestReconciled = r === "removed";
      if (r === "locked") return verdict(false, "MANIFEST_LOCKED", "清单写入失败（文件被占用）", "按手动步骤编辑 package.json");
      if (r === "unreadable") return verdict(false, "MANIFEST_LOCKED", "package.json 不可读", "按手动步骤检查 profile");
      st = manifestUninstallState(profileRoot);
    } else if (st.filesPresent && uninstallRun.cliUsed === "pnpm") {
      // pnpm 路径成功但 bundles 行只有官方 CLI 会同步——pnpm 路径需手动删 bundles 行
      //（注意此时文件应已删除；若文件还在说明 pnpm 实际没删掉，走 FILES_STILL_PRESENT 判定）
      const r = dropManifestRows(profileRoot, false);
      uninstallRun.manifestReconciled = r === "removed";
    }
    st = manifestUninstallState(profileRoot);
    uninstallRun.filesGone = !st.filesPresent;
    if (!st.filesPresent && !st.depPresent && !st.bundlePresent) {
      return verdict(true, null, null);
    }
    if (st.filesPresent) {
      return verdict(false, "FILES_STILL_PRESENT", "插件文件仍在磁盘（多半被运行中的 DSH 占用）", "关闭 DSH 后按手动步骤删除，或重启后再试一次");
    }
    return verdict(false, "MANIFEST_LOCKED", "清单仍有残留", "按手动步骤编辑 package.json");
  } catch (err) {
    return verdict(false, "PLUGIN_CMD_FAILED", String((err && err.message) || err), "执行异常");
  }
}
// hoist 漂移重建（node_modules 由旧版 pnpm 创建时）：pnpm install --no-frozen-lockfile（尽力而为）
function spawnPnpmInstallRebuild(profileRoot) {
  return new Promise((resolveP) => {
    const args = ["install", "--no-frozen-lockfile"];
    uFeedLine("$ pnpm " + args.join(" ") + "    (rebuild node_modules)");
    let child;
    if (!WIN_CMD) {
      child = spawn("pnpm", args, { cwd: profileRoot, env: selfSpawnEnv(), stdio: ["ignore", "pipe", "pipe"], shell: false });
    } else {
      const cmdline = ["pnpm"].concat(args).map(quoteCmdArg).join(" ");
      child = spawn(COMSPEC, ["/d", "/s", "/c", '"' + cmdline + '"'], {
        cwd: profileRoot, env: selfSpawnEnv(), stdio: ["ignore", "pipe", "pipe"], shell: false, windowsVerbatimArguments: true,
      });
    }
    const timer = setTimeout(() => killTree(child), 10 * 60 * 1000);
    const feed = makeLineFeeder(uFeedLine);
    if (child.stdout) child.stdout.on("data", feed);
    if (child.stderr) child.stderr.on("data", feed);
    child.on("error", () => { clearTimeout(timer); resolveP({ ok: false }); });
    child.on("close", (code) => { clearTimeout(timer); resolveP({ ok: code === 0 }); });
  });
}

// —— RPC 处理：文件系统 + 引用/备注 ——
// -- 文件监听：对 Code UI 已打开的文件建 fs.watch，外部修改记入事件队列 --
// client 每 1 秒 take-file-events 拉空队列（插件 RPC 是单向请求/响应，没有 host->浏览器推送通道，
// 用「真事件 + 轻量取事件」实现外部修改自动刷新）。
const fileWatchers = new Map(); // path -> FSWatcher
const fileEvents = [];          // { path, ts }，上限截断防膨胀
const writeSuppress = new Map(); // path -> 时间戳：Code UI 自己保存引发的回声事件不进队列
const FILE_EVENTS_MAX = 200;
function watchFilePath(path) {
  if (typeof path !== "string" || !path || fileWatchers.has(path)) return;
  let lastTs = 0;
  let w = null;
  try { w = watch(path, () => { }); } catch (_) { return; }
  const onEvent = () => {
    const now = Date.now();
    if (now <= (writeSuppress.get(path) || 0)) return; // 自己保存的回声
    if (now - lastTs < 300) return; // 去抖：Windows 一次保存常触发多次回调
    lastTs = now;
    fileEvents.push({ path: path, ts: now });
    if (fileEvents.length > FILE_EVENTS_MAX) fileEvents.splice(0, fileEvents.length - FILE_EVENTS_MAX);
  };
  w.on("change", onEvent);
  w.on("error", () => { unwatchFilePath(path); }); // 文件被删除/重命名：释放 watcher
  fileWatchers.set(path, w);
}
function unwatchFilePath(path) {
  const w = fileWatchers.get(path);
  if (!w) return;
  fileWatchers.delete(path);
  try { w.close(); } catch (_) {}
}
function unwatchAllFiles() {
  for (const p of [...fileWatchers.keys()]) unwatchFilePath(p);
}

function rpcHandler(ctx) {
  const fs = ctx.get("fs");
  let currentRootRef = detectWorkspaceRoot(ctx); // 最近一次解析的根：list-dir 的兜底
  // 每会话根目录记忆：sessionId -> 手动设置的根（「以此文件夹为根」）。
  // 按会话隔离——手动根只影响设置它的那个会话，不再全局污染其它会话的自动解析；
  // 重启 DSH 即清空，各会话回到各自 cwd 解析。自动解析结果不缓存（会话 cwd 可变，保持实时）。
  const sessionRoots = new Map();

  function detectWorkspaceRoot(_ctx) {
    // 1) 当前会话的真实工作区根(项目根)：优先取正在发起调用的 agent 的 session cwd。
    //    sandboxPolicy.workspaceRoot 只是「部署回退根」，常是 DSH 进程 cwd 而非项目目录。
    let root = null;
    const agents = _ctx.get && _ctx.get("agents");
    if (agents) {
      try {
        const init = agents.currentInitiator();
        if (init && init.session && init.session.header && init.session.header.cwd) {
          root = init.session.header.cwd;
        }
      } catch (_) {}
    }
    // 2) 回退到 sandboxPolicy 的部署回退根
    if (!root) {
      const sp = _ctx.get && _ctx.get("sandboxPolicy");
      if (sp && typeof sp.workspaceRoot === "string" && sp.workspaceRoot) {
        root = sp.workspaceRoot;
      }
    }
    // 3) 再回退到进程 cwd
    if (!root && typeof process !== "undefined" && process.cwd) {
      try { root = process.cwd(); } catch (_) {}
    }
    return root;
  }

  return async (endpoint, payload, _signal) => {
    try {
      const args = payload && typeof payload === "object" ? payload : {};

      if (endpoint === "get-root") {
        // 优先级（按会话隔离）：该会话手动设置的根 > 该会话的 agent cwd（agent 已启动，
        // agent/session id 共享，agents.get 可查）> 该会话的 SessionHeader.cwd（新会话未发
        // 消息时 agents 里还没有记录，但会话创建时 cwd 已从所选工作区写入不可变 header，
        // 经 sessions 服务可查）> initiator 会话 cwd > 部署回退根 > 进程 cwd。
        // 手动根仅对本会话生效，其它会话不受污染。
        const sid = args.sessionId ? String(args.sessionId) : "";
        let root = sid ? sessionRoots.get(sid) || null : null;
        if (!root && sid) {
          const agentsSvc = ctx.get("agents");
          if (agentsSvc) {
            try {
              const a = agentsSvc.get(sid);
              if (a && a.session && a.session.header && a.session.header.cwd) {
                root = a.session.header.cwd;
              }
            } catch (_) {}
          }
        }
        // 新会话（尚未发消息、agent 未启动）：从会话存储取 SessionHeader.cwd
        if (!root && sid) {
          const sessionsSvc = ctx.get("sessions");
          if (sessionsSvc && typeof sessionsSvc.get === "function") {
            try {
              const s = sessionsSvc.get(sid);
              if (s && s.header && s.header.cwd) root = s.header.cwd;
            } catch (_) {}
          }
        }
        // 会话已持久化但未在内存存储（如重启 DSH 后重开旧对话、agent 尚未恢复）：
        // 经 sessionController.inspect 读持久化 header（官方语义：不激活 agent）
        if (!root && sid) {
          const sc = ctx.get("sessionController");
          if (sc && typeof sc.inspect === "function") {
            try {
              const r = await sc.inspect(sid);
              if (r && r.meta && r.meta.cwd) root = r.meta.cwd;
            } catch (_) {}
          }
        }
        if (!root) root = detectWorkspaceRoot(ctx);
        if (root) currentRootRef = root;
        return ok({ root });
      }

      if (endpoint === "set-root") {
        if (!args.path) return ok({ error: "no-path" });
        // 手动根按会话记录：只影响发起设置的会话；无会话上下文时退化为全局兜底
        const path = String(args.path);
        const sid = args.sessionId ? String(args.sessionId) : "";
        if (sid) sessionRoots.set(sid, path);
        currentRootRef = path;
        return ok({ root: path });
      }

      if (endpoint === "list-dir") {
        const path = args.path || currentRootRef;
        if (!path) return ok({ error: "no-root" });
        const target = await fs.resolve(path);
        const entries = await fs.listDir(target);
        const sep = String(path).includes("\\") ? "\\" : "/";
        const list = entries.map((e) => {
          let name = null;
          let isDir = false;
          if (e && typeof e === "object") {
            name = e.name;
            if (!name && e.path) name = baseName(e.path);
            const flag = e.isDirectory !== undefined ? e.isDirectory : e.isDir;
            if (typeof flag === "boolean") isDir = flag;
            else {
              const t = String(e.type || e.kind || "").toLowerCase();
              isDir = t.indexOf("dir") >= 0 || t === "folder";
            }
          }
          name = name || "unknown";
          const childPath = String(path).replace(/[\\/]+$/, "") + sep + name;
          return { name, path: childPath, isDir };
        });
        list.sort(
          (a, b) => (b.isDir ? 1 : 0) - (a.isDir ? 1 : 0) || a.name.localeCompare(b.name),
        );
        return ok({ path, entries: list });
      }

      if (endpoint === "stat-path") {
        if (!args.path) return ok({ error: "no-path" });
        const target = await fs.resolve(args.path);
        const info = await fs.stat(target);
        // DSH fs.stat 返回 FsInfo { type: 'file' | 'directory' | 'other' }，
        // 没有 isDirectory/isFile 布尔字段；必须按 type 判定（原实现恒为 false，
        // 导致目录路径被误报为「不存在」）。保留遗留字段兼容。
        const t = info ? String(info.type || "") : "";
        const isDir = !!(info && (info.isDirectory || info.isDir)) || t === "directory";
        const isFile = !isDir && (!!(info && (info.isFile || info.type === "file")) || t === "file");
        return ok({ path: args.path, isDir, isFile, exists: !!info });
      }

      if (endpoint === "read-file") {
        if (!args.path) return ok({ error: "no-path" });
        const target = await fs.resolve(args.path);
        // 对齐 dsh ≥ 0.1.7-rc.1 的二进制 Remote 结果契约：字节经 Uint8Array 字段返回，
        // gateway 自动投影为 multipart 附件下发；0.1.5/0.1.6 老宿主无投影则走 JSON
        // （Uint8Array 落成下标对象，客户端负责重建），同一份代码两端兼容。
        // 取代旧的 60 万字符文本截断——截断内容若被 Ctrl+S 原样写回会写坏大文件。
        const MAX = 4 * 1024 * 1024; // 单次读取上限 4MB
        try {
          const bytes = await fs.readBytes(target, undefined, MAX);
          return ok({ path: args.path, bytes, truncated: false, size: bytes.length });
        } catch (err) {
          if (!err || err.code !== "FS_TOO_LARGE" || typeof fs.readByteRange !== "function") throw err;
          // 超限文件读前 4MB，标记 truncated；客户端据此禁写并提示
          const bytes = await fs.readByteRange(target, { offset: 0, length: MAX });
          return ok({ path: args.path, bytes, truncated: true });
        }
      }

      if (endpoint === "write-file") {
        if (!args.path) return ok({ error: "no-path" });
        if (typeof args.content !== "string") return ok({ error: "no-content" });
        try {
          writeSuppress.set(args.path, Date.now() + 1500); // 自己的保存不进事件队列（回声抑制）
          // 原生写入：code UI 的 Ctrl+S 是用户显式编辑动作，不受会话沙箱限制
          // （与文件树右键新建/重命名/删除一致；沙箱 fs 只允许写会话工作区，
          //  工作区之外的文件会报 file access denied under workspace-write mode）
          writeFileSync(args.path, args.content, "utf8");
          return ok({ ok: true });
        } catch (err) {
          writeSuppress.delete(args.path);
          return ok({ error: "保存失败：" + ((err && err.message) || String(err)) });
        }
      }

      if (endpoint === "watch-file") {
        if (typeof args.path !== "string" || !existsSync(args.path)) return ok({ error: "无效路径" });
        watchFilePath(args.path);
        return ok({ ok: true, watching: fileWatchers.has(args.path) });
      }

      if (endpoint === "unwatch-file") {
        if (typeof args.path === "string") unwatchFilePath(args.path);
        return ok({ ok: true });
      }

      if (endpoint === "take-file-events") {
        const events = fileEvents.splice(0, fileEvents.length);
        return ok({ events: events });
      }

      // —— 文件树磁盘操作（真实文件系统，右键菜单用） ——
      if (endpoint === "fs-mkdir") {
        if (!args.path) return ok({ error: "no-path" });
        try {
          mkdirSync(args.path, { recursive: true });
          return ok({ ok: true, path: args.path });
        } catch (err) {
          return ok({ error: "创建目录失败：" + ((err && err.message) || String(err)) });
        }
      }

      if (endpoint === "fs-createfile") {
        if (!args.path) return ok({ error: "no-path" });
        if (existsSync(args.path)) return ok({ error: "已存在同名文件/目录" });
        try {
          writeSuppress.set(args.path, Date.now() + 1500);
          writeFileSync(args.path, "", "utf8");
          return ok({ ok: true, path: args.path });
        } catch (err) {
          return ok({ error: "创建文件失败：" + ((err && err.message) || String(err)) });
        }
      }

      if (endpoint === "fs-rename") {
        if (!args.from || !args.to) return ok({ error: "需要 from 与 to 路径" });
        if (!existsSync(args.from)) return ok({ error: "源路径不存在" });
        if (existsSync(args.to)) return ok({ error: "目标已存在同名文件/目录" });
        try {
          // 若重命名的正是被监听的文件：停掉旧 watcher（客户端重开时会按新路径重新 watch）
          unwatchFilePath(args.from);
          writeSuppress.set(args.from, Date.now() + 1500);
          renameSync(args.from, args.to);
          return ok({ ok: true, from: args.from, to: args.to });
        } catch (err) {
          return ok({ error: "重命名失败：" + ((err && err.message) || String(err)) });
        }
      }

      if (endpoint === "fs-delete") {
        if (!args.path) return ok({ error: "no-path" });
        if (!existsSync(args.path)) return ok({ error: "路径不存在" });
        try {
          // 被监听的文件被删除：停 watcher + 抑制回声事件
          if (fileWatchers.has(args.path)) unwatchFilePath(args.path);
          writeSuppress.set(args.path, Date.now() + 1500);
          rmSync(args.path, { recursive: !!args.recursive, force: false });
          return ok({ ok: true });
        } catch (err) {
          return ok({ error: "删除失败：" + ((err && err.message) || String(err)) });
        }
      }

      if (endpoint === "fs-reveal") {
        if (!args.path) return ok({ error: "no-path" });
        try {
          if (process.platform === "win32") {
            spawn("explorer", ["/select," + args.path], { detached: true, stdio: "ignore" }).unref();
          } else if (process.platform === "darwin") {
            spawn("open", ["-R", args.path], { detached: true, stdio: "ignore" }).unref();
          } else {
            spawn("xdg-open", [dirname(args.path)], { detached: true, stdio: "ignore" }).unref();
          }
          return ok({ ok: true });
        } catch (err) {
          return ok({ error: "打开文件管理器失败：" + ((err && err.message) || String(err)) });
        }
      }

      if (endpoint === "add-reference") {
        const path = args.path || "";
        const kind = args.kind || "cite";
        const lineStart = args.lineStart || null;
        const lineEnd = args.lineEnd || null;
        // 允许重复引用：chip 在输入框句中可视化，重复了用户看得见、可 ✕ 删除，无需 host 去重拦截。
        // （原逻辑曾对同 path+行区间+kind 的未使用引用去重，行内 chip 落地后按用户要求取消）
        const id = "r" + (idSeq++);
        const ref = {
          id,
          path,
          language: args.language || "",
          lineStart,
          lineEnd,
          text: args.text || "",
          kind,
          used: false, // 一次性消耗标记：随消息发送后由 use-references 置 true（chip 清空，记录保留）
          createdAt: now(),
        };
        references.push(ref);
        return ok({ id, count: references.length, reference: ref });
      }

      if (endpoint === "list-references") {
        return ok({ references });
      }

      if (endpoint === "use-references") {
        // 引用一次性消耗：把本条消息附带的引用标记为 used（不删除——AI 在消息发出后才经
        // get_referenced_snippets 读取，删除就读不到了；used 记录保留供用户在【引用/备注】查找）。
        const ids = Array.isArray(args.ids) ? args.ids : [];
        let n = 0;
        for (const r of references) {
          if (!r.used && ids.indexOf(r.id) >= 0) { r.used = true; r.usedAt = now(); n++; }
        }
        return ok({ ok: true, used: n });
      }

      if (endpoint === "delete-reference") {
        const i = references.findIndex((r) => r.id === args.id);
        if (i >= 0) references.splice(i, 1);
        return ok({ ok: true });
      }

      if (endpoint === "add-note") {
        const id = "n" + (idSeq++);
        const n = {
          id,
          path: args.path || "",
          lineStart: args.lineStart || null,
          lineEnd: args.lineEnd || null,
          note: args.note || "",
          createdAt: now(),
        };
        notes.push(n);
        return ok({ id, note: n });
      }

      if (endpoint === "list-notes") {
        const path = args.path;
        const list = path ? notes.filter((n) => n.path === path) : notes;
        return ok({ notes: list });
      }

      if (endpoint === "delete-note") {
        const i = notes.findIndex((n) => n.id === args.id);
        if (i >= 0) notes.splice(i, 1);
        return ok({ ok: true });
      }

      if (endpoint === "get-self") {
        const profileRoot = findProfileRoot();
        return ok({
          name: SELF_NAME,
          version: SELF_VERSION,
          profileRoot: profileRoot,
          workspace: profileRoot ? existsSync(join(profileRoot, "pnpm-workspace.yaml")) : false,
          updateRegistry: selfSettings.updateRegistry,
          enabled: selfSettings.enabled !== false,
          theme: selfSettings.theme,
          layout: selfSettings.layout,
          uiMode: selfSettings.uiMode,
          toggle: selfSettings.toggle,
          synTheme: selfSettings.synTheme,
        });
      }

      if (endpoint === "set-toggle") {
        const v = args.toggle;
        if (v !== "header" && v !== "bar") return ok({ error: "toggle 需为 header / bar" });
        if (!settingsServiceRef || typeof settingsServiceRef.update !== "function") {
          return ok({ error: "settings 服务不可用，重启 DSH 后再试" });
        }
        try {
          await settingsServiceRef.update(CODE_UI_SETTINGS_NS, { toggle: v });
          selfSettings.toggle = v;
          return ok({ ok: true, toggle: v });
        } catch (err) {
          return ok({ error: "写入设置失败：" + ((err && err.message) || String(err)) });
        }
      }

      if (endpoint === "set-uimode") {
        const v = args.uiMode;
        if (v !== "codeui" && v !== "native") return ok({ error: "uiMode 需为 codeui / native" });
        if (!settingsServiceRef || typeof settingsServiceRef.update !== "function") {
          return ok({ error: "settings 服务不可用，重启 DSH 后再试" });
        }
        try {
          await settingsServiceRef.update(CODE_UI_SETTINGS_NS, { uiMode: v });
          selfSettings.uiMode = v;
          return ok({ ok: true, uiMode: v });
        } catch (err) {
          return ok({ error: "写入设置失败：" + ((err && err.message) || String(err)) });
        }
      }

      if (endpoint === "set-layout") {
        const v = args.layout;
        if (v !== "dock" && v !== "float") return ok({ error: "layout 需为 dock / float" });
        if (!settingsServiceRef || typeof settingsServiceRef.update !== "function") {
          return ok({ error: "settings 服务不可用，重启 DSH 后再试" });
        }
        try {
          await settingsServiceRef.update(CODE_UI_SETTINGS_NS, { layout: v });
          selfSettings.layout = v;
          return ok({ ok: true, layout: v });
        } catch (err) {
          return ok({ error: "写入设置失败：" + ((err && err.message) || String(err)) });
        }
      }

      if (endpoint === "set-theme") {
        const v = args.theme;
        if (v !== "dsh" && v !== "system" && v !== "light" && v !== "dark") return ok({ error: "theme 需为 dsh / system / light / dark" });
        if (!settingsServiceRef || typeof settingsServiceRef.update !== "function") {
          return ok({ error: "settings 服务不可用，重启 DSH 后再试" });
        }
        try {
          await settingsServiceRef.update(CODE_UI_SETTINGS_NS, { theme: v });
          selfSettings.theme = v;
          return ok({ ok: true, theme: v });
        } catch (err) {
          return ok({ error: "写入设置失败：" + ((err && err.message) || String(err)) });
        }
      }

      if (endpoint === "set-syn-theme") {
        const v = args.synTheme;
        if (SYN_THEME_IDS.indexOf(v) < 0) return ok({ error: "synTheme 需为 auto 或受支持的主题 id" });
        if (!settingsServiceRef || typeof settingsServiceRef.update !== "function") {
          return ok({ error: "settings 服务不可用，重启 DSH 后再试" });
        }
        try {
          await settingsServiceRef.update(CODE_UI_SETTINGS_NS, { synTheme: v });
          selfSettings.synTheme = v;
          return ok({ ok: true, synTheme: v });
        } catch (err) {
          return ok({ error: "写入设置失败：" + ((err && err.message) || String(err)) });
        }
      }

      if (endpoint === "set-enabled") {
        if (typeof args.enabled !== "boolean") return ok({ error: "enabled 参数需为布尔值" });
        if (!settingsServiceRef || typeof settingsServiceRef.update !== "function") {
          return ok({ error: "settings 服务不可用，重启 DSH 后再试" });
        }
        try {
          // 写入命名空间（schema 校验 + 持久化；watch 会经 onChange 再同步一次 selfSettings）
          await settingsServiceRef.update(CODE_UI_SETTINGS_NS, { enabled: args.enabled });
          selfSettings.enabled = args.enabled;
          return ok({ ok: true, enabled: args.enabled });
        } catch (err) {
          return ok({ error: "写入设置失败：" + ((err && err.message) || String(err)) });
        }
      }

      if (endpoint === "check-update") {
        const out = { current: SELF_VERSION, latest: null, updateAvailable: false, notPublished: false, registryUsed: null, error: null };
        // 主源 = 设置里的 updateRegistry（默认官方源，镜像有同步滞后）；主源不可达时用另一个兜底做「检查」
        const primary = selfSettings.updateRegistry || REGISTRY_DEFAULT;
        const fallback = primary === REGISTRY_MIRROR ? REGISTRY_DEFAULT : REGISTRY_MIRROR;
        try {
          const r = await fetchLatestVersion(SELF_NAME, primary);
          out.registryUsed = primary;
          if (r.notFound) out.notPublished = true;
          else if (r.version) { out.latest = r.version; out.updateAvailable = isUpgrade(out.current, r.version); }
        } catch (errPrimary) {
          try {
            const r2 = await fetchLatestVersion(SELF_NAME, fallback);
            out.registryUsed = fallback;
            if (r2.notFound) out.notPublished = true;
            else if (r2.version) { out.latest = r2.version; out.updateAvailable = isUpgrade(out.current, r2.version); }
          } catch (errSecond) {
            out.error = "registry 连接失败：" + ((errSecond && errSecond.message) || String(errSecond));
          }
        }
        return ok(out);
      }

      if (endpoint === "perform-update") {
        if (updateRun.active) return ok({ error: "已有更新任务在进行中" });
        const profileRoot = findProfileRoot();
        if (!profileRoot) return ok({ error: "未找到 profile 根目录（package.json 缺少 dsh.profile.bundles），无法自动更新" });
        const source = args.source === "local" ? "local" : "registry";
        let spec = null;
        if (source === "registry") {
          const v = String(args.version || "");
          if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(v)) return ok({ error: "缺少有效版本号（version-invalid）" });
          spec = SELF_NAME + "@" + v;
        } else {
          const p = String(args.path || "");
          if (!isAbsolute(p) || !/\.t?gz$/i.test(p) || !existsSync(p)) {
            return ok({ error: "请提供本地 .tgz 包的绝对路径（文件需存在）" });
          }
          spec = p;
        }
        runSelfUpdate(spec, profileRoot, source); // 异步执行；进度经 get-update-progress 轮询
        return ok({ started: true });
      }

      if (endpoint === "get-update-progress") {
        return ok({
          active: updateRun.active, done: updateRun.done, ok: updateRun.ok,
          phase: updateRun.phase, source: updateRun.source,
          beforeVersion: updateRun.beforeVersion, afterVersion: updateRun.afterVersion,
          error: updateRun.error, hint: updateRun.hint,
          lines: updateRun.lines.slice(-40),
        });
      }

      if (endpoint === "uninstall-self") {
        if (uninstallRun.active) return ok({ error: "卸载任务已在进行中" });
        const profileRoot = findProfileRoot();
        if (!profileRoot) {
          return ok({ ok: false, code: "PROFILE_NOT_FOUND", error: "未找到 profile 根目录（package.json 缺少 dsh.profile.bundles）", manualSteps: manualStepsFor("PROFILE_NOT_FOUND", "web") });
        }
        runSelfUninstall(profileRoot); // 异步执行；进度经 get-uninstall-progress 轮询（与更新同一模式）
        return ok({ started: true });
      }

      if (endpoint === "get-uninstall-progress") {
        return ok({
          active: uninstallRun.active, done: uninstallRun.done, ok: uninstallRun.ok,
          phase: uninstallRun.phase, alreadyGone: uninstallRun.alreadyGone,
          cliUsed: uninstallRun.cliUsed, manifestReconciled: uninstallRun.manifestReconciled,
          filesGone: uninstallRun.filesGone,
          error: uninstallRun.error, code: uninstallRun.code, hint: uninstallRun.hint,
          manualSteps: uninstallRun.manualSteps,
          lines: uninstallRun.lines.slice(-40),
        });
      }

      return fail("未知端点: " + endpoint);
    } catch (err) {
      return fail(String((err && err.message) || err));
    }
  };
}

function ok(value) {
  return { ok: true, value };
}
function fail(message) {
  return { ok: false, error: { code: "internal", message, details: {} } };
}

// —— Typert Remote 服务：经官方 /api 通道对浏览器暴露上列全部端点 ——
// api-gateway 扫描宿主 root Context 的 reflect.props，发现带 typertRemote 绑定且原型上有
// Remote 方法标记的服务（SRC 发现模式，0.1.5-rc.2 与 0.2.0-rc.2 机制一致），把
// 「dsh-code-ui/<端点>」分发到对应方法；gateway 监听 internal/service 事件做缓存失效，
// 插件晚于 gateway 加载也能被发现。方法签名约束（SRC 派生）：参数必须是简单标识符、
// 不能解构/默认值/rest，参数名即 wire 字段名；客户端 call('/api', ep, { args: {...} }) 的
// 内层对象按参数名取字段。本服务所有方法只收单个 args 对象，逐个委托给 rpcHandler 闭包，
// 端点逻辑零改动。
function applyRemote(cls, methodName, exportName) {
  // 无装饰器语法的手动调用：Remote(exportName) 返回标准方法装饰器，
  // addInitializer 里以 cls.prototype 为原型造对象，让标记写到类原型上。
  Remote(exportName)(cls.prototype[methodName], {
    kind: "method", name: methodName, static: false, private: false,
    addInitializer(fn) { fn.call(Object.create(cls.prototype)); },
  });
}

class CodeUiService {
  constructor(invoke) {
    this.typertRemote = bindTypertRemote(this, "dsh-code-ui");
    this.__invoke = invoke;
  }
}

// 端点清单（kebab-case，与 lib/client.js 调用点、rpcHandler 分支一一对应）
const CODE_UI_ENDPOINTS = [
  "get-root", "set-root", "list-dir", "stat-path",
  "read-file", "write-file", "watch-file", "unwatch-file", "take-file-events",
  "fs-mkdir", "fs-createfile", "fs-rename", "fs-delete", "fs-reveal",
  "add-reference", "list-references", "use-references", "delete-reference",
  "add-note", "list-notes", "delete-note",
  "get-self", "set-toggle", "set-uimode", "set-layout", "set-theme",
  "set-syn-theme", "set-enabled",
  "check-update", "perform-update", "get-update-progress",
  "uninstall-self", "get-uninstall-progress",
];
for (const endpoint of CODE_UI_ENDPOINTS) {
  const method = endpoint.replace(/-([a-z])/g, (_, ch) => ch.toUpperCase());
  // 委托约定：rpcHandler 返回 RpcResult 封套；ok:false 抛出 Error 让 gateway 转成
  // { ok: false, error: { code: 'gateway/internal', message } }，客户端 callHost 折叠为
  // { error: message }（与 handler 内 fail() 走到客户端的错误形态一致）；ok:true 解出 value 原样返回。
  CodeUiService.prototype[method] = async function (args) {
    const r = await this.__invoke(endpoint, args && typeof args === "object" ? args : {});
    if (r && typeof r === "object" && r.ok === false) {
      throw new Error((r.error && (r.error.message || r.error.code)) || "RPC 调用失败");
    }
    return r && typeof r === "object" && "value" in r ? r.value : r;
  };
  applyRemote(CodeUiService, method, endpoint);
}

// —— 模型工具：读取用户标记的代码片段 ——
function registerSnippetsTool(tools) {
  if (!tools || typeof tools.register !== "function") return;
  tools.register(
    defineTool({
      name: "get_referenced_snippets",
      description:
        "读取用户在代码编辑器中通过「引用/翻译」标记的代码片段（含文件路径、行号、语言与内容），供 AI 直接使用。文件树右键「引用给 AI」标记的整文件引用只含绝对路径，请用你自己的文件读取工具打开。当用户在对话框提到「我引用的代码」「翻译我引用的内容」时调用。",
      parameters: {
        kind: { type: "string", description: "筛选类型：cite(代码引用) / translate(翻译请求) / all(全部，默认)。" },
      },
      output: {
        schema: { type: "json" },
        render: (_args, value) => {
          const v = value || {};
          const refs = Array.isArray(v.references) ? v.references : [];
          if (refs.length === 0) return [{ type: "text", text: "当前没有已标记的代码片段。" }];
          const parts = refs.map((r) => {
            const whole = !r.lineStart;
            const label = r.kind === "translate" ? "翻译请求" : whole ? "文件引用" : "代码引用";
            const loc = (r.path || "") + (whole ? "（整个文件）" : ":" + r.lineStart + "-" + r.lineEnd);
            const num = r.seq ? "，用户 tag 编号 " + r.seq : "";
            const lang = (r.language ? " [" + r.language + "]" : "") + (r.used ? "（已使用" + (r.usedAt ? " " + r.usedAt : "") + num + "）" : "");
            const body = whole
              ? "整个文件的引用：请用你的文件读取工具打开上述绝对路径自行读取。"
              : (r.text || "");
            return "【" + label + "】" + loc + lang + "\n" + body;
          });
          return [{ type: "text", text: "共 " + refs.length + " 条标记：\n\n" + parts.join("\n\n") }];
        },
      },
      async execute(args) {
        const kind = args && args.kind;
        let list = references;
        if (kind && kind !== "all") list = references.filter((r) => r.kind === kind);
        return { count: list.length, references: list };
      },
    }),
  );
}

export const name = "dsh-code-ui";
export const inject = ["tools"];

export function apply(ctx) {
  // 注册 settings 命名空间（插件配置页按命名空间分发卡片；内部自带 ctx.inject(['settings'])，
  // 无 settings 服务的宿主上静默不运行，不影响其它功能）
  installSelfSettings(ctx);

  // vendor 静态资产路由（highlight.js 全量包 + 主题 CSS）：webServer 服务存在时注册 exact 路由，
  // 客户端编辑器懒加载；无 webServer 的宿主上静默跳过（编辑器回退自带 tokenizer）
  registerVendorRoutes(ctx);

  // 注册模型工具：通过 ctx.inject 拿 tools 服务（避免 Cordis guard 直接访问 ctx.tools）
  ctx.inject(["tools"], (c) => {
    registerSnippetsTool(c.tools);
  });

  // 注册 Typert Remote 服务到宿主 root Context（api-gateway 只扫描它所在 Context 的
  // reflect.props；root 与 gateway 同层，0.1.5-rc.2 / 0.2.0-rc.2 一致）。服务生命周期
  // 挂到本插件 fiber：卸载时自动从 root 摘除，gateway 经 internal/service 事件失效缓存。
  const invoke = rpcHandler(ctx);
  ctx.effect(() => {
    const service = new CodeUiService(invoke);
    const dispose = ctx.root.reflect.provide("dsh-code-ui", service);
    console.log("[dsh-code-ui] Typert Remote 服务已注册（/api 通道）：dsh-code-ui");
    return () => { Promise.resolve(dispose()).catch(() => {}); };
  }, "dsh-code-ui: typert remote service");

  // 文件监听随插件卸载清理
  ctx.effect(() => () => unwatchAllFiles(), "dsh-code-ui: file watchers");
}

export default apply;
