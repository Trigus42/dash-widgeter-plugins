import { describe, expect, it } from 'vitest';
import { pluginText } from './translate';

describe('pluginText', () => {
  it('uses the selected locale for widget copy and weather conditions', () => {
    expect(pluginText('de', 'weather.today')).toBe('Heute');
    expect(pluginText('de-DE', 'weather.codes.3', {}, 'Overcast')).toBe('Bedeckt');
    expect(pluginText('en', 'weather.codes.3', {}, 'Overcast')).toBe('Overcast');
  });
});
