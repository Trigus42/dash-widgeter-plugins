import { describe, expect, it } from 'vitest';
import { immichManifest } from './manifest';

describe('Immich settings layout', () => {
  it('opens dynamic source selectors on subpages and keeps booleans instant', () => {
    const settings = immichManifest.widgets?.[0]?.settings ?? [];
    expect(settings.filter((field) => field.subpage).map((field) => field.key)).toEqual(['albums', 'people', 'tags']);
    expect(settings.filter((field) => field.type === 'boolean').every((field) => !field.subpage)).toBe(true);
  });
});
