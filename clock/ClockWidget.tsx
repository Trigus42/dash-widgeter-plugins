import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ReactWidgetProps } from '@/sandbox/react';
import { readClockConfig } from './types';
import { formatClock } from './format';
import { fitClock } from './fit';

/**
 * Clock widget (React) running in the plugin sandbox. Shows date + time; the
 * font is fit to the cell by measuring rendered text (fit.ts) so a wide
 * HH:MM:SS never overflows, and it re-fits on tick, config change, and resize.
 */
export function ClockWidget({ context }: ReactWidgetProps): React.JSX.Element {
  const config = useMemo(() => readClockConfig(context.config), [context.config]);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const period = config.showSeconds ? 1000 : 15000;
    const timer = setInterval(() => setNow(new Date()), period);
    return () => clearInterval(timer);
  }, [config.showSeconds]);

  const { time, date } = formatClock(now, config);
  const showDate = config.showDate && Boolean(date);

  const widgetRef = useRef<HTMLDivElement | null>(null);
  const timeRef = useRef<HTMLDivElement | null>(null);
  const dateRef = useRef<HTMLDivElement | null>(null);

  // Fit after every render (text may have changed width) and on cell resize.
  useLayoutEffect(() => {
    const widget = widgetRef.current;
    const timeEl = timeRef.current;
    if (!widget || !timeEl) return;
    const fit = (): void => fitClock(widget, timeEl, showDate ? dateRef.current : null);
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(widget);
    return () => observer.disconnect();
  }, [time, date, showDate]);

  return (
    <div className="clock-widget" ref={widgetRef} style={{ fontWeight: config.fontWeight }}>
      <div className="clock-time" ref={timeRef} style={{ fontWeight: config.fontWeight }}>
        {time}
      </div>
      {showDate && (
        <div className="clock-date" ref={dateRef}>
          {date}
        </div>
      )}
    </div>
  );
}
