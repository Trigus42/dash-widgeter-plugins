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
  .cast-pairing-button { width: 100%; height: 100%; min-width: 48px; min-height: 48px; display: grid; grid-template-columns: 24px minmax(0,1fr) auto; align-items: center; gap: 8px; padding: 8px 12px; border: 0; border-radius: inherit; color: inherit; background: transparent; cursor: pointer; font-size: 16px; text-align: left; }
  .cast-pairing-button:disabled { opacity: .45; cursor: default; }
  .cast-pairing-button:focus-visible { outline: 2px solid currentColor; outline-offset: -3px; }
  .cast-pairing-button span { min-width: 0; overflow-wrap: anywhere; }
  .cast-pairing-button svg { width: 24px; height: 24px; fill: currentColor; }
  .cast-pairing-button strong { font-size: 14px; }
`;