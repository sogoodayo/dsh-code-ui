// Host half of dsh-code-ui.
// Standard DeepSeek Harness bundle plugin — hand-written JS, no build step.
// Registers an RPC channel (via the shared Connection service) for the editor
// UI's file / reference / note operations, and a model tool get_referenced_snippets.

import { defineTool } from "@deepseek-ai/dsh-tools";
import { installSettingsSection, settingsNamespace } from "@deepseek-ai/dsh-settings";
import z from "@deepseek-ai/schemastery";
import { spawn } from "node:child_process";
import { existsSync, readFileSync, watch } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";

const CHANNEL = "/dsh-code-ui";

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
const CODE_UI_SETTINGS_NS = settingsNamespace("dsh-code-ui");
const CodeUiSettingsSchema = z.object({
  // 检查更新用的 registry（只影响在线「检查」；安装仍走 profile 自己的 .npmrc）
  updateRegistry: z.string().default(REGISTRY_DEFAULT),
  // 编辑器总开关：false 时 client 端不挂载编辑器 UI（配置卡片始终保留，可随时再开）
  enabled: z.boolean().default(true),
  // 编辑器主题：system(跟随操作系统) / light(浅色) / dark(深色)
  theme: z.string().default("system"),
});
// 解析后的当前值：settings 服务未挂载/未写入时保持默认
const selfSettings = { updateRegistry: REGISTRY_DEFAULT, enabled: true, theme: "system" };
// settings 服务引用（「启用/禁用」开关写入用；由 installSelfSettings 捕获）
let settingsServiceRef = null;
function installSelfSettings(ctx) {
  let source = () => ({ updateRegistry: selfSettings.updateRegistry, enabled: selfSettings.enabled, theme: selfSettings.theme });
  installSettingsSection(
    ctx,
    CODE_UI_SETTINGS_NS,
    CodeUiSettingsSchema,
    { updateRegistry: selfSettings.updateRegistry, enabled: selfSettings.enabled, theme: selfSettings.theme },
    {
      setSource: (current) => { source = current; },
      onChange: () => {
        try {
          const v = source() || {};
          if (typeof v.updateRegistry === "string" && /^https?:\/\//.test(v.updateRegistry)) {
            selfSettings.updateRegistry = v.updateRegistry.replace(/\/+$/, "");
          }
          if (typeof v.enabled === "boolean") selfSettings.enabled = v.enabled;
          if (v.theme === "system" || v.theme === "light" || v.theme === "dark") selfSettings.theme = v.theme;
        } catch (_) {}
      },
    },
  );
  // 捕获 settings 服务实例：卡片的「启用/禁用」开关经 set-enabled RPC 写入本命名空间
  ctx.inject(["settings"], (sctx) => { settingsServiceRef = sctx.settings; });
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
function makeLineFeeder() {
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
          if (t !== null) feedLine(t);
          continue;
        }
      }
      feedLine(line);
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
  let currentRootRef = detectWorkspaceRoot(ctx);

  // 每次 get-root 动态回读会话工作区根，避免一次缓存导致拿不到当前项目目录
  function baseRoot() {
    if (currentRootRef) return currentRootRef;
    return detectWorkspaceRoot(ctx);
  }
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
        const root = baseRoot();
        return ok({ root });
      }

      if (endpoint === "set-root") {
        if (!args.path) return ok({ error: "no-path" });
        currentRootRef = String(args.path);
        return ok({ root: currentRootRef });
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
        const text = await fs.readText(target);
        const MAX = 600000;
        const truncated = text.length > MAX;
        return ok({ path: args.path, content: truncated ? text.slice(0, MAX) : text, truncated });
      }

      if (endpoint === "write-file") {
        if (!args.path) return ok({ error: "no-path" });
        if (typeof args.content !== "string") return ok({ error: "no-content" });
        writeSuppress.set(args.path, Date.now() + 1500); // 自己的保存不进事件队列（回声抑制）
        await fs.writeText(await fs.resolve(args.path), args.content);
        return ok({ ok: true });
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

      if (endpoint === "add-reference") {
        const id = "r" + (idSeq++);
        const ref = {
          id,
          path: args.path || "",
          language: args.language || "",
          lineStart: args.lineStart || null,
          lineEnd: args.lineEnd || null,
          text: args.text || "",
          kind: args.kind || "cite",
          createdAt: now(),
        };
        references.push(ref);
        return ok({ id, count: references.length, reference: ref });
      }

      if (endpoint === "list-references") {
        return ok({ references });
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
        });
      }

      if (endpoint === "set-theme") {
        const v = args.theme;
        if (v !== "system" && v !== "light" && v !== "dark") return ok({ error: "theme 需为 system / light / dark" });
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

// —— 模型工具：读取用户标记的代码片段 ——
function registerSnippetsTool(tools) {
  if (!tools || typeof tools.register !== "function") return;
  tools.register(
    defineTool({
      name: "get_referenced_snippets",
      description:
        "读取用户在代码编辑器中通过「引用/翻译」标记的代码片段（含文件路径、行号、语言与内容），供 AI 直接使用。当用户在对话框提到「我引用的代码」「翻译我引用的内容」时调用。",
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
            const label = r.kind === "translate" ? "翻译请求" : "代码引用";
            const loc = (r.path || "") + (r.lineStart ? ":" + r.lineStart + "-" + r.lineEnd : "");
            const lang = r.language ? " [" + r.language + "]" : "";
            return "【" + label + "】" + loc + lang + "\n" + (r.text || "");
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

  // 注册模型工具：通过 ctx.inject 拿 tools 服务（避免 Cordis guard 直接访问 ctx.tools）
  ctx.inject(["tools"], (c) => {
    registerSnippetsTool(c.tools);
  });

  // 等待 Connection 服务就绪后注册 RPC 通道
  ctx.inject(["connection"], (c) => {
    const connection = c.connection;
    if (connection === undefined) return;
    const dispose = connection.rpc.handle(CHANNEL, rpcHandler(ctx), { authority: "loopback" });
    c.effect(() => dispose, "dsh-code-ui: rpc channel");
    c.effect(() => () => unwatchAllFiles(), "dsh-code-ui: file watchers");
  });
}

export default apply;
