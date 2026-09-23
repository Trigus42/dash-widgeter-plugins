/** Calendar widget styles, injected into the plugin sandbox (no host CSS). */
export const CALENDAR_SANDBOX_CSS = `
  html, body { margin: 0; height: 100%; overflow: hidden; background: transparent; }
  body { width: 100%; height: 100%; }
  .wg-plugin-root { width: 100%; height: 100%; }
  .calendar-widget {
    position: relative; width: 100%; height: 100%; padding: 14px 16px;
    display: flex; flex-direction: column; color: #fff; overflow: hidden; box-sizing: border-box;
    font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
  }
  .calendar-header { font-size: 15px; font-weight: 600; margin-bottom: 10px; flex-shrink: 0; }
  .calendar-list { list-style: none; margin: 0; padding: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; }
  .calendar-event { display: flex; flex-direction: column; gap: 1px; padding-left: 10px; border-left: 3px solid #6ba7e8; }
  .calendar-when { font-size: 11px; color: rgba(255,255,255,0.7); }
  .calendar-summary { font-size: 14px; font-weight: 500; }
  .calendar-loc { font-size: 11px; color: rgba(255,255,255,0.7); }
  .calendar-empty, .calendar-none, .calendar-error {
    display: grid; place-items: center; flex: 1; text-align: center; color: rgba(255,255,255,0.7);
  }
  .calendar-empty p { margin-top: 6px; font-size: 13px; }
  .calendar-error { color: #ff8080; }
`;
