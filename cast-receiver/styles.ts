export const CAST_SANDBOX_CSS = `
  html, body { margin: 0; height: 100%; overflow: hidden; background: transparent; color: #fff; }
  body, button { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; }
  .wg-plugin-root, .cast-root, .cast-pairing-root { width: 100%; height: 100%; }
  .cast-pairing-root { display: flex; justify-content: flex-end; align-items: flex-start; container-type: size; }
  .cast-root { position: relative; overflow: hidden; }
  .cast-empty { background: transparent; pointer-events: none; }
  .cast-active[data-overlay='cover'] { background: #000; }
  .cast-active[data-overlay='dim'] { background: rgba(0,0,0,0.6); }
  .cast-active[data-overlay='inline'] { background: transparent; }
  .cast-audio-only .cast-media { opacity: 0; pointer-events: none; }
  .cast-media { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; object-fit: contain; background: #000; }
  .cast-pairing-button { position: relative; width: 100%; height: 100%; min-width: 0; min-height: 0; display: block; padding: 0; border: 0; border-radius: 8px; color: inherit; background: transparent; cursor: pointer; box-sizing: border-box; opacity: 1; transition: background .15s ease; }
  .cast-pairing-button:hover:not(:disabled), .cast-pairing-button:focus-visible { background: rgba(255,255,255,.08); }
  .cast-pairing-button:disabled { opacity: .45; cursor: default; }
  .cast-pairing-button:focus-visible { outline: 2px solid currentColor; outline-offset: -3px; }
  .cast-pairing-button svg { position: absolute; inset-block-start: 8%; inset-inline-end: 8%; width: 32%; height: 32%; fill: currentColor; }
  .cast-pairing-status { position: absolute; inset-block-start: 5%; inset-inline-end: 5%; width: 7%; aspect-ratio: 1; border: 1px solid currentColor; border-radius: 50%; background: #9ca3af; }
  .cast-pairing-status-connected { background: #22c55e; }
`;