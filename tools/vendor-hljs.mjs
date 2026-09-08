// vendor-hljs.mjs — 一次性重建 lib/vendor/ 下的 highlight.js 全量包与主题 CSS
// 用法：node tools/vendor-hljs.mjs [版本号，默认 11.12.0] [--themes-only 只重建主题 CSS]
// 产物：
//   lib/vendor/highlight.full.min.js  = cdnjs core(common) + 全部 languages/*.min.js 顺序拼接
//   lib/vendor/hljs-themes.css        = 10 个精选官方主题，选择器加 .cdex-syn-<id> 作用域前缀，
//                                       并把 .hljs 的 background 剥掉（编辑器底色由主题四态管）
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(HERE, "..", "lib", "vendor");
const ARGS = process.argv.slice(2);
const THEMES_ONLY = ARGS.includes("--themes-only");
const VERSION = ARGS.find((a) => !a.startsWith("--")) || "11.12.0";
const CORE = `https://cdnjs.cloudflare.com/ajax/libs/highlight.js/${VERSION}/highlight.min.js`;
const LANG_BASE = `https://cdnjs.cloudflare.com/ajax/libs/highlight.js/${VERSION}/languages/`;
const STYLE_BASE = `https://cdn.jsdelivr.net/npm/highlight.js@${VERSION}/styles/`;

// highlight.js npm 包不带 dracula（官方单独维护 hljs 主题）；从 Dracula 官方仓库取（MIT）
const THEME_SOURCES = {
  dracula: "https://raw.githubusercontent.com/dracula/highlightjs/master/dracula.css",
};

// 精选 10 个热门主题（文件名 = hljs styles/ 目录名，展示名见 client.js 里的表）
const THEMES = [
  ["github", "GitHub"],
  ["github-dark", "GitHub Dark"],
  ["atom-one-dark", "Atom One Dark"],
  ["atom-one-light", "Atom One Light"],
  ["monokai", "Monokai"],
  ["dracula", "Dracula"],
  ["nord", "Nord"],
  ["vs", "VS 浅色"],
  ["vs2015", "VS2015 深色"],
  ["tokyo-night-dark", "Tokyo Night Dark"],
];

async function fetchText(url, tries = 4) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(20000) });
      if (r.ok) return await r.text();
      if (r.status === 404) throw new Error("404 " + url);
      console.warn(`retry ${i + 1} ${r.status} ${url}`);
    } catch (e) {
      if (String(e.message).startsWith("404")) throw e;
      console.warn(`retry ${i + 1} ${e.message} ${url}`);
    }
    await new Promise((res) => setTimeout(res, 800 * (i + 1)));
  }
  throw new Error("failed " + url);
}

// —— 1)+2) 语言清单、core + 全部语言下载与拼接（--themes-only 跳过：JS 包已在时只补主题） ——
if (!THEMES_ONLY) {
  const meta = await (await fetch(`https://api.cdnjs.com/libraries/highlight.js/${VERSION}?fields=files`, { signal: AbortSignal.timeout(20000) })).json();
  const langs = (meta.files || []).filter((f) => /^languages\/[\w-]+\.min\.js$/.test(f)).map((f) => f.slice("languages/".length));
  console.log(`languages: ${langs.length}`);

  async function pool(items, n, fn) {
    const out = new Array(items.length);
    let i = 0;
    await Promise.all(Array.from({ length: n }, async () => {
      while (i < items.length) {
        const k = i++;
        out[k] = await fn(items[k]);
      }
    }));
    return out;
  }
  const core = await fetchText(CORE);
  const langCodes = await pool(langs, 8, (f) => fetchText(LANG_BASE + f));
  console.log(`core ${(core.length / 1024).toFixed(0)}KB + ${langs.length} langs ${(langCodes.reduce((s, c) => s + c.length, 0) / 1024).toFixed(0)}KB`);

  const banner = `/*! highlight.js ${VERSION} full build — core(common) + ${langs.length} languages.
   *  来源: cdnjs (core + languages/*.min.js 顺序拼接), 由 tools/vendor-hljs.mjs 生成, 勿手改。
   *  升级: node tools/vendor-hljs.mjs <新版本号> */
  `;
  mkdirSync(OUT_DIR, { recursive: true });
  const js = [banner, core, ...langCodes.map((c) => c.trim() + "\n")].join("\n");
  writeFileSync(join(OUT_DIR, "highlight.full.min.js"), js, "utf8");
  console.log(`write highlight.full.min.js ${(js.length / 1024).toFixed(0)}KB`);
}

// —— 3) 主题：下载 + 作用域化（.foo -> .cdex-syn-<id> .foo；.hljs 的 background 剥除） ——
function scopeCss(css, id) {
  let out = "";
  let i = 0;
  while (i < css.length) {
    const open = css.indexOf("{", i);
    if (open < 0) { out += css.slice(i); break; }
    const close = css.indexOf("}", open);
    if (close < 0) { out += css.slice(i); break; }
    const sel = css.slice(i, open).trim();
    const body = css.slice(open + 1, close);
    i = close + 1;
    if (sel.startsWith("@") || sel.startsWith("/*")) { out += sel + "{" + body + "}"; continue; } // @media 等原样（官方主题基本没有）
    const scoped = sel.split(",").map((s) => `.cdex-syn-${id} ${s.trim()}`).join(", ");
    // 剥掉主题自带背景（编辑器底色由我们自己的主题四态管）
    const stripped = body.replace(/(^|[;\s])background(-color)?\s*:[^;]*;?/gi, (m) => (/^\s*$/.test(m) ? m : ""));
    out += scoped + "{" + stripped + "}";
  }
  return out;
}
let cssOut = `/*! highlight.js ${VERSION} 精选主题（tools/vendor-hljs.mjs 生成, 勿手改） */\n`;
for (const [id] of THEMES) {
  const raw = await fetchText(THEME_SOURCES[id] || STYLE_BASE + id + ".css");
  cssOut += `\n/* ===== ${id} ===== */\n` + scopeCss(raw, id) + "\n";
}
writeFileSync(join(OUT_DIR, "hljs-themes.css"), cssOut, "utf8");
console.log(`write hljs-themes.css ${(cssOut.length / 1024).toFixed(0)}KB`);
