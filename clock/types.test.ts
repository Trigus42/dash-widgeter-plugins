import { describe, expect, it } from 'vitest';
import { CLOCK_DEFAULT_CONFIG, readClockConfig } from './types';

describe('readClockConfig', () => {
  it('falls back to defaults for missing/invalid values', () => {
    expect(readClockConfig({})).toEqual(CLOCK_DEFAULT_CONFIG);
  });

  it('accepts a numeric font weight persisted as a select string', () => {
    expect(readClockConfig({ fontWeight: '300' }).fontWeight).toBe(300);
  });

  it('only accepts a known dateStyle', () => {
    expect(readClockConfig({ dateStyle: 'weekday' }).dateStyle).toBe('weekday');
    expect(readClockConfig({ dateStyle: 'nonsense' }).dateStyle).toBe('full');
  });
});
