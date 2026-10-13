// Typert Remote 冒烟测试：模拟 api-gateway 的 SRC 发现链路，验证插件 Host 半的
// CodeUiService 注册模式（bindTypertRemote + Remote 标记 + ctx.root.reflect.provide）
// 在宿主真实依赖（npx 缓存里的 cordis 4.0.2 / dsh-typert-protocol 0.1.5-rc.2）上可达。
// 运行：node tools/typert-smoke.mjs
import { pathToFileURL } from "node:url";

const NPX = "C:/Users/EDY/AppData/Local/npm-cache/_npx/1e7f6d9597241db0/node_modules";
const { Context } = await import(pathToFileURL(`${NPX}/@deepseek-ai/cordis/lib/index.js`).href);
const { Remote, bindTypertRemote, remoteMethods } = await import(
  pathToFileURL(`${NPX}/@deepseek-ai/dsh-typert-protocol/lib/index.js`).href
);

// —— 复刻 lib/index.js 的注册模式 ——
function applyRemote(cls, methodName, exportName) {
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
const ENDPOINTS = ["get-root", "set-root", "list-dir", "fs-reveal", "uninstall-self"];
for (const endpoint of ENDPOINTS) {
  const method = endpoint.replace(/-([a-z])/g, (_, ch) => ch.toUpperCase());
  CodeUiService.prototype[method] = async function (args) {
    return this.__invoke(endpoint, args && typeof args === "object" ? args : {});
  };
  applyRemote(CodeUiService, method, endpoint);
}

// —— 模拟插件 apply()：注册到 root Context ——
const root = new Context();
const invoke = async (endpoint, args) => ({ ok: true, value: { endpoint, args } });
const service = new CodeUiService(invoke);
const dispose = root.reflect.provide("dsh-code-ui", service);

// —— 模拟 gateway collectSrcClaims / readBinding / srcDescriptor 的检查 ——
const results = [];
const check = (name, cond) => { results.push([name, !!cond]); if (!cond) console.error(`FAIL: ${name}`); };

const def = root.reflect.props["dsh-code-ui"];
check("reflect.props 含 dsh-code-ui", def !== undefined);
check("props type === 'service'", def && def.type === "service");
check("ctx.get 拿到服务实例", root.get("dsh-code-ui") === service);

const methods = remoteMethods(service);
check("remoteMethods 读到全部标记", methods.length === ENDPOINTS.length);
check("exportName 为 kebab-case 端点名", methods.every((m) => ENDPOINTS.includes(m.exportName ?? m.method)));

const binding = service.typertRemote;
check("binding.service 指回实例", binding.service === service);
check("binding.serviceKey 匹配 props 键", binding.serviceKey === "dsh-code-ui");
check("binding.namespace 为 dsh-code-ui", binding.namespace === "dsh-code-ui");

// —— 模拟 gateway 对单个参数的 srcDescriptor 派生（Function.toString 解析） ——
const impl = CodeUiService.prototype["getRoot"];
const src = Function.prototype.toString.call(impl);
const body = src.slice(src.indexOf("(") + 1, src.indexOf(")")).trim();
check("单参数名解析为 args（wire 字段）", body === "args");

// —— 模拟一次调用：wire args { args: payload } → 方法收到 payload ——
const wireArgs = { args: { sessionId: "s-1" } };
const received = await service["getRoot"](wireArgs.args);
check("方法收到解包后的 payload", received.value.args.sessionId === "s-1");

await dispose();
check("dispose 后服务摘除", root.get("dsh-code-ui") === undefined);

const failed = results.filter(([, ok]) => !ok).length;
console.log(`typert-smoke: ${results.length - failed}/${results.length} 通过`);
process.exit(failed ? 1 : 0);
