import { describe, expect, it } from 'vitest';
import { formatClock } from './format';
import { CLOCK_DEFAULT_CONFIG } from './types';

// Fixed instant: 2026-01-02 09:05:07 local time.
const when = new Date(2026, 0, 2, 9, 5, 7);

describe('formatClock', () => {
  it('formats 24-hour time without seconds by default', () => {
    const { time } = formatClock(when, CLOCK_DEFAULT_CONFIG);
    expect(time).toMatch(/^09[:.]05$/);
  });

  it('includes seconds when enabled', () => {
    const { time } = formatClock(when, { ...CLOCK_DEFAULT_CONFIG, showSeconds: true });
    expect(time).toMatch(/07/);
  });

  it('omits the date when showDate is false', () => {
    const { date } = formatClock(when, { ...CLOCK_DEFAULT_CONFIG, showDate: false });
    expect(date).toBe('');
  });

  it('produces a date string when enabled', () => {
    const { date } = formatClock(when, CLOCK_DEFAULT_CONFIG);
    expect(date.length).toBeGreaterThan(0);
  });

  it('shows only the weekday name when dateStyle is weekday', () => {
    const { date } = formatClock(when, { ...CLOCK_DEFAULT_CONFIG, dateStyle: 'weekday' });
    // Jan 2 2026 is a Friday; weekday-only means no month/day digits.
    expect(date).not.toMatch(/\d/);
    expect(date.length).toBeGreaterThan(0);
  });
});
