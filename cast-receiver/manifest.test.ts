import { describe, expect, it } from 'vitest';
import { OVERLAY_Z } from '@/types';
import { castManifest } from './manifest';

describe('cast receiver manifest', () => {
  it('declares separate transparent presentation and pairing widgets', () => {
    const screen = castManifest.widgets?.find((widget) => widget.id === 'cast-receiver.screen');
    const pairing = castManifest.widgets?.find((widget) => widget.id === 'cast-receiver.pairing');
    expect(screen?.defaultZIndex).toBe(OVERLAY_Z);
    expect(screen?.defaultAppearance).toEqual({ background: 'none', backgroundOpacity: 0 });
    expect(screen?.sandboxPolicy).toEqual(['embed-sites', 'remote-media', 'secure-webrtc']);
    expect(pairing?.defaultZIndex).toBe(OVERLAY_Z);
    expect(pairing?.defaultAppearance).toEqual({ background: 'none', backgroundOpacity: 0 });
    expect(pairing?.defaultConfig).not.toHaveProperty('hidePairingWhileCasting');
    expect(pairing?.settings?.some((field) => field.key === 'hidePairingWhileCasting')).toBe(false);
  });
});
