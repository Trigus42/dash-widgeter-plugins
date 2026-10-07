/**
 * Cast receiver styles injected into the plugin sandbox (isolated realm, no host
 * CSS). The active content fills the cell; idle shows a calm centered pairing
 * card. Overlay modes tune how casting content presents within its own cell —
 * `cover` is opaque black (full takeover), `dim` darkens the backdrop, `inline`
 * is transparent so a background cast blends with widgets above it.
 */
export const CAST_SANDBOX_CSS = `
  html, body { margin: 0; height: 100%; overflow: hidden; background: transparent; }
  body { width: 100%; height: 100%; }
  .wg-plugin-root { width: 100%; height: 100%; }
  .cast-root { position: relative; width: 100%; height: 100%; overflow: hidden;
    font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; color: #fff; }
  .cast-active[data-overlay='cover'] { background: #000; }
  .cast-active[data-overlay='dim'] { background: rgba(0,0,0,0.6); }
  .cast-active[data-overlay='inline'] { background: transparent; }
  .cast-frame, .cast-media { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }
  .cast-media { object-fit: contain; background: #000; }
  .cast-idle-blank { background: transparent; }
  .cast-idle { display: grid; place-items: center; background: radial-gradient(120% 120% at 50% 0, #1b2b40, #0b1420 70%); }
  .cast-idle-card { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 24px 28px; text-align: center; }
  .cast-idle-title { font-size: clamp(16px, 3cqw, 26px); font-weight: 600; }
  .cast-idle-hint { margin: 0; max-width: 32ch; font-size: clamp(12px, 1.8cqw, 15px); font-weight: 300; opacity: 0.78; line-height: 1.4; }
  .cast-pairing { display: flex; flex-direction: column; align-items: center; gap: 4px; margin-top: 6px; padding: 12px 20px; border-radius: 14px; background: rgba(255,255,255,0.08); }
  .cast-pairing-label { font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; opacity: 0.6; }
  .cast-pairing-code { font-size: clamp(26px, 6cqw, 48px); font-weight: 700; letter-spacing: 0.18em; font-variant-numeric: tabular-nums; }
`;
