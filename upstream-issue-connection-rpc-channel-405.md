# Upstream issue: every plugin RPC channel is dead — `connection.rpc.handle()` throws `cannot get property "webServer" without inject`

**Component:** `@deepseek-ai/dsh-client-connection` (`packages/client/connection`)
**Version observed:** `0.1.5-rc.2` (checkout `D:\my\deepseek-ai\deepseek-harness`, run via `pnpm dsh web`)
**Severity:** breaks every third-party plugin that uses the documented generic RPC channel API; silent (HTTP 405, no host-side error surfaced to the browser)

## Summary

`connection.rpc.handle(channel, handler)` cannot mount its route. `register()` in
`packages/client/connection/src/rpc-host.ts` mounts the prefix route with a bare
property access on the **service's own** context:

```ts
return owner.effect(
  () => owner.webServer.register(route),
  `client-connection: ${channel} rpc channel`,
)
```

where `owner` is `this.ctx` — the context captured by
`new HostConnectionService(ctx, …)` in `apply()` (`src/index.ts`), i.e. the
**connection plugin's own** context, whose injection list is only
`export const inject = ['credentials']`. Cordis' guard therefore rejects the
property read:

```
[dsh-code-ui] 带 options 注册 RPC 通道失败，回退无 options 注册：cannot get property "webServer" without inject
[dsh-code-ui] RPC 通道注册失败——客户端所有调用将 405：cannot get property "webServer" without inject
```

`owner.webServer` throws for **every caller**, so no plugin channel is ever
registered. The route's requests fall through to the frontend-static fallback,
which answers non-GET/HEAD with **405** (`docs/subsystems/web-server.md`):

```
transport failure for /dsh-code-ui/get-root: HTTP 405
```

## Impact

- Every `connection.rpc.handle(channel, …)` user loses all its endpoints at once
  (file trees, plugin updaters, dashboards …). Verified with two independent
  plugins in the same session: `dsh-code-ui` **and** `dsh-context` both 405.
- The plugin looks "half alive": its model **tools** still work (they register via
  `ctx.inject(['tools'])`), only RPC is dead — which makes it easy to misdiagnose
  as a client-side/caching problem.
- Plugin-side workarounds are impossible: see below.

## Not the cause

- Not the caller's injection list. Adding `webServer` to the caller plugin's
  `export const inject` does **not** help (the guard fires on the connection
  plugin's context, not the caller's) — verified by experiment.
- Not the optional third argument. `handle(channel, handler, { authority: 'loopback' })`
  and `handle(channel, handler)` fail identically.
- Not npm/network. `405` is local transport.

## Experiment that isolates it

| Attempt | Result |
|---|---|
| caller plugin `ctx.inject(['connection'])` | `cannot get property "webServer" without inject` |
| caller plugin `ctx.inject(['connection', 'webServer'])` | same error (guard is not on the caller fiber) |
| `owner.inject(['webServer'], webCtx => webCtx.effect(() => webCtx.webServer.register(route)))` inside `register()` | **no error, but the route is still not mounted** (requests keep 405) |
| mount through **the webServer scope created in the connection plugin's own `apply()`** (same scope as the working `/api` route) | ✅ works |

Note the `/api` route registered in `apply()` works fine because it is mounted
inside `ctx.inject(['webServer'], webCtx => webCtx.effect(() => webCtx.webServer.register(route)))` —
the same mechanism is simply not applied to channel registration.

## Proposed fix

Hand the plugin's own webServer scope to the service and mount channels through
it (identical mechanism to the `/api` route):

```ts
// src/index.ts — inside the existing ctx.inject(['webServer'], (webCtx) => { … })
webCtx.effect(() => webCtx.webServer.register(route), 'client-connection: /api route')
connection.attachWebScope(webCtx)          // ← new
```

```ts
// src/rpc-host.ts — HostConnectionService
private webScope: Context | undefined
private readonly deferredChannelMounts = new Set<() => void>()

attachWebScope(webCtx: Context): void {
  this.webScope = webCtx
  for (const mount of Array.from(this.deferredChannelMounts)) mount()
}

private register(owner: Context, channel: string, handler: ConnectionRpcHandler): () => Promise<void> {
  // …build `route` unchanged…
  let unmount: (() => void) | undefined
  const mount = (): void => {
    const scope = this.webScope
    if (scope === undefined || unmount !== undefined) return
    const disposer = scope.effect(
      () => scope.webServer.register(route),
      `client-connection: ${channel} rpc channel`,
    )
    unmount = () => { void disposer() }
  }
  if (this.webScope === undefined) this.deferredChannelMounts.add(mount)  // channel registered before webServer
  mount()
  const release = owner.effect(() => () => { /* remove from deferred set, unmount() */ }, `… channel owner`)
  return async () => { /* unmount + release */ }
}
```

The deferred set covers plugins that register a channel before the webServer
scope exists; the caller's effect still owns the channel's lifetime.

## Environment

- Windows; host started with `pnpm dsh web` from the checkout (tsx runs `src/`,
  `tsconfig.base.json` paths resolve workspace packages to source).
- `dsh-code-ui` (profile package, `ctx.inject(['connection'])`, plain ESM) and
  `dsh-context@0.46.0` (npm) both reproduce.
