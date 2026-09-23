import type { ClockConfig } from './types';

export interface ClockParts {
  time: string;
  date: string;
}

/** Format a Date into time + date strings per config, using the host locale. */
export function formatClock(now: Date, config: ClockConfig): ClockParts {
  const timeOptions: Intl.DateTimeFormatOptions = {
    hour: '2-digit',
    minute: '2-digit',
    hour12: !config.use24Hour,
  };
  if (config.showSeconds) timeOptions.second = '2-digit';

  const time = new Intl.DateTimeFormat(undefined, timeOptions).format(now);
  const dateOptions: Intl.DateTimeFormatOptions =
    config.dateStyle === 'weekday'
      ? { weekday: 'long' }
      : { weekday: 'long', month: 'short', day: 'numeric' };
  const date = config.showDate ? new Intl.DateTimeFormat(undefined, dateOptions).format(now) : '';

  return { time, date };
}
