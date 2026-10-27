import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import type { GuestWidgetContext } from '@/sandbox/sdk';
import { createCastQueueSnapshot } from '@/cast-protocol';

/**
 * Regression: a Cast receiver with no paired sender used to force sourceKind to
 * 'idle', so the widget's own statically configured "Cast target" (media URL,
 * website, YouTube) rendered nothing — the setting looked broken. The widget
 * must now fall back to its static config when no live sender command is active,
 * while an unconfigured ('idle') receiver still shows only the pairing screen.
 */
const mocks = vi.hoisted(() => ({ state: {} as Record<string, unknown> }));
vi.mock('../session/screen-session', () => ({
  createScreenSession: () => ({
    state: mocks.state,
    subscribe: (listener: (s: unknown) => void) => { listener(mocks.state); return () => undefined; },
    close: () => undefined,
  }),
}));

import { CastWidget } from './CastWidget';

function baseReceiverState(): Record<string, unknown> {
  return { status: 'connecting', command: null, presentationEpoch: 0, stream: null, peerCount: 0, error: null,
    roomJoinCode: '', authCode: '', relayUrl: '', senderUrl: '', queue: createCastQueueSnapshot(true), pairingReveal: 0, pairingVisible: false };
}

function context(config: Record<string, unknown>): GuestWidgetContext {
  return { config, locale: 'en', setPresentation: vi.fn(() => Promise.resolve()), setPresentationMode: vi.fn(() => Promise.resolve()),
    reportStatus: vi.fn(), telemetry: { disclose: vi.fn() } } as unknown as GuestWidgetContext;
}

describe('CastWidget static source fallback', () => {
  it('renders a statically configured media URL without a sender command', () => {
    mocks.state = baseReceiverState();
    const { container } = render(<CastWidget context={context({ relayUrl: '', senderUrl: '', sourceKind: 'media', sourceUrl: 'https://media.example/clip.mp4', overlayMode: 'inline', muted: true })} />);
    const video = container.querySelector('video.cast-media');
    expect(video?.getAttribute('src')).toBe('https://media.example/clip.mp4');
  });

  it('stays on the idle pairing screen when no source is configured', () => {
    mocks.state = baseReceiverState();
    const { container } = render(<CastWidget context={context({ relayUrl: '', senderUrl: '', sourceKind: 'idle', sourceUrl: '', overlayMode: 'inline', muted: false })} />);
    expect(container.querySelector('video.cast-media')).toBeNull();
    expect(container.querySelector('.cast-empty')).not.toBeNull();
  });
});
