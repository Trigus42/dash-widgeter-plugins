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
  .weather-current { display: flex; align-items: center; justify-content: center; gap: min(10cqh,5cqw); height: 100%; }
  .weather-current svg { width: min(90cqh,30cqw); height: min(90cqh,30cqw); flex-shrink: 0; }
  .weather-temp { display: flex; flex-direction: column; justify-content: center; min-width: 0; }
  .weather-value { font-size: min(52cqh,22cqw); font-weight: 600; line-height: 1; font-variant-numeric: tabular-nums; }
  .weather-desc { font-size: min(20cqh,8cqw); color: rgba(255,255,255,0.82); margin-top: 0.15em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .weather-loc { font-size: min(17cqh,7cqw); color: rgba(255,255,255,0.82); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .weather-forecast { display: flex; justify-content: space-between; gap: 3%; margin-top: 8px; }
  .weather-day { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6%; flex: 1; min-width: 0; }
  .weather-day svg { width: min(34cqh,60%); height: min(34cqh,60%); }
  .weather-dow { font-size: min(11cqh,4.5cqw); color: rgba(255,255,255,0.82); }
  .weather-range { font-size: min(11cqh,4.5cqw); white-space: nowrap; font-variant-numeric: tabular-nums; }
  .weather-forecast-header { font-size: min(12cqh,6cqw); color: rgba(255,255,255,0.82); margin-bottom: 2%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .weather-forecast-full { margin-top: 0; flex: 1; align-items: stretch; }
  .weather-next {
    position: absolute; left: 5%; right: 5%; bottom: 4%;
    display: flex; align-items: center; justify-content: center; gap: 0.4em;
    color: rgba(255,255,255,0.9);
  }
  .weather-next svg { width: min(14cqh,7cqw); height: min(14cqh,7cqw); flex-shrink: 0; }
  .weather-next-text { font-size: min(13cqh,5.5cqw); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
`;
