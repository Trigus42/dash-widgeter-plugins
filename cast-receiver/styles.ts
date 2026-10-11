export const CAST_SANDBOX_CSS = `
  html, body { margin: 0; height: 100%; overflow: hidden; background: transparent; color: #fff; }
  body, button { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; }
  .wg-plugin-root, .cast-root, .cast-pairing-root { width: 100%; height: 100%; }
  .cast-root { position: relative; overflow: hidden; }
  .cast-empty { background: transparent; pointer-events: none; }
  .cast-active[data-overlay='cover'] { background: #000; }
  .cast-active[data-overlay='dim'] { background: rgba(0,0,0,0.6); }
  .cast-active[data-overlay='inline'] { background: transparent; }
  .cast-media { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; object-fit: contain; background: #000; }
  .cast-pairing-root { display: grid; place-items: center; }
  .cast-pairing-card { width: 100%; height: 100%; border: 0; border-radius: inherit; padding: 14px; color: inherit; background: transparent; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 5px; cursor: pointer; }
  .cast-pairing-card:disabled { cursor: default; }
  .cast-idle-title { font-size: clamp(13px, 2.8cqw, 22px); font-weight: 600; }
  .cast-pairing-label { font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase; opacity: 0.62; }
  .cast-pairing-code { font-size: clamp(24px, 7cqw, 44px); font-weight: 700; letter-spacing: 0.14em; font-variant-numeric: tabular-nums; }
  .cast-peer-count { font-size: 12px; opacity: 0.7; }
  .cast-dialog-backdrop { position: fixed; inset: 0; z-index: 10; display: grid; place-items: center; padding: 14px; background: rgba(0,0,0,0.72); }
  .cast-dialog { width: min(100%, 420px); max-height: calc(100% - 28px); overflow: auto; box-sizing: border-box; display: grid; justify-items: center; gap: 12px; padding: 20px; border: 1px solid rgba(255,255,255,0.16); border-radius: 14px; background: #111923; box-shadow: 0 18px 60px rgba(0,0,0,0.45); }
  .cast-dialog h2 { margin: 0; font-size: 20px; }
  .cast-dialog img { width: min(65cqw, 240px); max-width: 100%; border-radius: 8px; }
  .cast-dialog label { width: 100%; display: grid; gap: 5px; font-size: 11px; opacity: 0.75; }
  .cast-dialog output, .cast-dialog a { width: 100%; overflow-wrap: anywhere; text-align: center; color: inherit; font-size: 12px; }
  .cast-dialog button { min-height: 40px; padding: 0 18px; border: 0; border-radius: 8px; color: #fff; background: #397bc2; font-weight: 650; }
`;