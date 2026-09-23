/** What the date line shows when enabled. */
export type DateStyle = 'full' | 'weekday';

export interface ClockConfig {
  use24Hour: boolean;
  showSeconds: boolean;
  showDate: boolean;
  /** 'full' = weekday + month + day; 'weekday' = weekday name only. */
  dateStyle: DateStyle;
  /** CSS font-weight for the time (100–900). */
  fontWeight: number;
}

export const CLOCK_DEFAULT_CONFIG: ClockConfig = {
  use24Hour: true,
  showSeconds: false,
  showDate: true,
  dateStyle: 'full',
  fontWeight: 700,
};

function clampNumber(raw: unknown, fallback: number, min: number, max: number): number {
  // Select fields persist their value as a string; accept both.
  const n = typeof raw === 'string' ? Number(raw) : raw;
  return typeof n === 'number' && !Number.isNaN(n) ? Math.max(min, Math.min(max, n)) : fallback;
}

export function readClockConfig(raw: Record<string, unknown>): ClockConfig {
  return {
    use24Hour: typeof raw.use24Hour === 'boolean' ? raw.use24Hour : CLOCK_DEFAULT_CONFIG.use24Hour,
    showSeconds:
      typeof raw.showSeconds === 'boolean' ? raw.showSeconds : CLOCK_DEFAULT_CONFIG.showSeconds,
    showDate: typeof raw.showDate === 'boolean' ? raw.showDate : CLOCK_DEFAULT_CONFIG.showDate,
    dateStyle: raw.dateStyle === 'weekday' ? 'weekday' : 'full',
    fontWeight: clampNumber(raw.fontWeight, CLOCK_DEFAULT_CONFIG.fontWeight, 100, 900),
  };
}
