import { describe, expect, it } from 'vitest';
import { OVERLAY_Z } from '@/types';
import { castManifest } from './manifest';

describe('cast receiver manifest', () => {
  it('starts as a movable overlay widget', () => {
    expect(castManifest.widgets?.[0]?.defaultZIndex).toBe(OVERLAY_Z);
  });
});
