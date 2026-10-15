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
5. Commit source, manifest, tests, and regenerated `dist/` together.

Never hand-edit `dist/`. The SHA-256 recorded in `index.json` is verified before
execution, so mismatched generated files are rejected.

## Plugin contract

- A plugin consists of a static `manifest.ts` security surface and a
  `sandbox.ts` module that runs in the null-origin sandbox iframe.
- Receive host services through the scoped sandbox context. Never import a
  Tauri API or host singleton from plugin code.
- Declare exact native-network origins and the correct CSP surface. WebRTC is a
  separate grant because CSP does not constrain ICE peers.
- Use `context.http` only for declared CORS compatibility or injected-only
  credentials; it is not an automatic fallback for native requests.
- Keep secrets out of config, storage, cache keys, logs, and errors.
- Use host query, status, blob, and storage APIs rather than private substitutes.
- Settings fields belong in the manifest and are rendered by the host.

The authoritative authority and storage contract is
[`../../docs/PLUGIN_AUTHORITY.md`](../../docs/PLUGIN_AUTHORITY.md).


## Config compatibility — never break existing users

A plugin's `config` is persisted user data. When you change the config shape:

- **Coerce, don't assume.** Read persisted config through a validating reader
  (see `immich/config.ts`) that falls back to defaults for unknown/removed
  values — a stale field or a dropped enum value must never throw.
- **Migrate legacy shapes** in that reader rather than forcing users to
  reconfigure (e.g. immich migrated flat `albumIds` → the tri-state
  `{ include, exclude }` filter, and dropped pool modes fall back to a default).
- **Removed remote entities are not errors.** Ids that no longer exist on the
  server (albums/people/tags) must be tolerated — send them and match nothing,
  never crash or hard-error the widget.


## License

AGPL-3.0-only, same as the host application. Any new dependency must be
license-compatible, actively maintained, ESM/tree-shakeable, and run in both a
browser and the Tauri webview.
