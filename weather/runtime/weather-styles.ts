/**
 * Weather widget styles, injected into the plugin sandbox (an isolated realm
 * with no host CSS). Colors are literal — host CSS variables don't cross the
 * boundary. Layout uses container queries so widgets scale with their cell.
 */
export const WEATHER_SANDBOX_CSS = `
  html, body { margin: 0; height: 100%; overflow: hidden; background: transparent; }
  body { width: 100%; height: 100%; }
  .wg-plugin-root { width: 100%; height: 100%; }
  .weather-widget {
    position: relative; width: 100%; height: 100%; padding: 3% 5%;
    display: flex; flex-direction: column; justify-content: center;
    color: #fff; overflow: hidden; container-type: size; box-sizing: border-box;
    font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
  }
  .weather-loading, .weather-error { display: grid; place-items: center; text-align: center; }
  .weather-error { color: #ff8080; }
  .weather-now { padding: 0; }
  .weather-content {
    display: flex; flex-direction: column; justify-content: center; gap: 2cqh; flex: 1; min-height: 0;
    padding: 2cqh 5cqw; box-sizing: border-box;
  }
  .weather-loc {
    font-size: min(10cqh,5cqw); line-height: 1.2; color: rgba(255,255,255,0.65);
    overflow-wrap: anywhere;
  }
  .weather-current { display: flex; align-items: center; justify-content: center; gap: 4cqw; min-height: 0; }
  .weather-current svg { width: min(58cqh,26cqw); height: min(58cqh,26cqw); flex-shrink: 0; color: rgba(255,255,255,0.85); }
  .weather-temp { display: flex; flex-direction: column; min-width: 0; }
  .weather-reading { display: flex; align-items: baseline; gap: 0.12em; white-space: nowrap; }
  .weather-value { font-size: min(36cqh,22cqw); font-weight: 500; line-height: 1; letter-spacing: -0.045em; font-variant-numeric: tabular-nums; }
  .weather-unit { font-size: min(32cqh,15cqw); font-weight: 400; line-height: 1; color: rgba(255,255,255,0.85); }
  .weather-desc { font-size: min(13cqh,6cqw); line-height: 1.2; color: rgba(255,255,255,0.85); overflow-wrap: anywhere; }
  .weather-forecast { display: flex; justify-content: space-between; gap: 3%; margin-top: 8px; }
  .weather-day { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6%; flex: 1; min-width: 0; }
  .weather-day svg { width: min(34cqh,60%); height: min(34cqh,60%); }
  .weather-dow { font-size: min(11cqh,4.5cqw); color: rgba(255,255,255,0.82); }
  .weather-range { font-size: min(11cqh,4.5cqw); white-space: nowrap; font-variant-numeric: tabular-nums; }
  .weather-forecast-header { font-size: min(12cqh,6cqw); color: rgba(255,255,255,0.82); margin-bottom: 2%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .weather-forecast-full { margin-top: 0; flex: 1; align-items: stretch; }
  .weather-next {
    display: flex; align-items: center; justify-content: center; gap: 1.5cqw; flex-shrink: 0;
    font-size: min(12cqh,5cqw); line-height: 1.2; color: rgba(255,255,255,0.75);
  }
  .weather-next svg { width: 1.3em; height: 1.3em; flex-shrink: 0; }
  .weather-next-text { min-width: 0; overflow-wrap: anywhere; }
  .weather-next-time { flex-shrink: 0; white-space: nowrap; font-variant-numeric: tabular-nums; }
`;
