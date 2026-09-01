// Browser half of dsh-code-ui — standard bundle plugin.
// Hand-written JS, no build. Registered via __ModuleLoader__; host RPC goes
// through the shared Connection service channel "/dsh-code-ui".
window.__ModuleLoader__.load({
  id: "dsh-code-ui",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    const React = require("react");
    // 宿主种子模块（与 react 同级，所有 client bundle 可 require）：用和其他卡片同款的 chevron 图标
    let IconChevronDown = null;
    try {
      const primitives = require("@deepseek-ai/dsh-client-ui-primitives");
      if (primitives && primitives.IconChevronDownOutline14) IconChevronDown = primitives.IconChevronDownOutline14;
    } catch (e) {}
    const CHANNEL = "/dsh-code-ui";

    function __apply(ctx) {
// --- begin original apply body ---

    /* ============ §1 依赖与服务 ============ */
    const { rpc } = (ctx.get('connection') || {});
    // connection.rpc.call 返回 DSH 的 RpcResult 封套（{ ok: true, value } / { ok: false, error }），
    // 协议失败不会 reject（只有传输层 HTTP 失败才 throw）。这里统一解包成「裸值」，
    // 协议错误折叠为 { error: message }，让下方各调用点沿用自己的 res.error 判断
    // （对齐 dsh-updater 的 res.ok / res.value 消费约定）。
    // 修复：迁移期版本直接读 res.entries / res.root 等字段，在封套下恒为 undefined，
    // 导致 get-root / 文件树 / 路径跳转（stat-path）全部静默失效。
    function callHost(endpoint, payload) {
      return rpc.call(CHANNEL, endpoint, payload === undefined ? null : payload)
        .then((res) => {
          if (!res || typeof res !== 'object') return { error: 'RPC 返回异常' }
          if (res.ok === false) {
            const e = res.error || {}
            return { error: e.message || e.code || 'RPC 调用失败' }
          }
          const v = res.value
          if (v && typeof v === 'object' && v.error) return v
          return v == null ? {} : v
        })
        .catch((err) => ({ error: (err && err.message) ? err.message : String(err) }))
    }
    const slots = ctx.get('slots');
    if (slots === undefined) return
    const timer = ctx.get('timer')
    const h = React.createElement
    const vw = (typeof window !== 'undefined' && window.innerWidth) ? window.innerWidth : 1200
    const vh = (typeof window !== 'undefined' && window.innerHeight) ? window.innerHeight : 800

    /* ============ §2 样式注入 ============ */
    ctx.on('theme/change', () => { emit() })
    ctx.effect(() => { const tag = document.createElement('style'); tag.setAttribute('data-plugin', 'dsh-code-ui'); tag.textContent = `
      .cdex-modebar{position:fixed;z-index:10005;display:flex;gap:2px;background:var(--dsw-alias-bg-overlay,#252526);border:1px solid var(--dsw-alias-border-l2,#454545);border-radius:20px;padding:3px;box-shadow:0 6px 20px rgba(0,0,0,.45);pointer-events:auto;user-select:none;}
      .cdex-mode-grip{display:flex;align-items:center;padding:0 4px 0 8px;color:var(--dsw-alias-label-secondary,#6f6f6f);cursor:grab;font-size:14px;}
      .cdex-mode-grip:active{cursor:grabbing;}
      .cdex-mode-tab{border:none;background:transparent;color:var(--dsw-alias-label-secondary,#9d9d9d);padding:6px 16px;border-radius:16px;cursor:pointer;font-size:12.5px;font-weight:500;white-space:nowrap;}
      .cdex-mode-tab.active{background:var(--dsw-alias-brand-primary,#0e639c);color:#ffffff;}
      .cdex-mode-tab:hover:not(.active){color:var(--dsw-alias-label-primary,#ffffff);}
      .cdex-workbench{position:fixed;z-index:10000;display:flex;flex-direction:column;background:var(--dsw-alias-bg-base,#1e1e1e);color:var(--dsw-alias-label-primary,#d4d4d4);font-family:-apple-system,'Segoe UI',system-ui,sans-serif;font-size:13px;pointer-events:auto;overflow:hidden;}
      .cdex-top{display:flex;align-items:center;height:34px;background:var(--dsw-alias-bg-layer-2,#323233);padding:0 10px;gap:8px;user-select:none;cursor:move;}
      .cdex-top-title{font-weight:600;color:var(--dsw-alias-label-primary,#cccccc);}
      .cdex-top-spacer{flex:1;}
      .cdex-top-hint{color:var(--dsw-alias-label-secondary,#8a8a8a);font-size:12px;}
      .cdex-main{display:flex;flex:1;min-height:0;}
      .cdex-activitybar{width:48px;background:var(--dsw-alias-bg-layer-1,#1b1b1f);display:flex;flex-direction:column;align-items:center;padding:6px 0;}
      .cdex-abar-btn{width:40px;height:40px;display:flex;align-items:center;justify-content:center;border:none;background:transparent;color:var(--dsw-alias-label-secondary,#9d9d9d);font-size:20px;border-radius:6px;cursor:pointer;margin:2px 0;position:relative;}
      .cdex-abar-btn:hover{color:var(--dsw-alias-label-primary,#ffffff);}
      .cdex-abar-btn.active{color:var(--dsw-alias-label-primary,#ffffff);}
      .cdex-abar-btn.active::before{content:'';position:absolute;left:0;top:8px;bottom:8px;width:2px;background:var(--dsw-alias-brand-primary,#6b8afd);border-radius:1px;}
      .cdex-abar-spacer{flex:1;}
      .cdex-sidebar{width:264px;background:var(--dsw-specific-sidebar-fill,#252526);display:flex;flex-direction:column;min-height:0;}
      .cdex-sidebar-head{display:flex;align-items:center;justify-content:space-between;padding:8px 12px;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--dsw-alias-label-secondary,#bbbbbb);}
      .cdex-tree{flex:1;overflow:auto;padding:4px;}
      .cdex-node{display:flex;align-items:center;gap:5px;padding:2px 6px;border-radius:4px;cursor:pointer;white-space:nowrap;color:var(--dsw-alias-label-primary,#cccccc);font-size:13px;}
      .cdex-node:hover{background:var(--dsw-alias-bg-layer-1,#2a2d2e);}
      .cdex-node.active{background:var(--dsw-alias-bg-layer-2,#37373d);}
      .cdex-arrow{width:14px;flex:0 0 auto;color:var(--dsw-alias-label-secondary,#888888);text-align:center;font-size:11px;}
      .cdex-folder{color:#dcb67a;}
      .cdex-file{color:var(--dsw-alias-label-primary,#cccccc);}
      .cdex-editor{flex:1;display:flex;flex-direction:column;min-width:0;background:var(--dsw-alias-bg-base,#1e1e1e);}
      .cdex-tabs{display:flex;align-items:center;height:36px;background:var(--dsw-specific-sidebar-fill,#252526);overflow-x:auto;overflow-y:hidden;}
      .cdex-tab{display:flex;align-items:center;gap:6px;padding:0 10px;height:36px;border-right:1px solid var(--dsw-alias-border-l1,#1e1e1e);cursor:pointer;color:var(--dsw-alias-label-secondary,#969696);font-size:13px;white-space:nowrap;background:var(--dsw-alias-bg-layer-1,#2d2d2d);}
      .cdex-tab.active{background:var(--dsw-alias-bg-base,#1e1e1e);color:var(--dsw-alias-label-primary,#ffffff);border-top:1px solid var(--dsw-alias-brand-primary,#6b8afd);}
      .cdex-tab-close{border:none;background:transparent;color:var(--dsw-alias-label-secondary,#969696);cursor:pointer;font-size:12px;padding:0;}
      .cdex-tab-close:hover{color:var(--dsw-alias-label-primary,#ffffff);}
      .cdex-tab-actions{display:flex;align-items:center;gap:6px;padding:0 8px;}
      .cdex-codearea{flex:1;display:flex;min-height:0;background:var(--dsw-alias-bg-base,#1e1e1e);}
      .cdex-gutter{width:56px;flex:0 0 auto;overflow:hidden;background:var(--dsw-alias-bg-base,#1e1e1e);color:var(--dsw-alias-label-secondary,#858585);text-align:right;padding:8px 0;font-family:Consolas,'Cascadia Code',Menlo,monospace;font-size:13px;line-height:20px;white-space:pre;user-select:none;}
      .cdex-textarea{flex:1;background:var(--dsw-alias-bg-base,#1e1e1e);color:var(--dsw-alias-label-primary,#d4d4d4);border:none;outline:none;resize:none;padding:8px 14px;font-family:Consolas,'Cascadia Code',Menlo,monospace;font-size:13px;line-height:20px;white-space:pre;overflow:auto;}
      /* —— 内联语法高亮 overlay —— */
      .cdex-code-layer{position:relative;flex:1;min-width:0;overflow:hidden;background:var(--dsw-alias-bg-base,#1e1e1e);}
      .cdex-code-pre{position:absolute;inset:0;margin:0;padding:8px 14px;font-family:Consolas,'Cascadia Code',Menlo,monospace;font-size:13px;line-height:20px;white-space:pre;color:var(--dsw-alias-label-primary,#d4d4d4);pointer-events:none;overflow:hidden;scrollbar-width:none;}
      .cdex-code-ta{position:absolute;inset:0;width:100%;height:100%;background:transparent;color:transparent;caret-color:var(--dsw-alias-label-primary,#d4d4d4);border:none;outline:none;resize:none;padding:8px 14px;font-family:Consolas,'Cascadia Code',Menlo,monospace;font-size:13px;line-height:20px;white-space:pre;overflow:auto;box-sizing:border-box;}
      .cdex-code-ta::selection{background:rgba(107,138,253,.35);}
      .cdx-tk-kw{color:#c586c0;font-weight:600;}
      .cdx-tk-str{color:#ce9178;}
      .cdx-tk-com{color:#6a9955;font-style:italic;}
      .cdx-tk-num{color:#b5cea8;}
      .cdx-tk-fn{color:#dcdcaa;}
      .cdx-tk-tag{color:#569cd6;}
      .cdx-tk-props{color:#9cdcfe;}
      .cdx-tk-attr{color:#dcdcaa;}
      .cdx-tk-punc{color:#808080;}
      .cdx-tk-plain{color:var(--dsw-alias-label-primary,#d4d4d4);}
      .cdex-empty{color:var(--dsw-alias-label-secondary,#6f6f6f);padding:16px;font-size:13px;}
      .cdex-empty-root{color:var(--dsw-alias-label-secondary,#8a8a8a);font-size:12px;margin-bottom:10px;word-break:break-all;font-family:Consolas,'Cascadia Code',Menlo,monospace;}
      .cdex-empty-root b{color:var(--dsw-alias-label-primary,#d4d4d4);font-weight:600;}
      .cdex-error{color:var(--dsw-alias-state-error-primary,#f48771);padding:8px;font-size:12px;}
      .cdex-statusbar{display:flex;align-items:center;height:24px;background:var(--dsw-alias-brand-primary,#6b8afd);color:#ffffff;font-size:12px;padding:0 12px;gap:16px;user-select:none;}
      .cdex-statusbar .cdex-dirty{color:var(--dsw-alias-state-warn-primary,#ffe082);font-weight:600;}
      .cdex-btn{border:1px solid var(--dsw-alias-border-l2,#3e3e42);background:var(--dsw-alias-brand-primary,#0e639c);color:#ffffff;border-radius:4px;padding:4px 10px;cursor:pointer;font-size:12px;}
      .cdex-btn:hover{filter:brightness(1.1);}
      .cdex-btn:disabled{opacity:.5;cursor:not-allowed;}
      .cdex-btn-ghost{border:1px solid var(--dsw-alias-border-l1,#3e3e42);background:var(--dsw-alias-bg-layer-2,#3c3c3c);color:var(--dsw-alias-label-primary,#cccccc);border-radius:4px;padding:3px 8px;cursor:pointer;font-size:12px;}
      .cdex-btn-ghost:hover{background:var(--dsw-alias-bg-layer-1,#4a4a4a);}
      .cdex-menu-backdrop{position:fixed;inset:0;z-index:10001;pointer-events:auto;}
      .cdex-menu{position:fixed;z-index:10002;background:var(--dsw-alias-bg-overlay,#252526);border:1px solid var(--dsw-alias-border-l2,#454545);border-radius:6px;padding:4px;min-width:180px;box-shadow:0 8px 24px rgba(0,0,0,.5);}
      .cdex-menu-item{display:flex;gap:8px;align-items:center;padding:7px 10px;border-radius:4px;cursor:pointer;font-size:13px;color:var(--dsw-alias-label-primary,#d4d4d4);}
      .cdex-menu-item:hover{background:var(--dsw-alias-brand-primary,#0e639c);color:#ffffff;}
      .cdex-modal{position:fixed;inset:0;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;z-index:10002;pointer-events:auto;}
      .cdex-modal-box{background:var(--dsw-alias-bg-overlay,#252526);border:1px solid var(--dsw-alias-border-l2,#454545);border-radius:8px;padding:16px;width:560px;max-width:92vw;}
      .cdex-modal-title{font-weight:600;margin-bottom:10px;color:var(--dsw-alias-label-primary,#e8e8e8);word-break:break-all;}
      .cdex-textarea2{width:100%;min-height:150px;background:var(--dsw-alias-bg-base,#1e1e1e);color:var(--dsw-alias-label-primary,#d4d4d4);border:1px solid var(--dsw-alias-border-l1,#3e3e42);border-radius:4px;padding:8px;font-family:inherit;font-size:13px;resize:vertical;box-sizing:border-box;}
      .cdex-modal-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:12px;}
      .cdex-ref{background:var(--dsw-alias-bg-layer-1,#2d2d2d);border:1px solid var(--dsw-alias-border-l1,#3e3e42);border-radius:6px;padding:8px;margin-bottom:8px;}
      .cdex-ref-head{display:flex;align-items:center;gap:6px;margin-bottom:6px;font-size:12px;}
      .cdex-ref-path{flex:1;color:var(--dsw-alias-label-secondary,#9d9d9d);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
      .cdex-ref-code{background:var(--dsw-alias-bg-base,#1e1e1e);border-radius:4px;padding:6px;font-family:Consolas,monospace;font-size:12px;white-space:pre-wrap;word-break:break-all;color:var(--dsw-alias-label-primary,#d4d4d4);max-height:140px;overflow:auto;}
      .cdex-section{color:var(--dsw-alias-label-secondary,#8a8a8a);font-size:11px;text-transform:uppercase;letter-spacing:.05em;margin:12px 0 6px;}
      .cdex-hint{color:var(--dsw-alias-label-secondary,#8a8a8a);font-size:12px;margin-top:12px;line-height:1.6;}
      .cdex-toast{position:fixed;z-index:10003;bottom:36px;left:50%;transform:translateX(-50%);background:var(--dsw-alias-brand-primary,#0e639c);color:#ffffff;padding:9px 16px;border-radius:6px;box-shadow:0 4px 16px rgba(0,0,0,.4);max-width:80vw;}
      .cdex-resize{position:absolute;right:0;bottom:0;width:18px;height:18px;cursor:nwse-resize;z-index:10;}
      .cdex-resize::after{content:'';position:absolute;right:4px;bottom:4px;width:8px;height:8px;border-right:2px solid var(--dsw-alias-label-secondary,#7f849c);border-bottom:2px solid var(--dsw-alias-label-secondary,#7f849c);}
      .cdex-aiinput-wrap{position:relative;padding:10px 14px 16px;background:transparent;border-top:1px solid var(--dsw-alias-border-l1,#3e3e42);}
      .cdex-aiinput-card{background:var(--dsw-alias-bg-overlay,#252526);border:1px solid var(--dsw-alias-border-l1,#3e3e42);border-radius:14px;box-shadow:0 2px 12px rgba(0,0,0,.18);overflow:hidden;}
      .cdex-aiinput-tags{display:flex;flex-wrap:wrap;gap:6px;padding:10px 12px 0;}
      .cdex-aiinput-tag{display:inline-flex;align-items:center;gap:6px;background:var(--dsw-alias-brand-primary,#0e639c);color:#ffffff;border-radius:12px;padding:3px 10px 3px 12px;font-size:12px;}
      .cdex-aiinput-tag-label{white-space:nowrap;}
      .cdex-aiinput-tag-tr{background:#b45309;color:#fff;}
      .cdex-aiinput-tag-x{border:none;background:transparent;color:#ffffff;cursor:pointer;font-size:13px;padding:0;line-height:1;opacity:.85;}
      .cdex-aiinput-tag-x:hover{opacity:1;}
      .cdex-aiinput{display:flex;gap:10px;align-items:flex-end;padding:10px 12px 12px;}
      .cdex-aiinput-ta{flex:1;background:transparent;color:var(--dsw-alias-label-primary,#d4d4d4);border:none;outline:none;resize:none;font-family:inherit;font-size:13px;line-height:1.55;min-height:40px;max-height:160px;padding:4px 2px;}
      .cdex-aiinput-ta::placeholder{color:var(--dsw-alias-label-secondary,#8a8a8a);}
      .cdex-aiinput-ta:disabled{opacity:.55;}
      .cdex-aiinput-send{flex:0 0 auto;height:36px;min-width:76px;border:none;background:var(--dsw-alias-brand-primary,#0e639c);color:#ffffff;border-radius:999px;padding:0 18px;cursor:pointer;font-size:13px;font-weight:600;transition:filter .15s ease, opacity .15s ease;}
      .cdex-aiinput-send.ghosted{opacity:.4;cursor:not-allowed;}
      .cdex-aiinput-warn{margin:10px 12px 0;padding:6px 10px;border-radius:8px;background:rgba(230,162,60,.12);border:1px solid rgba(230,162,60,.4);color:#e6a23c;font-size:12px;line-height:1.5;}
      .cdex-aiinput-send:hover:not(:disabled){filter:brightness(1.12);}
      .cdex-aiinput-send:disabled{opacity:.4;cursor:not-allowed;}
      .cdex-aiinput-foot{display:flex;align-items:center;gap:12px;padding:8px 14px 12px;color:var(--dsw-alias-label-secondary,#8a8a8a);font-size:12px;border-top:1px solid transparent;}
      .cdex-fp-bar{display:flex;gap:6px;margin-bottom:10px;align-items:center;}
      .cdex-fp-input{flex:1;box-sizing:border-box;background:var(--dsw-alias-bg-base,#1e1e1e);color:var(--dsw-alias-label-primary,#d4d4d4);border:1px solid var(--dsw-alias-border-l1,#3e3e42);border-radius:6px;padding:8px 10px;font-family:inherit;font-size:13px;outline:none;}
      .cdex-fp-list{max-height:420px;overflow:auto;}
      .cdex-fp-item{display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:4px;cursor:pointer;}
      .cdex-fp-item:hover{background:var(--dsw-alias-bg-layer-1,#2a2d2e);}
      .cdex-fp-name{color:var(--dsw-alias-label-primary,#d4d4d4);font-size:13px;}
      .cdex-fp-crumbs{display:flex;align-items:center;gap:4px;flex-wrap:wrap;margin-bottom:8px;min-height:22px;}
      .cdex-fp-crumb{color:var(--dsw-alias-label-secondary,#8a8a8a);cursor:pointer;border:none;background:transparent;padding:0;font-size:12.5px;}
      .cdex-fp-crumb:hover{color:var(--dsw-alias-label-primary,#ffffff);}
      .cdex-fp-crumb-sep{color:var(--dsw-alias-label-secondary,#6f6f6f);font-size:12px;}
      .cdex-fp-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:10px;}
      .cdex-fp-hint{color:var(--dsw-alias-label-secondary,#8a8a8a);font-size:12px;margin-right:auto;align-self:center;}
      /* 插件配置卡片：样式逐条对齐宿主 PluginCard.module.css / fields.module.css（dsh-context 同源） */
      .cdx-pc-card{list-style:none;border:1px solid var(--dsw-alias-border-l2,#3e3e42);border-radius:12px;background:var(--dsw-alias-bg-layer-3,#2d2d2d);transition:border-color .16s,background .16s;}
      .cdx-pc-card:hover{border-color:var(--dsw-alias-label-dimmed,#6a6a70);}
      .cdx-pc-card-open,.cdx-pc-card-open:hover{background:var(--dsw-alias-bg-layer-2,#37373d);border-color:var(--dsw-alias-label-dimmed,#6a6a70);}
      .cdx-pc-header{width:100%;appearance:none;border:0;background:none;font:inherit;color:inherit;text-align:left;cursor:pointer;display:flex;align-items:center;gap:12px;padding:14px 16px;border-radius:12px;}
      .cdx-pc-header:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#4c6ef5);outline-offset:-2px;}
      .cdx-pc-headtext{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px;}
      .cdx-pc-name{font-size:15px;font-weight:600;line-height:1.4;color:var(--dsw-alias-label-primary,#d4d4d4);}
      .cdx-pc-desc{font-size:13px;line-height:1.5;color:var(--dsw-alias-label-tertiary,#9d9d9d);}
      .cdx-pc-badge{flex:none;border-radius:999px;padding:1px 8px;font-size:11px;line-height:17px;font-weight:500;white-space:nowrap;background:var(--dsw-alias-bg-module-platform,#3a3a41);color:var(--dsw-alias-label-secondary,#9d9d9d);}
      .cdx-pc-chevron{flex:none;color:var(--dsw-alias-label-tertiary,#888);transition:transform .16s;display:inline-flex;}
      .cdx-pc-chevron-open{transform:rotate(180deg);}
      .cdx-pc-body{border-top:1px solid var(--dsw-alias-border-l2,#3e3e42);margin:0 16px;padding-bottom:8px;}
      .cdx-pc-field{display:flex;flex-direction:column;gap:6px;padding:12px 0;}
      .cdx-pc-field + .cdx-pc-field{border-top:1px solid var(--dsw-alias-border-l2,#3e3e42);}
      .cdx-pc-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
      .cdx-pc-label{flex:1;min-width:0;font-size:13px;font-weight:500;line-height:1.5;color:var(--dsw-alias-label-primary,#d4d4d4);}
      .cdx-pc-note{margin:0;font-size:12px;line-height:1.5;color:var(--dsw-alias-label-tertiary,#9d9d9d);word-break:break-all;}
      .cdx-pc-ok{margin:0;font-size:12px;line-height:1.5;color:var(--dsw-alias-state-success-primary,var(--dsw-alias-label-success,#4ec9b0));word-break:break-all;}
      .cdx-pc-err{margin:0;font-size:12px;line-height:1.5;color:var(--dsw-alias-label-error,#f48771);word-break:break-all;}
      .cdx-pc-new{font-size:13px;font-weight:600;color:var(--dsw-alias-brand-primary,#4c6ef5);}
      .cdx-pc-btn{appearance:none;border:1px solid transparent;border-radius:8px;padding:5px 14px;font:inherit;font-size:13px;line-height:1.5;cursor:pointer;}
      .cdx-pc-btn-outline{border-color:var(--dsw-alias-border-l2,#3e3e42);background:none;color:var(--dsw-alias-label-secondary,#9d9d9d);}
      .cdx-pc-btn-outline:hover:not(:disabled){color:var(--dsw-alias-label-primary,#d4d4d4);border-color:var(--dsw-alias-label-dimmed,#6a6a70);}
      .cdx-pc-btn-primary{background:var(--dsw-alias-label-primary,#d4d4d4);color:var(--dsw-alias-bg-layer-3,#2d2d2d);}
      .cdx-pc-btn:disabled{opacity:.4;cursor:default;}
      .cdx-pc-btn:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#4c6ef5);outline-offset:1px;}
      .cdx-pc-input{flex:1;min-width:220px;box-sizing:border-box;height:34px;padding:0 12px;border:1px solid var(--dsw-alias-border-l2,#3e3e42);border-radius:8px;background:var(--dsw-alias-bg-layer-3,#2d2d2d);font:inherit;font-size:13px;line-height:1.5;color:var(--dsw-alias-label-primary,#d4d4d4);outline:none;}
      .cdx-pc-input:focus-visible{border-color:var(--dsw-alias-brand-primary,#4c6ef5);}
      .cdx-pc-input::placeholder{color:var(--dsw-alias-label-tertiary,#777);}
      .cdx-pc-log{margin:0;background:var(--dsw-alias-bg-layer-1,#252526);border:1px solid var(--dsw-alias-border-l1,#333);border-radius:8px;padding:10px 12px;font-family:Consolas,'Cascadia Code',Menlo,monospace;font-size:11.5px;line-height:1.5;color:var(--dsw-alias-label-secondary,#9d9d9d);max-height:160px;overflow:auto;white-space:pre-wrap;word-break:break-all;}
    `; document.head.appendChild(tag); return () => tag.remove(); })

    /* ============ §3 状态层 ============ */
    const store = {
      open: false,
      view: 'files',
      modePos: null,
      windowed: true,
      win: { x: 16, y: 16, w: Math.round(vw * 0.72), h: Math.round(vh * 0.72) },
      rootPath: null,
      nodes: {},
      tabs: [],
      activePath: null,
      buffers: {},
      savedContent: {},
      dirty: {},
      externalChanged: {},
      loadSeq: {},
      activeNotes: [],
      references: [],
      inputActions: null,
      inputDraft: '',
      inputPhase: 'plain',
      filePickerOpen: false,
      browsePath: null,
      browseEntries: [],
      ctxMenu: null,
      noteEditor: null,
      toast: null,
      error: null,
    }
    const listeners = new Set()
    function emit() { listeners.forEach((fn) => fn()) }
    function useStore() {
      const [, setTick] = React.useState(0)
      React.useEffect(() => {
        const fn = () => setTick((t) => t + 1)
        listeners.add(fn)
        return () => { listeners.delete(fn) }
      }, [])
      return store
    }

    function showToast(msg) {
      store.toast = { msg }
      emit()
      if (timer && typeof timer.timeout === 'function') {
        timer.timeout(() => { store.toast = null; emit() }, 2800)
      }
    }

    /* ============ 纯工具函数 ============ */
    function baseName(p) {
      const parts = String(p || '').split(/[\\/]/).filter(Boolean)
      return parts.length ? parts[parts.length - 1] : String(p || '')
    }
    function tagLabel(r) {
      const name = baseName(r.path)
      if (r.lineStart && r.lineEnd) {
        return name + '(' + r.lineStart + '-' + r.lineEnd + ')'
      }
      return name
    }
    function parentPath(p) {
      const s = String(p).replace(/[\\/]+$/, '')
      const idx = Math.max(s.lastIndexOf('\\'), s.lastIndexOf('/'))
      if (idx <= 0) return null
      const parent = s.slice(0, idx)
      if (/^[a-zA-Z]:$/.test(parent)) return parent + '\\'
      return parent || null
    }
    function crumbsOf(p) {
      if (!p) return []
      const sep = String(p).includes('\\') ? '\\' : '/'
      const parts = String(p).split(/[\\/]/).filter(Boolean)
      const crumbs = []
      let acc = ''
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i]
        if (i === 0 && /^[a-zA-Z]:$/.test(part)) {
          acc = part + sep
        } else {
          acc = acc + part + sep
        }
        crumbs.push({ name: part, path: acc })
      }
      return crumbs
    }
    function langOf(p) {
      const ext = String(p || '').split('.').pop().toLowerCase()
      const map = { js:'javascript', jsx:'jsx', ts:'typescript', tsx:'tsx', py:'python', rs:'rust', go:'go', java:'java', c:'c', cpp:'cpp', cc:'cpp', h:'c', hpp:'cpp', css:'css', scss:'scss', html:'html', htm:'html', json:'json', md:'markdown', yml:'yaml', yaml:'yaml', sh:'shell', bash:'shell', ps1:'powershell', txt:'text', xml:'xml', sql:'sql', toml:'toml', ini:'ini' }
      return map[ext] || 'text'
    }
    function copyText(text) {
      let done = false
      try {
        if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).catch(() => {})
          done = true
        }
      } catch (e) {}
      if (!done) {
        try {
          if (typeof document !== 'undefined') {
            const ta = document.createElement('textarea')
            ta.value = text
            ta.style.position = 'fixed'
            ta.style.opacity = '0'
            document.body.appendChild(ta)
            ta.focus(); ta.select()
            try { document.execCommand('copy') } catch (e2) {}
            document.body.removeChild(ta)
          }
        } catch (e) {}
      }
    }
    // —— 内联轻量语法高亮（自写 tokenizer，返回 HTML 字符串） ——
    function esc(s) {
      return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    }
    function span(cls, text) { return '<span class="' + cls + '">' + text + '</span>' }
    function highlight(code, lang) {
      if (!code) return ''
      const L = String(lang || '').toLowerCase()
      // 行注释前缀（按语言）
      let lineComment = '//'
      if (L === 'python' || L === 'py') lineComment = '#'
      else if (L === 'shell' || L === 'bash' || L === 'sh') lineComment = '#'
      else if (L === 'html' || L === 'xml' || L === 'css' || L === 'scss') lineComment = null
      // 关键字（按语言簇）
      let keywords = /^(function|return|if|else|for|while|const|let|var|new|class|extends|import|export|from|async|await|try|catch|throw|switch|case|break|continue|typeof|instanceof|this|true|false|null|undefined|interface|type|enum|declare|readonly|default|in|of|yield|do|void|static|public|private|protected|using|as|is|super|delete|void)$/
      if (L === 'python' || L === 'py') keywords = /^(def|return|if|elif|else|for|while|import|from|as|class|try|except|finally|raise|with|lambda|pass|break|continue|and|or|not|in|is|True|False|None|global|nonlocal|yield|assert|del|async|await)$/
      if (L === 'json') keywords = /^(true|false|null)$/
      const out = []
      let i = 0
      const n = code.length
      while (i < n) {
        const ch = code[i]
        // 行注释
        if (lineComment && code.startsWith(lineComment, i)) {
          let j = code.indexOf('\n', i)
          if (j < 0) j = n
          out.push(span('cdx-tk-com', esc(code.slice(i, j))))
          i = j
          continue
        }
        // 块注释
        if (code.startsWith('/*', i)) {
          let j = code.indexOf('*/', i)
          j = j < 0 ? n : j + 2
          out.push(span('cdx-tk-com', esc(code.slice(i, j))))
          i = j
          continue
        }
        // 字符串（单引号 / 双引号 / 反引号）
        if ((ch === '"' || ch === '\'' || ch === '`')) {
          const quote = ch
          let j = i + 1
          while (j < n && code[j] !== quote) {
            if (code[j] === '\\') j++
            j++
          }
          if (j < n) j++
          out.push(span('cdx-tk-str', esc(code.slice(i, j))))
          i = j
          continue
        }
        // 数字
        if ((ch >= '0' && ch <= '9') || (ch === '.' && i + 1 < n && code[i + 1] >= '0' && code[i + 1] <= '9')) {
          let j = i
          while (j < n && /[0-9a-fA-FxXbBoO_eE.\-]/.test(code[j])) j++
          out.push(span('cdx-tk-num', esc(code.slice(i, j))))
          i = j
          continue
        }
        // HTML/XML 标签
        if ((L === 'html' || L === 'xml') && ch === '<') {
          if (code.startsWith('<!--', i)) {
            let j = code.indexOf('-->', i)
            j = j < 0 ? n : j + 3
            out.push(span('cdx-tk-com', esc(code.slice(i, j))))
            i = j
            continue
          }
          let j = i + 1
          const isClose = code[j] === '/'
          if (isClose) j++
          let tagName = ''
          while (j < n && /[a-zA-Z0-9-]/.test(code[j])) { tagName += code[j]; j++ }
          if (!tagName) { out.push(esc('<', ch + code.slice(i + 1, Math.min(i + 2, n)))); i++; continue }
          out.push('<span class="cdx-tk-punc">&lt;</span>' + (isClose ? '<span class="cdx-tk-punc">/</span>' : '') + span('cdx-tk-tag', tagName))
          // 遍历属性直到闭合
          while (j < n && code[j] !== '>' && !(code[j] === '/')) {
            if (/\s/.test(code[j])) { out.push(esc(code[j])); j++; continue }
            let ks = j
            while (j < n && code[j] !== '=' && !/\s/.test(code[j]) && code[j] !== '>' && code[j] !== '/') j++
            const key = code.slice(ks, j)
            if (key) out.push(span('cdx-tk-attr', key))
            // 跳过 = "值"
            if (code[j] === '=') {
              out.push(esc('='))
              j++
              if (code[j] === '"' || code[j] === '\'') {
                const q = code[j]; let e = j + 1
                while (e < n && code[e] !== q) { if (code[e] === '\\') e++; e++ }
                if (e < n) e++
                out.push(span('cdx-tk-str', esc(code.slice(j, e))))
                j = e
              } else {
                let e = j
                while (e < n && !/\s/.test(code[e]) && code[e] !== '>' && code[e] !== '/') e++
                out.push(span('cdx-tk-str', esc(code.slice(j, e))))
                j = e
              }
            }
          }
          if (code[j] === '/') { out.push(span('cdx-tk-punc', '/')); j++ }
          if (code[j] === '>') { out.push(span('cdx-tk-punc', '>')); j++ }
          i = j
          continue
        }
        // 标识符 / 关键字 / 函数
        if ((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_' || ch === '$') {
          let j = i
          while (j < n && /[\w$]/.test(code[j])) j++
          const word = code.slice(i, j)
          let cls = 'cdx-tk-plain'
          const kws = String(keywords)
          if (keywords.test(word)) cls = 'cdx-tk-kw'
          else {
            // 函数名：后跟 (
            let k = j
            while (k < n && /\s/.test(code[k])) k++
            if (code[k] === '(') cls = 'cdx-tk-fn'
          }
          out.push(span(cls, word))
          i = j
          continue
        }
        // 其他（含 CSS 属性）
        if (L === 'css' || L === 'scss') {
          if (ch === '#') {
            // # 后跟十六进制（#fff / #1e73be）整体按数字着色；修复：原实现漏掉 i 推进导致死循环
            let j = i + 1
            while (j < n && /[0-9a-fA-F]/.test(code[j])) j++
            out.push(span('cdx-tk-num', esc(code.slice(i, j))))
            i = j
          } else {
            out.push(esc(ch))
            i++
          }
        }
        // 标点 / 普通字符
        else {
          if ('(){}[]<>=!+-*/&|;:,.?$%^~'.indexOf(ch) >= 0) out.push(span('cdx-tk-punc', esc(ch)))
          else out.push(esc(ch))
          i++
        }
      }
      return out.join('')
    }

    /* ============ §4 RPC 操作层（文件树 / 标签页 / 引用备注） ============ */
    // —— 文件浏览器 ——
    async function browseDir(path) {
      if (!path) return
      store.browsePath = path
      store.browseEntries = []
      store.error = null
      emit()
      const res = await callHost('list-dir', { path })
      if (res && res.error) { store.error = res.error; emit(); return }
      store.browseEntries = (res && res.entries) || []
      emit()
    }
    function openFilePicker() {
      store.filePickerOpen = true
      emit()
      const start = store.browsePath || store.rootPath || null
      if (start) { browseDir(start); return }
      callHost('get-root').then((r) => {
        if (r && r.root) { browseDir(r.root) }
        else { store.error = '未定位到工作区根，请在输入框粘贴目录或文件路径后回车'; emit() }
      })
    }
    function pickFile(path) {
      store.filePickerOpen = false
      emit()
      openFile(path)
    }
    async function setWorkspaceRoot(path) {
      if (!path) return
      const res = await callHost('set-root', { path })
      if (res && res.error) { showToast('设置失败：' + res.error); return }
      const newRoot = (res && res.root) ? res.root : path
      store.rootPath = newRoot
      store.nodes = {}
      store.tabs = []
      store.activePath = null
      store.buffers = {}
      store.savedContent = {}
      store.dirty = {}
      store.activeNotes = []
      store.browsePath = null
      store.browseEntries = []
      store.nodes[newRoot] = { name: baseName(newRoot), path: newRoot, isDir: true, children: [], expanded: true, loaded: false }
      store.filePickerOpen = false
      emit()
      await toggleExpand(newRoot)
      showToast('工作区根目录：' + newRoot)
    }
    // —— 文件树 ——
    async function refresh() {
      store.error = null
      if (!store.rootPath) {
        const r = await callHost('get-root')
        store.rootPath = (r && r.root) || null
        if (!store.rootPath) { store.error = '未找到工作区根目录'; emit(); return }
        store.nodes = {}
        store.nodes[store.rootPath] = { name: baseName(store.rootPath), path: store.rootPath, isDir: true, children: [], expanded: true, loaded: false }
        emit()
        await toggleExpand(store.rootPath)
      } else {
        const node = store.nodes[store.rootPath]
        if (node) { node.loaded = false; node.children = []; node.expanded = true }
        await toggleExpand(store.rootPath)
      }
    }
    async function toggleExpand(path) {
      const node = store.nodes[path]
      if (!node) return
      if (node.expanded) { node.expanded = false; emit(); return }
      node.expanded = true
      if (!node.loaded) {
        node.loading = true; emit()
        const res = await callHost('list-dir', { path })
        node.loading = false; node.loaded = true
        if (res && res.error) { store.error = res.error; emit(); return }
        const entries = (res && res.entries) || []
        node.children = entries.map((e) => { store.nodes[e.path] = e; return e.path })
        emit()
      } else { emit() }
    }
    // —— 标签页 / 编辑 / 保存 ——
    async function openFile(path) {
      const name = baseName(path)
      if (!store.tabs.some((t) => t.path === path)) {
        store.tabs.push({ path, name })
      }
      store.activePath = path
      store.error = null
      if (!(path in store.buffers)) {
        store.buffers[path] = ''
        store.savedContent[path] = ''
        store.dirty[path] = false
        emit()
        const res = await callHost('read-file', { path })
        if (res && res.error) { store.error = res.error; emit(); return }
        store.buffers[path] = res.content
        store.savedContent[path] = res.content
        store.loadSeq[path] = (store.loadSeq[path] || 0) + 1
        store.externalChanged[path] = false
        emit()
        // 通知 host 建 fs.watch：外部修改进事件队列，编辑器 1 秒内自动同步
        callHost('watch-file', { path }).then(() => {})
      } else {
        emit()
      }
      loadNotes(path)
    }
    function closeTab(path) {
      const i = store.tabs.findIndex((t) => t.path === path)
      if (i < 0) return
      store.tabs.splice(i, 1)
      if (store.activePath === path) {
        const next = store.tabs[i] || store.tabs[i - 1] || null
        store.activePath = next ? next.path : null
        if (next) { loadNotes(next.path) } else { store.activeNotes = [] }
      }
      emit()
      // 标签关闭：释放 host 端 watcher
      callHost('unwatch-file', { path }).then(() => {})
    }
    // 外部修改同步：从磁盘重读单文件（脏缓冲不被自动覆盖，只有用户点 ⚡ 或确认后才走这里）
    async function reloadFromFile(path) {
      const res = await callHost('read-file', { path })
      if (res && res.error) { showToast('读取失败：' + res.error); return }
      store.buffers[path] = res.content
      store.savedContent[path] = res.content
      store.dirty[path] = false
      store.externalChanged[path] = false
      store.loadSeq[path] = (store.loadSeq[path] || 0) + 1
      emit()
    }
    // 每秒拉一次 host 的事件队列（fs.watch 真事件；无变化时返回空数组，开销极小）
    async function drainFileEvents() {
      if (store.tabs.length === 0) return
      const res = await callHost('take-file-events')
      if (!res || res.error) return
      const events = res.events || []
      for (let i = 0; i < events.length; i++) {
        const p = events[i] && events[i].path
        if (!p || !store.tabs.some((t) => t.path === p)) continue
        if (store.dirty[p]) {
          // 有未保存的本地修改：不覆盖，标记 ⚡ 等用户决定
          if (!store.externalChanged[p]) { store.externalChanged[p] = true; emit() }
        } else {
          await reloadFromFile(p)
          showToast('已同步外部修改：' + baseName(p))
        }
      }
    }
    async function saveFile(path) {
      const p = path || store.activePath
      if (!p) return
      const content = store.buffers[p]
      const res = await callHost('write-file', { path: p, content })
      if (res && res.error) { showToast('保存失败：' + res.error); return }
      store.savedContent[p] = content
      store.dirty[p] = false
      emit()
      showToast('已保存 ' + baseName(p))
    }
    // —— 引用 / 备注 读取 ——
    async function loadNotes(path) {
      const res = await callHost('list-notes', { path })
      if (res && res.notes) { store.activeNotes = res.notes; emit() }
    }
    async function loadReferences() {
      const res = await callHost('list-references')
      if (res && res.references) { store.references = res.references; emit() }
    }

    /* ============ §5 Actions 层（右键菜单 / 选区） ============ */
    function onEditorContext(e) {
      const ta = e.target
      const start = ta.selectionStart, end = ta.selectionEnd
      if (start === end) return
      e.preventDefault()
      const full = ta.value
      const text = full.slice(start, end)
      const lineStart = full.slice(0, start).split('\n').length
      const lineEnd = full.slice(0, end).split('\n').length
      store.ctxMenu = { x: e.clientX, y: e.clientY, sel: { text, lineStart, lineEnd, path: store.activePath, language: langOf(store.activePath) } }
      emit()
    }
    function closeMenu() { store.ctxMenu = null; emit() }
    async function doCite(sel) {
      const ref = await callHost('add-reference', { path: sel.path, language: sel.language, lineStart: sel.lineStart, lineEnd: sel.lineEnd, text: sel.text, kind: 'cite' })
      if (ref && ref.reference) { store.references.push(ref.reference); emit() }
      showToast('已引用：' + baseName(sel.path))
    }
    async function doTranslate(sel) {
      const ref = await callHost('add-reference', { path: sel.path, language: sel.language, lineStart: sel.lineStart, lineEnd: sel.lineEnd, text: sel.text, kind: 'translate' })
      if (ref && ref.reference) { store.references.push(ref.reference); emit() }
      showToast('已创建翻译引用（输入框上方已加 🌐 标签）。对 AI 说「翻译我引用的内容」即可。')
    }
    function openNoteEditor(sel) {
      store.noteEditor = { path: sel.path, lineStart: sel.lineStart, lineEnd: sel.lineEnd, note: '' }
      emit()
    }
    async function pasteToNote(sel) {
      let clip = ''
      try {
        if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.readText) {
          clip = await navigator.clipboard.readText()
        }
      } catch (e) {}
      store.noteEditor = { path: sel.path, lineStart: sel.lineStart, lineEnd: sel.lineEnd, note: clip }
      emit()
      showToast(clip ? '已粘贴到备注框，点击「保存」完成。' : '无法读取剪贴板，请在备注框内按 Ctrl+V 粘贴。')
    }
    async function delReference(id) {
      await callHost('delete-reference', { id })
      store.references = store.references.filter((r) => r.id !== id)
      emit()
    }
    async function delNote(id) {
      await callHost('delete-note', { id })
      store.activeNotes = store.activeNotes.filter((n) => n.id !== id)
      emit()
    }
    // —— 引用自动附带（AI 上下文） ——
    function buildSendPayload(draft) {
      // 引用文本不再粘贴进消息（明面上不展示）：引用统一存 host 端，AI 通过 get_referenced_snippets
      // 工具读取；消息里只附一行「标签级」指针，让 AI 知道有引用可读。
      const text = draft || ''
      const citeRefs = store.references.filter((r) => r.kind === 'cite')
      const trRefs = store.references.filter((r) => r.kind === 'translate')
      const parts = []
      if (citeRefs.length > 0) parts.push(citeRefs.length + ' 段代码引用')
      if (trRefs.length > 0) parts.push(trRefs.length + ' 条翻译请求')
      if (parts.length === 0) return text
      const sep = text.trim() ? '\n\n' : ''
      return text + sep + '[Code UI] 已标记 ' + parts.join('、')
        + '（引用内容未粘贴在消息里，请调用 get_referenced_snippets 工具读取）。'
    }

    /* ============ §6 Pointer 处理层（窗口拖拽 / 缩放 / 模式条移动） ============ */
    function onBarPointerDown(e) {
      if (e.target && typeof e.target.closest === 'function' && e.target.closest('button')) return
      e.preventDefault()
      const bar = e.currentTarget
      const rect = bar.getBoundingClientRect()
      const startX = e.clientX, startY = e.clientY
      const baseX = store.modePos ? store.modePos.x : rect.left
      const baseY = store.modePos ? store.modePos.y : rect.top
      try { bar.setPointerCapture(e.pointerId) } catch (err) {}
      function move(ev) {
        store.modePos = { x: Math.max(0, baseX + (ev.clientX - startX)), y: Math.max(0, baseY + (ev.clientY - startY)) }
        emit()
      }
      function up() {
        bar.removeEventListener('pointermove', move)
        bar.removeEventListener('pointerup', up)
        bar.removeEventListener('pointercancel', up)
      }
      bar.addEventListener('pointermove', move)
      bar.addEventListener('pointerup', up)
      bar.addEventListener('pointercancel', up)
    }
    function onTopPointerDown(e) {
      if (!store.windowed) return
      if (e.target && typeof e.target.closest === 'function' && e.target.closest('button')) return
      e.preventDefault()
      const top = e.currentTarget
      const sx = store.win.x, sy = store.win.y
      const px = e.clientX, py = e.clientY
      try { top.setPointerCapture(e.pointerId) } catch (err) {}
      function move(ev) {
        store.win.x = Math.max(0, sx + (ev.clientX - px))
        store.win.y = Math.max(0, sy + (ev.clientY - py))
        emit()
      }
      function up() {
        top.removeEventListener('pointermove', move)
        top.removeEventListener('pointerup', up)
        top.removeEventListener('pointercancel', up)
      }
      top.addEventListener('pointermove', move)
      top.addEventListener('pointerup', up)
      top.addEventListener('pointercancel', up)
    }
    function onResizePointerDown(e) {
      if (!store.windowed) return
      e.preventDefault()
      const handle = e.currentTarget
      const sw = store.win.w, sh = store.win.h
      const px = e.clientX, py = e.clientY
      try { handle.setPointerCapture(e.pointerId) } catch (err) {}
      function move(ev) {
        store.win.w = Math.max(360, sw + (ev.clientX - px))
        store.win.h = Math.max(260, sh + (ev.clientY - py))
        emit()
      }
      function up() {
        handle.removeEventListener('pointermove', move)
        handle.removeEventListener('pointerup', up)
        handle.removeEventListener('pointercancel', up)
      }
      handle.addEventListener('pointermove', move)
      handle.addEventListener('pointerup', up)
      handle.addEventListener('pointercancel', up)
    }

    /* ============ §7 组件层（V.* 命名空间） ============ */
    function InputBridge(props) {
      const useInput = props.useInput
      const inputState = typeof useInput === 'function' ? useInput((s) => s) : undefined
      const inputActions = props.inputActions
      React.useEffect(() => {
        store.inputActions = inputActions || null
        if (inputState) {
          store.inputDraft = inputState.draft
          store.inputPhase = inputState.phase
        }
        emit()
      })
      return null
    }
    function AiInput() {
      const st = useStore()
      let taEl = null
      const disabled = !st.inputActions
      // 引用与翻译请求都只显示「标签」：内容不进输入框/消息正文，AI 经 get_referenced_snippets 工具读取
      const refs = st.references
      const citeCount = refs.filter((r) => r.kind === 'cite').length
      const trCount = refs.length - citeCount
      const submit = () => {
        if (!st.inputActions || !taEl) {
          // 无会话时明确告知原因，而不是无声无息
          if (!st.inputActions) showToast('请先打开一个会话再发送：在主界面新建或选择会话后，这里即可发送')
          return
        }
        const text = taEl.value
        if (!text.trim() && refs.length === 0) return
        const payload = buildSendPayload(text)
        st.inputActions.setDraft(payload)
        st.inputActions.submit()
        taEl.value = ''
      }
      return h('div', { className: 'cdex-aiinput-wrap' },
        h('div', { className: 'cdex-aiinput-card' },
          disabled ? h('div', { className: 'cdex-aiinput-warn' }, '⚠ 未打开会话：请先在主界面新建或选择一个会话，之后即可在此发送（引用标签会保留）') : null,
          refs.length > 0 ? h('div', { className: 'cdex-aiinput-tags' },
            refs.map((r) => h('span', { className: 'cdex-aiinput-tag' + (r.kind === 'translate' ? ' cdex-aiinput-tag-tr' : ''), key: r.id },
              h('span', { className: 'cdex-aiinput-tag-label' }, (r.kind === 'translate' ? '🌐 翻译 ' : '🔗 ') + tagLabel(r)),
              h('button', { className: 'cdex-aiinput-tag-x', title: r.kind === 'translate' ? '删除翻译引用' : '删除引用', onClick: () => delReference(r.id) }, '✕'),
            )),
          ) : null,
          h('div', { className: 'cdex-aiinput' },
            h('textarea', {
              className: 'cdex-aiinput-ta',
              ref: (el) => { taEl = el },
              placeholder: disabled ? '请先打开一个会话（在主界面新建或选择会话后即可发送）' : '给 AI 发消息…（Ctrl+Enter 发送）',
              disabled: disabled,
              onKeyDown: (e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                  e.preventDefault()
                  submit()
                }
              },
            }),
            // 不用 HTML disabled（收不到点击）：置灰样式 + 点击弹原因，点了就有反馈
            h('button', {
              className: 'cdex-aiinput-send' + (disabled ? ' ghosted' : ''),
              'aria-disabled': disabled,
              title: disabled ? '请先打开一个会话' : '发送（Ctrl+Enter）',
              onClick: () => {
                if (disabled) { showToast('请先打开一个会话再发送：在主界面新建或选择会话后，这里即可发送'); return }
                submit()
              },
            }, '发送'),
          ),
          h('div', { className: 'cdex-aiinput-foot' },
            h('span', null, 'Ctrl+Enter 发送'),
            h('span', null, 'Shift+Enter 换行'),
            citeCount + trCount > 0 ? h('span', null, '已引用 ' + citeCount + ' 段代码 · ' + trCount + ' 条翻译（AI 经工具读取，不占消息正文）') : null,
          ),
        ),
      )
    }
    function FilePicker() {
      const st = useStore()
      if (!st.filePickerOpen) return null
      const dirs = st.browseEntries.filter((x) => x.isDir)
      const files = st.browseEntries.filter((x) => !x.isDir)
      const crumbs = crumbsOf(st.browsePath)
      const close = () => { st.filePickerOpen = false; emit() }
      const goUp = () => { if (st.browsePath) { const p = parentPath(st.browsePath); if (p) browseDir(p) } }
      const goTo = (e) => {
        if (e.key === 'Enter') {
          const raw = e.target.value
          const p = raw && raw.trim()
          if (!p) return
          callHost('stat-path', { path: p }).then((res) => {
            if (!res || res.error) { showToast('无法访问该路径：' + ((res && res.error) || '未知错误')); return }
            if (res.isDir) { browseDir(res.path || p) }
            else if (res.isFile) { pickFile(res.path || p) }
            // 兼容回退：宿主 isDir 字段缺失但路径确实存在时，按目录尝试浏览（list-dir 对非目录会给出真实错误）
            else if (res.exists) { browseDir(p) }
            else { showToast('路径不存在或不可用：' + p) }
          })
        }
      }
      // 当前浏览到的文件夹；未浏览时回退到已识别的工作区根，保证按钮不无谓置灰
      const curDir = st.browsePath || st.rootPath
      const confirm = () => { if (curDir) setWorkspaceRoot(curDir) }
      return h('div', { className: 'cdex-modal', onClick: close },
        h('div', { className: 'cdex-modal-box', onClick: (e) => e.stopPropagation() },
          h('div', { className: 'cdex-modal-title' }, '打开文件'),
          h('div', { className: 'cdex-fp-crumbs' },
            crumbs.map((c, i) => h('span', { key: i },
              h('button', { className: 'cdex-fp-crumb', onClick: () => browseDir(c.path) }, c.name),
              i < crumbs.length - 1 ? h('span', { className: 'cdex-fp-crumb-sep' }, '›') : null,
            )),
          ),
          h('div', { className: 'cdex-fp-bar' },
            h('button', { className: 'cdex-btn-ghost', onClick: goUp, title: '上级目录' }, '↑'),
            h('input', { className: 'cdex-fp-input', defaultValue: curDir || '', placeholder: '输入绝对路径后回车跳转', onKeyDown: goTo }),
          ),
          h('div', { className: 'cdex-fp-list' },
            dirs.map((d) => h('div', { className: 'cdex-fp-item', key: d.path, onClick: () => browseDir(d.path) },
              h('span', { className: 'cdex-fp-name' }, '📁 ' + d.name),
            )),
            files.map((f) => h('div', { className: 'cdex-fp-item', key: f.path, onClick: () => pickFile(f.path) },
              h('span', { className: 'cdex-fp-name' }, '📄 ' + f.name),
            )),
            dirs.length === 0 && files.length === 0 ? h('div', { className: 'cdex-empty' }, st.error ? String(st.error) : '空目录') : null,
          ),
          h('div', { className: 'cdex-fp-actions' },
            h('span', { className: 'cdex-fp-hint' }, '浏览到目标文件夹后，点「以此文件夹为根」'),
            h('button', { className: 'cdex-btn-ghost', onClick: close }, '取消'),
            h('button', { className: 'cdex-btn', onClick: confirm, disabled: !curDir }, '以此文件夹为根'),
          ),
        ),
      )
    }
    function ModeTabs() {
      const st = useStore()
      const style = st.modePos ? { top: st.modePos.y, left: st.modePos.x } : { top: 10, left: '50%', transform: 'translateX(-50%)' }
      return h('div', { className: 'cdex-modebar', style: style, onPointerDown: onBarPointerDown },
        h('span', { className: 'cdex-mode-grip', title: '拖拽移动' }, '⠿'),
        h('button', { className: 'cdex-mode-tab' + (st.open ? ' active' : ''), onClick: () => { if (!st.open) { st.open = true; emit() } } }, 'Code UI'),
        h('button', { className: 'cdex-mode-tab' + (!st.open ? ' active' : ''), onClick: () => { if (st.open) { st.open = false; emit() } } }, '原始风格-ui'),
      )
    }
    function ActivityBar() {
      const st = useStore()
      return h('div', { className: 'cdex-activitybar' },
        h('button', { className: 'cdex-abar-btn' + (st.view === 'files' ? ' active' : ''), title: '资源管理器', onClick: () => { st.view = 'files'; emit() } }, '📁'),
        h('button', { className: 'cdex-abar-btn' + (st.view === 'refs' ? ' active' : ''), title: '引用 / 备注', onClick: () => { st.view = 'refs'; emit() } }, '📎'),
        h('div', { className: 'cdex-abar-spacer' }),
        h('button', { className: 'cdex-abar-btn', title: '帮助', onClick: () => showToast('选中代码右键可：复制 / 粘贴 / 备注 / 翻译 / 引用给 AI。Ctrl+S 保存。Ctrl+P 打开文件。') }, 'ⓘ'),
        h('button', { className: 'cdex-abar-btn', title: '退出编辑器', onClick: () => { st.open = false; emit() } }, '↩'),
      )
    }
    function TreeNode(props) {
      const st = useStore()
      const node = st.nodes[props.path]
      if (!node) return null
      const style = { paddingLeft: (6 + props.depth * 14) + 'px' }
      const cls = 'cdex-node' + (st.activePath === node.path ? ' active' : '')
      const children = node.isDir && node.expanded ? (node.children || []).map((c) => h(TreeNode, { key: c, path: c, depth: props.depth + 1 })) : null
      return h('div', null,
        h('div', { className: cls, style: style, onClick: () => { node.isDir ? toggleExpand(node.path) : openFile(node.path) } },
          node.isDir ? h('span', { className: 'cdex-arrow' }, node.expanded ? '▾' : '▸') : h('span', { className: 'cdex-arrow' }, ''),
          h('span', { className: node.isDir ? 'cdex-folder' : 'cdex-file' }, node.isDir ? '📁 ' : '📄 ', node.name),
        ),
        children,
      )
    }
    function FileTree() {
      const st = useStore()
      return h('div', { className: 'cdex-sidebar' },
        h('div', { className: 'cdex-sidebar-head' },
          h('span', { title: st.rootPath || '' }, st.rootPath ? ('资源管理器 · ' + baseName(st.rootPath)) : '资源管理器'),
          h('button', { className: 'cdex-btn-ghost', onClick: refresh, title: '刷新' }, '⟳'),
        ),
        h('div', { className: 'cdex-tree' },
          st.error ? h('div', { className: 'cdex-error' }, String(st.error)) : null,
          st.rootPath ? h(TreeNode, { path: st.rootPath, depth: 0 }) : h('div', { className: 'cdex-empty' }, '正在加载目录…'),
        ),
      )
    }
    function RefItem(r) {
      return h('div', { className: 'cdex-ref', key: r.id },
        h('div', { className: 'cdex-ref-head' },
          h('span', { className: 'cdex-ref-path' }, r.path, r.lineStart ? (' :' + r.lineStart + '-' + r.lineEnd) : ''),
          h('button', { className: 'cdex-btn-ghost', onClick: () => delReference(r.id) }, '✕'),
        ),
        h('div', { className: 'cdex-ref-code' }, r.text.slice(0, 500)),
      )
    }
    function ReferencesView() {
      const st = useStore()
      const citeList = st.references.filter((r) => r.kind === 'cite')
      const trList = st.references.filter((r) => r.kind === 'translate')
      return h('div', { className: 'cdex-sidebar' },
        h('div', { className: 'cdex-sidebar-head' }, h('span', null, '引用 / 备注')),
        h('div', { className: 'cdex-tree' },
          h('div', { className: 'cdex-section' }, '🔗 代码引用 (' + citeList.length + ')'),
          citeList.length === 0 ? h('div', { className: 'cdex-empty' }, '选中代码后右键「引用」。') : citeList.map((r) => RefItem(r)),
          h('div', { className: 'cdex-section' }, '🌐 翻译请求 (' + trList.length + ')'),
          trList.length === 0 ? h('div', { className: 'cdex-empty' }, '选中代码后右键「翻译」。') : trList.map((r) => RefItem(r)),
          h('div', { className: 'cdex-section' }, '📝 备注 (' + st.activeNotes.length + ')'),
          st.activeNotes.length === 0 ? h('div', { className: 'cdex-empty' }, '当前文件暂无备注。') : st.activeNotes.map((n) => h('div', { className: 'cdex-ref', key: n.id },
            h('div', { className: 'cdex-ref-head' },
              h('span', { className: 'cdex-ref-path' }, n.path, n.lineStart ? (' :' + n.lineStart + '-' + n.lineEnd) : ''),
              h('button', { className: 'cdex-btn-ghost', onClick: () => delNote(n.id) }, '✕'),
            ),
            h('div', { className: 'cdex-ref-code' }, n.note),
          )),
          h('div', { className: 'cdex-hint' }, '在输入框对 AI 说「读取/翻译我引用的代码」，AI 会调用 get_referenced_snippets 工具获取内容。'),
        ),
      )
    }
    let gutterEl = null
    function syncGutter(ta) {
      if (gutterEl) gutterEl.scrollTop = ta.scrollTop
    }
    function TabBar() {
      const st = useStore()
      return h('div', { className: 'cdex-tabs' },
        st.tabs.map((t) => h('div', { key: t.path, className: 'cdex-tab' + (st.activePath === t.path ? ' active' : ''), onClick: () => { st.activePath = t.path; loadNotes(t.path); emit() } },
          h('span', null, (st.externalChanged[t.path] ? '⚡' : '') + t.name + (st.dirty[t.path] ? ' ●' : '')),
          st.externalChanged[t.path] ? h('button', { className: 'cdex-tab-close', title: '文件已在磁盘上被外部修改，点击加载新内容（会覆盖本地未保存的修改）', onClick: (e) => { e.stopPropagation(); reloadFromFile(t.path) } }, '⇩') : null,
          h('button', { className: 'cdex-tab-close', onClick: (e) => { e.stopPropagation(); closeTab(t.path) } }, '✕'),
        )),
        h('div', { className: 'cdex-tab-actions' },
          h('button', { className: 'cdex-btn', title: '保存 (Ctrl+S)', onClick: () => saveFile() }, '保存'),
        ),
      )
    }
    function Editor() {
      const st = useStore()
      if (!st.activePath) {
        // 空态时显式展示当前工作区根，避免「以此文件夹为根」后误认为未切换
        return h('div', { className: 'cdex-editor' },
          h('div', { className: 'cdex-empty' },
            st.rootPath ? h('div', { className: 'cdex-empty-root' }, '当前工作区：', h('b', null, st.rootPath)) : null,
            '从左侧资源管理器打开文件，或 ',
            h('button', { className: 'cdex-btn', onClick: openFilePicker }, '📂 打开文件'),
          ),
        )
      }
      const p = st.activePath
      const content = st.buffers[p] != null ? st.buffers[p] : ''
      const lineCount = content.split('\n').length
      const gutter = []
      for (let i = 1; i <= lineCount; i++) gutter.push(String(i))
      // 高亮 HTML（overlay 下层展示）
      const html = highlight(content, langOf(p))
      // 滚动同步：把 pre 滚动到与 textarea 相同
      const syncOverlayScroll = (taEl) => {
        if (!taEl) return
        const preEl = taEl.parentNode ? taEl.parentNode.querySelector('.cdex-code-pre') : null
        const gutEl = taEl.parentNode ? taEl.parentNode.parentNode.querySelector('.cdex-gutter') : null
        if (preEl) { preEl.scrollTop = taEl.scrollTop; preEl.scrollLeft = taEl.scrollLeft }
        if (gutterEl) gutterEl.scrollTop = taEl.scrollTop
      }
      return h('div', { className: 'cdex-editor' },
        h(TabBar),
        h('div', { className: 'cdex-codearea' },
          h('div', { className: 'cdex-gutter', ref: (el) => { gutterEl = el } }, gutter.join('\n')),
          h('div', { className: 'cdex-code-layer' },
            h('pre', { className: 'cdex-code-pre', 'aria-hidden': true, dangerouslySetInnerHTML: { __html: html } }),
            h('textarea', {
              // key 拼上加载序号：内容异步读回后 key 变化触发重挂载，defaultValue 才会生效（否则编辑区空白、与高亮层脱节）
              key: p + ':' + (st.loadSeq[p] || 0),
              className: 'cdex-code-ta',
              defaultValue: content,
              spellCheck: false,
              wrap: 'off',
              onScroll: (e) => syncOverlayScroll(e.target),
              onContextMenu: onEditorContext,
              onChange: (e) => {
                store.buffers[p] = e.target.value
                store.dirty[p] = e.target.value !== store.savedContent[p]
                emit()
              },
              onKeyDown: (e) => {
                if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P')) {
                  e.preventDefault()
                  openFilePicker()
                }
                if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
                  e.preventDefault()
                  saveFile()
                }
              },
            }),
          ),
        ),
      )
    }
    function StatusBar() {
      const st = useStore()
      const p = st.activePath
      const content = p && st.buffers[p] != null ? st.buffers[p] : ''
      const lines = content ? content.split('\n').length : 0
      const dirty = p && st.dirty[p]
      return h('div', { className: 'cdex-statusbar' },
        h('span', null, p ? p : '未打开文件'),
        h('span', null, p ? langOf(p) : ''),
        h('span', null, lines ? (lines + ' 行') : ''),
        h('span', null, '引用 ' + st.references.length),
        dirty ? h('span', { className: 'cdex-dirty' }, '● 未保存') : null,
      )
    }
    function ContextMenu() {
      const st = useStore()
      const m = st.ctxMenu
      if (!m) return null
      const sel = m.sel
      const items = [
        { icon: '📋', label: '复制', act: () => { copyText(sel.text); showToast('已复制'); closeMenu() } },
        { icon: '📥', label: '粘贴到备注', act: () => { pasteToNote(sel); closeMenu() } },
        { icon: '📝', label: '添加备注', act: () => { openNoteEditor(sel); closeMenu() } },
        { icon: '🌐', label: '翻译', act: () => { doTranslate(sel); closeMenu() } },
        { icon: '🔗', label: '引用（给 AI）', act: () => { doCite(sel); closeMenu() } },
      ]
      return h('div', { className: 'cdex-menu-backdrop', onClick: closeMenu },
        h('div', { className: 'cdex-menu', style: { left: m.x, top: m.y }, onClick: (e) => e.stopPropagation() },
          items.map((it, i) => h('div', { key: i, className: 'cdex-menu-item', onClick: it.act },
            h('span', null, it.icon), h('span', null, it.label),
          )),
        ),
      )
    }
    let noteTa = null
    function NoteEditor() {
      const st = useStore()
      const ne = st.noteEditor
      if (!ne) return null
      const close = () => { st.noteEditor = null; emit() }
      const save = async () => {
        const note = noteTa ? noteTa.value : ne.note
        await callHost('add-note', { path: ne.path, lineStart: ne.lineStart, lineEnd: ne.lineEnd, note })
        close()
        loadNotes(ne.path)
        showToast('备注已保存')
      }
      const loc = ne.lineStart ? ('  (第 ' + ne.lineStart + '-' + ne.lineEnd + ' 行)') : ''
      return h('div', { className: 'cdex-modal', onClick: close },
        h('div', { className: 'cdex-modal-box', onClick: (e) => e.stopPropagation() },
          h('div', { className: 'cdex-modal-title' }, '添加备注', h('span', { style: { color: '#9d9d9d', fontWeight: 400 } }, ' — ', ne.path, loc)),
          h('textarea', { className: 'cdex-textarea2', ref: (el) => { noteTa = el }, defaultValue: ne.note, placeholder: '在此输入备注内容…' }),
          h('div', { className: 'cdex-modal-actions' },
            h('button', { className: 'cdex-btn-ghost', onClick: close }, '取消'),
            h('button', { className: 'cdex-btn', onClick: save }, '保存'),
          ),
        ),
      )
    }
    function Workbench() {
      const st = useStore()
      React.useEffect(() => {
        refresh(); loadReferences()
        // 外部修改事件轮询：每 1 秒拉一次 host 的 fs.watch 事件队列（无打开标签时 drain 内部直接跳过）
        let alive = true
        let cancel = null
        const tick = () => {
          if (!alive) return
          drainFileEvents().then(() => {
            if (!alive || !timer || typeof timer.timeout !== 'function') return
            const d = timer.timeout(tick, 1000)
            if (typeof d === 'function') cancel = d
          })
        }
        if (timer && typeof timer.timeout === 'function') {
          const d0 = timer.timeout(tick, 1000)
          if (typeof d0 === 'function') cancel = d0
        }
        return () => { alive = false; if (cancel) { try { cancel() } catch (e) {} } }
      }, [])
      if (!st.open) return null
      const style = st.windowed
        ? { left: st.win.x, top: st.win.y, width: st.win.w, height: st.win.h, borderRadius: '10px', border: '1px solid var(--dsw-alias-border-l2,#454545)', boxShadow: '0 18px 60px rgba(0,0,0,.45)' }
        : { left: 0, top: 0, width: '100vw', height: '100vh' }
      return h('div', { className: 'cdex-workbench', style: style },
        h('div', { className: 'cdex-top', onPointerDown: onTopPointerDown },
          h('span', { className: 'cdex-top-title', title: st.rootPath || '' }, st.rootPath ? ('AI 代码编辑器 - ' + baseName(st.rootPath)) : 'AI 代码编辑器'),
          h('div', { className: 'cdex-top-spacer' }),
          h('span', { className: 'cdex-top-hint' }, st.windowed ? '拖动标题栏移动 · 右下角缩放' : ''),
          h('button', { className: 'cdex-btn-ghost', title: '打开文件 (Ctrl+P)', onClick: openFilePicker }, '📂'),
          h('button', { className: 'cdex-btn-ghost', title: st.windowed ? '全屏' : '还原窗口', onClick: () => { st.windowed = !st.windowed; emit() } }, st.windowed ? '⛶' : '🗗'),
        ),
        h('div', { className: 'cdex-main' },
          h(ActivityBar),
          st.view === 'files' ? h(FileTree) : h(ReferencesView),
          h(Editor),
        ),
        h(AiInput),
        h(StatusBar),
        st.windowed ? h('div', { className: 'cdex-resize', onPointerDown: onResizePointerDown }) : null,
        st.filePickerOpen ? h(FilePicker) : null,
        st.ctxMenu ? h(ContextMenu) : null,
        st.noteEditor ? h(NoteEditor) : null,
        st.toast ? h('div', { className: 'cdex-toast' }, st.toast.msg) : null,
      )
    }

    /* ============ §8 装配与 slot 注册（受「启用开关」控制，可动态挂/卸载） ============ */
    // 开关存 host 端 settings（enabled 字段，持久化）。默认启用：
    // get-self 失败 / 字段缺失（旧 host）时绝不隐藏编辑器，只有明确 enabled===false 才不挂载。
    let unmountEditorFns = null
    function mountEditor() {
      if (unmountEditorFns) return
      const disposers = []
      disposers.push(slots.inject('conversation.session.header.actions', () => slots.register(
        { name: 'conversation.session.header.actions', id: 'cdex-input-bridge', order: 9999, label: '' },
        (props) => h(InputBridge, props),
      )))
      disposers.push(slots.inject('shell.overlay', () => {
        const d1 = slots.register(
          { name: 'shell.overlay', id: 'cdex-mode-tabs', order: 5, label: '界面模式' },
          () => h(ModeTabs, null),
        )
        const d2 = slots.register(
          { name: 'shell.overlay', id: 'cdex-workbench', order: 10, label: '代码编辑器' },
          () => h(Workbench, null),
        )
        return () => { if (d1) d1(); if (d2) d2() }
      }))
      unmountEditorFns = () => { disposers.forEach((d) => { try { d() } catch (e) {} }) }
    }
    function unmountEditor() {
      if (!unmountEditorFns) return
      try { unmountEditorFns() } catch (e) {}
      unmountEditorFns = null
    }
    // 卡片里切换开关 -> set-enabled 成功后调用：立即挂/卸载编辑器（无需刷新页面、无需重启 DSH）
    function applyEnabled(v) {
      if (v) mountEditor()
      else unmountEditor()
    }
    // 启动时先查开关再挂载（RPC 失败 = 默认启用）
    callHost('get-self').then((r) => {
      applyEnabled(!(r && !r.error && r.enabled === false))
    }).catch(() => applyEnabled(true))

    /* ---- 插件配置卡片（settings.plugin.item）：信息 + 检查更新 / 一键更新 / 本地包更新 ---- */
    function PluginConfigCard() {
      const [cardOpen, setCardOpen] = React.useState(false)
      const [self, setSelf] = React.useState(null)
      const [chk, setChk] = React.useState(null)
      const [run, setRun] = React.useState(null)
      const [localPath, setLocalPath] = React.useState('')
      const [enabling, setEnabling] = React.useState(false)
      const lastPayloadRef = React.useRef(null)
      const pollDisposeRef = React.useRef(null)

      // 编辑器开关：写 host settings 持久化；成功后立即挂/卸载编辑器 UI
      function toggleEnabled() {
        if (!self || enabling) return
        const next = self.enabled === false
        setEnabling(true)
        callHost('set-enabled', { enabled: next }).then((r) => {
          setEnabling(false)
          if (r && !r.error) {
            setSelf(Object.assign({}, self, { enabled: next }))
            applyEnabled(next)
            showToast(next ? '已启用编辑器（立即生效）' : '已禁用编辑器（立即生效）')
          } else {
            showToast('切换失败：' + ((r && r.error) || '未知错误'))
          }
        })
      }

      function stopPoll() {
        if (pollDisposeRef.current) { try { pollDisposeRef.current() } catch (e) {} pollDisposeRef.current = null }
      }
      React.useEffect(() => stopPoll, [])
      React.useEffect(() => {
        if (!cardOpen) return
        if (!self) callHost('get-self').then((r) => { if (r && !r.error) setSelf(r) })
        if (!chk) doCheck()
      }, [cardOpen])

      function doCheck() {
        setChk({ checking: true })
        callHost('check-update').then((r) => {
          setChk(r && !r.error ? r : { error: (r && r.error) || '检查失败，host 端可能仍是旧版本（需重启 DSH）' })
        })
      }

      function startUpdate(payload) {
        lastPayloadRef.current = payload
        setRun({ active: true, done: false, phase: 'starting', lines: [] })
        callHost('perform-update', payload).then((r) => {
          if (!r || r.error) {
            setRun({ active: false, done: true, ok: false, error: (r && r.error) || '无法启动更新', hint: r && r.error && /未知端点/.test(r.error) ? 'host 端仍是旧版本：请先重启 DSH 再使用更新功能' : '', lines: [] })
            return
          }
          pollProgress()
        })
      }
      function pollProgress() {
        callHost('get-update-progress').then((r) => {
          if (!r || r.error) return
          setRun(r)
          if (r.active) {
            if (timer && typeof timer.timeout === 'function') {
              stopPoll()
              const d = timer.timeout(pollProgress, 900)
              pollDisposeRef.current = (typeof d === 'function') ? d : null
            }
          } else {
            stopPoll()
          }
        })
      }

      const cur = (self && self.version) || (chk && chk.current) || '?'
      const started = !!(run && !run.done)
      let checkLine = null
      if (chk && chk.checking) checkLine = h('p', { className: 'cdx-pc-note' }, '检查中…')
      else if (chk && chk.error) checkLine = h('p', { className: 'cdx-pc-err' }, chk.error)
      else if (chk && chk.notPublished) checkLine = h('p', { className: 'cdx-pc-note' }, '尚未发布到 npm（registry 404）。发布后可在线检查更新；当前可用下方「本地包更新」。')
      else if (chk && chk.updateAvailable) checkLine = h('p', { className: 'cdx-pc-note' }, '有新版本可用，见下方。')
      else if (chk && chk.latest) checkLine = h('p', { className: 'cdx-pc-ok' }, '✓ 已是最新（v' + chk.current + '）')

      // 结构与样式逐条对齐宿主 PluginCard：li + 头部按钮(名称/描述两行 + 徽章 + 旋转 chevron) + body(上边框、左右 16px 缩进)
      return h('li', { className: 'cdx-pc-card' + (cardOpen ? ' cdx-pc-card-open' : '') },
        h('button', {
          type: 'button',
          className: 'cdx-pc-header',
          'aria-expanded': cardOpen,
          'aria-label': (cardOpen ? '收起' : '展开') + ': dsh-code-ui',
          onClick: () => setCardOpen(!cardOpen),
        },
          h('span', { className: 'cdx-pc-headtext' },
            h('span', { className: 'cdx-pc-name' }, 'dsh-code-ui'),
            h('span', { className: 'cdx-pc-desc' }, 'Cursor 风格 AI 代码编辑器插件：文件树、多标签、语法高亮、引用/翻译给 AI'),
          ),
          cur !== '?' ? h('span', { className: 'cdx-pc-badge' }, 'v' + cur) : null,
          IconChevronDown
            ? h(IconChevronDown, { className: 'cdx-pc-chevron' + (cardOpen ? ' cdx-pc-chevron-open' : '') })
            : h('span', { className: 'cdx-pc-chevron' + (cardOpen ? ' cdx-pc-chevron-open' : '') }, '▾'),
        ),
        cardOpen ? h('div', { className: 'cdx-pc-body' },
          // 字段零：编辑器启用开关
          h('div', { className: 'cdx-pc-field' },
            h('div', { className: 'cdx-pc-head' },
              h('span', { className: 'cdx-pc-label' }, '编辑器开关（页面入口 + 编辑器整体）'),
              h('button', {
                type: 'button',
                className: 'cdx-pc-btn ' + (self && self.enabled !== false ? 'cdx-pc-btn-outline' : 'cdx-pc-btn-primary'),
                disabled: !self || enabling,
                onClick: toggleEnabled,
              }, enabling ? '切换中…' : (self && self.enabled !== false ? '已启用 · 点击禁用' : '已禁用 · 点击启用')),
            ),
            h('p', { className: 'cdx-pc-note' }, '切换立即生效（实时挂载/卸载编辑器），无需重启 DSH，也无需刷新页面；若个别界面未跟着变化，普通刷新（F5）即可。开关状态持久化保存。'),
          ),
          // 字段一：在线检查更新
          h('div', { className: 'cdx-pc-field' },
            h('div', { className: 'cdx-pc-head' },
              h('span', { className: 'cdx-pc-label' }, '在线检查更新'),
              h('button', { type: 'button', className: 'cdx-pc-btn cdx-pc-btn-outline', disabled: !!(chk && chk.checking) || started, onClick: doCheck }, '检查更新'),
            ),
            checkLine,
          ),
          // 字段二：一键更新（有新版本时）
          chk && chk.updateAvailable ? h('div', { className: 'cdx-pc-field' },
            h('div', { className: 'cdx-pc-head' },
              h('span', { className: 'cdx-pc-label' }, h('span', { className: 'cdx-pc-new' }, '🆕 有新版本：v' + chk.current + ' -> v' + chk.latest)),
              h('button', { type: 'button', className: 'cdx-pc-btn cdx-pc-btn-primary', disabled: started, onClick: () => startUpdate({ source: 'registry', version: chk.latest }) }, '一键更新到 v' + chk.latest),
            ),
          ) : null,
          // 字段三：本地包更新
          h('div', { className: 'cdx-pc-field' },
            h('div', { className: 'cdx-pc-head' },
              h('span', { className: 'cdx-pc-label' }, '本地包更新（开发期 / 未发布时）'),
              h('button', { type: 'button', className: 'cdx-pc-btn cdx-pc-btn-outline', disabled: started || !localPath.trim(), onClick: () => startUpdate({ source: 'local', path: localPath.trim() }) }, '安装本地包'),
            ),
            h('div', { className: 'cdx-pc-head' },
              h('input', {
                className: 'cdx-pc-input',
                placeholder: 'D:\\...\\dsh-code-ui-1.1.2.tgz（npm pack 产出的 .tgz 绝对路径）',
                value: localPath,
                onChange: (e) => setLocalPath(e.target.value),
                onKeyDown: (e) => { if (e.key === 'Enter' && localPath.trim() && !started) startUpdate({ source: 'local', path: localPath.trim() }) },
              }),
            ),
            h('p', { className: 'cdx-pc-note' }, '安装走 profile 的 pnpm（与在线更新同一通道），完成后需重启 DSH 生效。'),
          ),
          // 进度与结果
          run && ((run.lines || []).length || run.active) ? h('div', { className: 'cdx-pc-field' },
            h('p', { className: 'cdx-pc-note' }, run.active ? '更新进行中…（pnpm 安装，可能需要几十秒）' : '安装输出：'),
            h('div', { className: 'cdx-pc-log' }, ((run.lines || []).slice(-14).join('\n')) || '正在启动 pnpm…'),
          ) : null,
          run && run.done && run.ok ? h('div', { className: 'cdx-pc-field' },
            h('p', { className: 'cdx-pc-ok' }, '✓ 更新完成：v' + (run.beforeVersion || '?') + ' -> v' + (run.afterVersion || '?') + '，重启 DSH 后生效'),
          ) : null,
          run && run.done && !run.ok ? h('div', { className: 'cdx-pc-field' },
            h('p', { className: 'cdx-pc-err' }, '✗ 更新失败：' + (run.error || '未知错误')),
            run.hint ? h('p', { className: 'cdx-pc-note' }, run.hint) : null,
            h('div', { className: 'cdx-pc-head' },
              h('span', { className: 'cdx-pc-label' }),
              h('button', { type: 'button', className: 'cdx-pc-btn cdx-pc-btn-primary', onClick: () => { if (lastPayloadRef.current) startUpdate(lastPayloadRef.current) } }, '重试'),
            ),
          ) : null,
          // 底部信息
          h('div', { className: 'cdx-pc-field' },
            self && self.profileRoot ? h('p', { className: 'cdx-pc-note' }, 'profile：' + self.profileRoot + ' · 检查源：' + (self.updateRegistry || 'https://registry.npmjs.org')) : null,
            h('p', { className: 'cdx-pc-note' }, '接口：connection.rpc /dsh-code-ui；编辑器入口：页面顶部 Code UI；选中代码右键可复制/备注/翻译/引用给 AI。'),
          ),
        ) : null,
      )
    }
    // 注册到「插件配置」列表（settings.plugin.item，key = dsh-code-ui）。嵌套 inject settingsScope，
    // 服务不存在则卡片静默不出现（照 dshmarket）。
    const cardCtx = ctx
    if (typeof cardCtx.inject === 'function') {
      cardCtx.inject(['settingsScope'], (scoped) => {
        if (!scoped || !scoped.slots) return
        scoped.slots.inject('settings.plugin.item', () => scoped.slots.register({
          name: 'settings.plugin.item',
          key: 'dsh-code-ui',
          label: 'dsh-code-ui',
        }, () => h(PluginConfigCard, null)))
      })
    }
    // --- end original apply body ---// --- end original apply body ---
    }

    exports.apply = __apply;
    exports.name = "dsh-code-ui";
    exports.inject = ["slots", "connection"];
    return module.exports;
  },
});
