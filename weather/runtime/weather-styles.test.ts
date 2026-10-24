import { describe, expect, it } from 'vitest';
import { WEATHER_SANDBOX_CSS } from './weather-styles';

describe('weather current-condition styles', () => {
  it('wraps long localized descriptions instead of ellipsizing them', () => {
    const descriptionRule = WEATHER_SANDBOX_CSS.match(/\.weather-desc\s*\{([^}]*)\}/)?.[1];

    expect(descriptionRule).toContain('overflow-wrap: anywhere');
    expect(descriptionRule).not.toContain('text-overflow: ellipsis');
    expect(descriptionRule).not.toContain('white-space: nowrap');
  });
});
