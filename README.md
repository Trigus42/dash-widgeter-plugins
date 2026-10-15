# First-party plugins

This directory contains dash-widgeter's built-in plugins: clock, weather,
calendar, Immich, WebDAV Photos, Google Photos, and Cast Receiver. Their source
is part of the main repository and is built against the host sandbox SDK.

## Layout

```text
plugins.json          Canonical plugin id and source-directory list
<plugin>/manifest.ts  Static host-side manifest and authority declarations
<plugin>/sandbox.ts   Entry point for the opaque-origin sandbox iframe
<plugin>/*            Components, logic, styles, locales, and unit tests
dist/                 Generated repository index and content-addressed bundles
```

## Plugin contract

Each plugin exports a static `PluginManifest` from `manifest.ts` and a
`PluginModule` from `sandbox.ts`. Plugins author against `@/sandbox/sdk`,
`@/sandbox/react`, and shared host types. The host runs plugin code only in a
null-origin sandbox iframe; the manifest declares its authority.

For networking, secrets, storage, cache, and permission behavior, see
[`../../docs/PLUGIN_AUTHORITY.md`](../../docs/PLUGIN_AUTHORITY.md).

## Building

From the repository root:

```sh
bun run build:plugins
```

This recreates `dist/index.json` and content-addressed
`dist/<id>-<sha256>.js` bundles. The index contains each complete manifest,
bundle URL, and SHA-256 digest; the host verifies the digest before execution.
Do not edit generated files by hand.

## License

AGPL-3.0-only, same as the host application.
