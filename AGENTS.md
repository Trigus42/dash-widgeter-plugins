# First-party plugin guidance

Read the repository-root `AGENTS.md` first. This file adds only the workflow and
compatibility rules specific to plugins under `src/plugins`.

## Workflow

1. Edit the plugin source and tests.
2. Bump the plugin manifest version for a behavior or contract change.
3. Use the root scripts for checks: `bun run typecheck`, `bun run lint`, and a
   focused Vitest invocation such as `bunx vitest run src/plugins/<plugin>`.
4. Run `bun run build:plugins` when distributable plugin bytes change. It
   recreates `dist/index.json` and content-addressed
   `dist/<id>-<sha256>.js` bundles for every first-party plugin.
5. Commit source, manifest, tests, and regenerated `dist/` together in this
   submodule, then advance the `src/plugins` submodule pointer in the host
   repository so the application tracks the shipped plugin commit.

Never hand-edit `dist/`. The SHA-256 recorded in `index.json` is verified before
execution, so mismatched generated files are rejected.

## Plugin contract

- A plugin consists of a static `manifest.ts` security surface and a
  `sandbox.ts` module that runs in the null-origin sandbox iframe.
- Receive host services through the scoped sandbox context. Never import a
  Tauri API or host singleton from plugin code.
- Declare complete, exact native-network origins on the correct CSP surface.
  Never submit raw CSP, wildcard hosts, credentials, paths, queries, or
  fragments as origins. WebRTC is a separate grant because CSP does not
  constrain ICE peers.
- Use `context.http` only for declared CORS compatibility or injected-only
  credentials; it is not an automatic fallback for native requests.
- Keep secrets out of config, storage, cache keys, logs, and errors.
- Use host query, status, blob, and storage APIs rather than private substitutes.
- Settings fields belong in the manifest and are rendered by the host.

The authoritative authority and storage contract is
[`../../docs/PLUGIN_AUTHORITY.md`](../../docs/PLUGIN_AUTHORITY.md).

The following authoring guardrails remain mandatory in addition to that
authoritative contract:

- Use `useWidgetData` for server-state fetching and stale/offline state, and
  report status through the host API rather than a private badge.
- Use `context.blobs.fetch` for proxy-fetched binary assets; use
  `context.blobs.get`/`put` for native-fetched or generated blobs.
- Never use direct IndexedDB from the opaque plugin frame. Use host storage,
  choose plugin or instance scope deliberately, and stay within reviewed
  manifest quotas.
- Permission grants are scoped to the plugin capability and entry point, not
  to individual widget prompts; instance namespaces still isolate data,
  secrets, config, and status.




## License

AGPL-3.0-only, same as the host application. Any new dependency must be
license-compatible, actively maintained, ESM/tree-shakeable, and run in both a
browser and the Tauri webview.
