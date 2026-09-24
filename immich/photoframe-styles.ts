/**
 * Photo-frame styles injected into the plugin sandbox (isolated realm, no host
 * CSS). Host CSS variables are replaced with literals since they don't cross the
 * boundary: accent → #6ba7e8, dim text → rgba white, danger → #ff8080.
 */
export const IMMICH_SANDBOX_CSS = `
  html, body { margin: 0; height: 100%; overflow: hidden; background: transparent; }
  body { width: 100%; height: 100%; }
  .wg-plugin-root { width: 100%; height: 100%; }
  .immich-frame { position: relative; width: 100%; height: 100%; overflow: hidden; background: #000;
    font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; }
  .immich-panes { display: flex; width: 100%; height: 100%; }
  .immich-pane { position: relative; flex: 1 1 0; min-width: 0; overflow: hidden; container-type: size; }
  .immich-layout-split .immich-pane + .immich-pane { border-left: 2px solid rgba(255,255,255,0.12); }
  .immich-asset { position: absolute; inset: 0; overflow: hidden; }
  .immich-backdrop, .immich-photo { position: absolute; inset: 0; width: 100%; height: 100%; }
  .immich-backdrop { filter: blur(14px); transform: scale(1.1); }
  .immich-fit-cover { object-fit: cover; }
  .immich-fit-contain { object-fit: contain; }
  .immich-photo { opacity: 0; transform-origin: var(--immich-origin, center); }
  .immich-fadeonly, .immich-none { animation: immich-fade var(--immich-fade-duration, 1s) ease both; }
  .immich-none { animation-duration: 0.01s; }
  .immich-zoom { animation: immich-fade var(--immich-fade-duration,1s) ease both, immich-zoom var(--immich-motion-duration,16s) ease-out both; }
  .immich-pan { animation: immich-fade var(--immich-fade-duration,1s) ease both, immich-pan var(--immich-motion-duration,16s) ease-in-out both; }
  .immich-kenburns { animation: immich-fade var(--immich-fade-duration,1s) ease both, immich-kenburns var(--immich-motion-duration,16s) ease-in-out both; }
  @keyframes immich-fade { from { opacity: 0; } to { opacity: 1; } }
  @keyframes immich-zoom { from { transform: scale(1); } to { transform: scale(1.18); } }
  @keyframes immich-pan { from { transform: scale(1.12) translateX(2%); } to { transform: scale(1.12) translateX(-2%); } }
  @keyframes immich-kenburns { from { transform: scale(1.02); } to { transform: scale(1.2); } }
  .immich-caption { position: absolute; z-index: 5; display: flex; flex-direction: column; gap: 0.1em; max-width: 70%; padding: 14px 16px; color: #fff; text-shadow: 0 1px 6px rgba(0,0,0,0.8); pointer-events: none; }
  .immich-caption-bottom-right { right: 0; bottom: 0; align-items: flex-end; text-align: right; background: radial-gradient(120% 120% at 100% 100%, rgba(0,0,0,0.55), transparent 70%); }
  .immich-caption-bottom-left { left: 0; bottom: 0; align-items: flex-start; text-align: left; background: radial-gradient(120% 120% at 0 100%, rgba(0,0,0,0.55), transparent 70%); }
  .immich-caption-top-right { right: 0; top: 0; align-items: flex-end; text-align: right; background: radial-gradient(120% 120% at 100% 0, rgba(0,0,0,0.55), transparent 70%); }
  .immich-caption-top-left { left: 0; top: 0; align-items: flex-start; text-align: left; background: radial-gradient(120% 120% at 0 0, rgba(0,0,0,0.55), transparent 70%); }
  .immich-caption-primary { font-size: clamp(15px, 2.4cqw, 26px); font-weight: 600; line-height: 1.15; }
  .immich-caption-secondary { font-size: clamp(12px, 1.6cqw, 18px); font-weight: 300; opacity: 0.92; }
  .immich-caption-desc { font-size: clamp(11px, 1.4cqw, 16px); font-weight: 300; opacity: 0.8; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
  .immich-progress { position: absolute; left: 0; right: 0; height: 3px; z-index: 6; background: rgba(255,255,255,0.15); }
  .immich-progress-top { top: 0; }
  .immich-progress-bottom { bottom: 0; }
  .immich-progress-fill { display: block; height: 100%; width: 0; background: #6ba7e8; animation: immich-progress var(--immich-progress-duration, 15s) linear forwards; }
  @keyframes immich-progress { from { width: 0; } to { width: 100%; } }
  .immich-controls { position: absolute; inset: 0; z-index: 7; display: grid; grid-template-columns: 1fr 1fr 1fr; }
  .immich-controls[data-active='false'] { pointer-events: none; }
  .immich-zone { border: none; background: transparent; display: grid; place-items: center; cursor: pointer; }
  .immich-zone-btn { display: grid; place-items: center; width: 48px; height: 48px; border-radius: 999px; color: #fff; background: rgba(0,0,0,0.32); backdrop-filter: blur(6px); box-shadow: 0 2px 12px rgba(0,0,0,0.4); opacity: 0; transform: scale(0.9); transition: opacity 0.2s ease, transform 0.2s ease; pointer-events: none; }
  .immich-zone-btn-lg { width: 64px; height: 64px; }
  .immich-controls[data-visible='true'] .immich-zone-btn { opacity: 1; transform: scale(1); }
  @media (hover: hover) { .immich-zone:hover .immich-zone-btn { opacity: 1; transform: scale(1); } }
  .immich-zone-btn svg { width: 55%; height: 55%; }
  .immich-empty, .immich-status { position: absolute; inset: 0; display: grid; place-items: center; padding: 24px; text-align: center; color: rgba(255,255,255,0.7); }
  .immich-status { background: rgba(0,0,0,0.35); }
  .immich-empty p { margin-top: 8px; font-size: 13px; }
  .immich-error { color: #ff8080; }
`;
