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
  .cast-pairing-button { position: relative; width: 44px; height: 44px; min-width: 44px; min-height: 44px; display: grid; place-items: center; padding: 10px; border: 0; border-radius: 8px; color: inherit; background: transparent; cursor: pointer; }
  .cast-pairing-button:hover:not(:disabled) { background: rgba(255,255,255,.08); }
  .cast-pairing-button:disabled { opacity: .45; cursor: default; }
  .cast-pairing-button:focus-visible { outline: 2px solid currentColor; outline-offset: -3px; background: rgba(255,255,255,.08); }
  .cast-pairing-button svg { width: 24px; height: 24px; fill: currentColor; }
  .cast-pairing-status { position: absolute; inset-block-start: 7px; inset-inline-end: 7px; width: 7px; height: 7px; border: 1px solid currentColor; border-radius: 50%; background: #9ca3af; }
  .cast-pairing-status-connected { background: #22c55e; }
`;