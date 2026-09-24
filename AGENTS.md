# AGENTS.md — dash-widgeter-plugins

Guidance for AI agents editing first-party plugins in this repo. This is a **git
submodule** of [dash-widgeter](https://github.com/Trigus42/dash-widgeter),
consumed at build time *and* registered as the default trusted plugin repo. Read
the host repo's root `AGENTS.md` too — its engineering philosophy, security
model, and code-quality rules apply here. This file only adds what is specific
to authoring/updating a plugin.

---

## The #1 pitfall: editing source is not shipping

**Editing a plugin's `.ts` files changes nothing that a user installs.** The app
installs a plugin by fetching a **pre-built bundle** from this repo's committed
`dist/` over the network (`raw.githubusercontent.com/.../dist/<id>.js` +
`dist/index.json`). Source edits only ship after you regenerate and commit
`dist/`.

Symptom when you forget: "I reinstalled the plugin and still see the old
version." The reinstall pulled the stale committed `dist/` bytes.

### Required workflow to update a plugin

Do **all** of these, in order — skipping any one ships nothing or ships a broken
half:

1. **Edit the source** under `<plugin>/` (widgets, logic, `manifest.ts`, tests).
2. **Bump `version`** in `<plugin>/manifest.ts` (semver). A behavior change with
   no version bump is invisible and un-updatable — this is not optional.
3. **Verify** from the *host app repo* (this repo has no toolchain of its own):
   ```
   bun run tsc --noEmit
   bun run eslint <files>
   bunx vitest run src/plugins/<plugin>
   ```
4. **Regenerate `dist/`** from the host app repo:
   ```
   bun run build:plugins
   ```
   This rewrites `dist/index.json` (new per-bundle SHA-256) and `dist/<id>.js`.
5. **Commit in this submodule** (source + `manifest.ts` + `dist/`) and push to
   `main` — the remote raw URL on `main` is exactly what reinstall fetches.
6. **Advance the submodule pointer in the host repo**: `git add src/plugins`,
   commit, push. Otherwise the shipped app still tracks the old plugin commit.
7. **On the device**: bundles are keyed by plugin id (not version), so a fresh
   copy needs **Refresh repo → Uninstall → Install** (or clear the
   `pluginBundles` IndexedDB entry). Refresh first so the new `index.json`/hash
   is fetched.

### Notes / gotchas

- `dist/` **is committed** (tracked), despite the README's "git-ignored" line —
  that line is wrong; the published bytes must be in git for the raw URL to
  serve them. Never hand-edit `dist/`; only `build:plugins` writes it.
- `build:plugins` rebuilds **every** plugin, so `dist/*.js` for untouched
  plugins may change bytes (fresh esbuild run). The index's SHA-256s stay
  self-consistent, so integrity still passes — this is expected; commit them.
- The bundle's SHA-256 in `index.json` is verified before execution. A `dist/`
  that is out of sync with its `index.json` hash will be **refused at install**,
  not silently run. Always regenerate both together via the script.

---

## Plugin contract (do not break the boundary)

- A plugin is `manifest.ts` (static `PluginManifest`, the entire security
  surface) + `sandbox.ts` (`definePlugin({...})`, the code that runs in the
  **null-origin sandbox iframe**). See an existing plugin (`clock/`) for the
  canonical shape.
- **Never import `@tauri-apps/api` or any host singleton.** Plugins receive all
  capabilities through the injected sandbox context (`context.http`,
  `context.cacheGet/cachePut`, `useWidgetData`, `context.log`, etc.). Reaching
  around the context defeats the capability model and won't work in the frame.
- **All network goes through `context.http`**, pinned to the manifest `network`
  allowlist. Direct `fetch`/`XHR`/`WebSocket` is dead in the sandbox
  (`connect-src 'none'`). Keep `network` as narrow as the plugin truly needs.
- **Secrets never enter the frame.** Mark credential fields `secret: true`; the
  plugin references them as `{{secret:<key>}}` placeholders in request
  headers/URL, and the host substitutes at egress. Never put tokens in `config`.
- **Data fetching + caching + stale/offline** is the host's shared TanStack
  Query layer via `useWidgetData` — do not hand-roll fetch-then-cache-then-stale
  per plugin. Report offline/stale/error through the host status API, not a
  bespoke badge.
- **Settings fields** are declared in the manifest and rendered by the *host*.
  If a field needs a control the host doesn't have (e.g. the tri-state
  `multiselect3`), that control must be added to the host repo
  (`src/shell/SettingField.tsx`, `src/types/widget.ts`, shell CSS) — it cannot
  be rendered from inside the plugin.

---

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

---

## Code quality (mirrors the host repo)

- Small, single-responsibility functions; intent-revealing names; guard clauses
  over nesting; comments explain *why*, not *what*.
- Keep UI components thin; put logic in pure, testable functions and cover them
  with **Vitest** unit tests (the default). Extract logic specifically so it can
  be unit-tested without a DOM.
- **Regression coverage:** when you fix a bug, add the cheapest test that would
  have caught it (a unit test if the root cause is expressible in logic).
- Strict TypeScript, no `any`/`unknown` in props or logic. Never use `eval`,
  `new Function`, `innerHTML`/`dangerouslySetInnerHTML` with unescaped input.
- Bundle assets locally; never reference external CDNs or remote fonts/scripts.

---

## License

AGPL-3.0-only, same as the host application. Any new dependency must be
license-compatible, actively maintained, ESM/tree-shakeable, and run in both a
browser and the Tauri webview.
