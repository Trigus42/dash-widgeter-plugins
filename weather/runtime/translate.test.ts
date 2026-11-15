import { describe, expect, it } from 'vitest';
import { text } from './translate';

describe('weather runtime translations', () => {
  it('renders readable precipitation timing in English and unsupported locales', () => {
    expect(text('en-US', 'inHours', { count: 2 })).toBe('in 2 h');
    expect(text('en-GB', 'inMinutes', { count: 25 })).toBe('in 25 min');
    expect(text('fr-FR', 'now')).toBe('now');
  });

  it('uses German timing while preserving condition fallbacks', () => {
    expect(text('de-DE', 'inHours', { count: 2 })).toBe('in 2 Std.');
    expect(text('en-US', 'codes.2', {}, 'Partly cloudy')).toBe('Partly cloudy');
  });
});
