/**
 * Clock widget styles, injected into the plugin sandbox (isolated realm, no host
 * CSS). Font sizes are set imperatively by the fit logic (see fit.ts), so the
 * stylesheet carries only layout, weights, and transparency.
 */
export const CLOCK_SANDBOX_CSS = `
  html, body { margin: 0; height: 100%; overflow: hidden; background: transparent; }
  body { width: 100%; height: 100%; }
  .wg-plugin-root { width: 100%; height: 100%; }
  .clock-widget {
    width: 100%; height: 100%; display: flex; flex-direction: column;
    align-items: center; justify-content: center; gap: 0.04em; padding: 2% 4%;
    box-sizing: border-box; overflow: hidden; text-align: center; color: #fff;
    font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
  }
  .clock-time {
    font-weight: 700; line-height: 0.92; letter-spacing: 0.01em;
    text-shadow: 0 2px 12px rgba(0,0,0,0.45);
    font-variant-numeric: tabular-nums; white-space: nowrap;
  }
  .clock-date {
    font-weight: 300; line-height: 1;
    color: rgba(255,255,255,0.82); text-shadow: 0 1px 6px rgba(0,0,0,0.4);
    white-space: nowrap;
  }
`;
