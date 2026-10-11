export const CAST_SANDBOX_CSS = `
  html, body { margin: 0; height: 100%; overflow: hidden; background: transparent; color: #fff; }
  body, button { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; }
  .wg-plugin-root, .cast-root, .cast-pairing-root { width: 100%; height: 100%; }
  .cast-root { position: relative; overflow: hidden; }
  .cast-empty { background: transparent; pointer-events: none; }
  .cast-active[data-overlay='cover'] { background: #000; }
  .cast-active[data-overlay='dim'] { background: rgba(0,0,0,0.6); }
  .cast-active[data-overlay='inline'] { background: transparent; }
  .cast-audio-only .cast-media { opacity: 0; pointer-events: none; }
  .cast-media { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; object-fit: contain; background: #000; }
  .cast-pairing-icon { width: 100%; height: 100%; min-width: 32px; min-height: 32px; display: grid; place-items: center; padding: 7px; border: 0; border-radius: inherit; color: inherit; background: transparent; cursor: pointer; }
  .cast-pairing-icon:disabled { opacity: .45; cursor: default; }
  .cast-pairing-icon svg { width: min(100%, 28px); height: min(100%, 28px); fill: currentColor; }
`;