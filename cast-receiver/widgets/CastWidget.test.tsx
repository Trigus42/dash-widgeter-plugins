import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import type { GuestWidgetContext } from '@/sandbox/sdk';
import { createCastQueueSnapshot } from '@/cast-protocol';

/**
 * Regression: a Cast receiver with no paired sender used to force sourceKind to
 * 'idle', so the widget's own statically configured "Cast target" (media URL,
 * website, YouTube) rendered nothing — the setting looked broken. The widget
 * must now fall back to its static config when no live sender command is active,
 * while an unconfigured ('idle') receiver still shows only the pairing screen.
 */
const mocks = vi.hoisted(() => ({ state: {} as Record<string, unknown>, listener: undefined as ((state: Record<string, unknown>) => void) | undefined }));
vi.mock('../session/screen-session', () => ({
  createScreenSession: () => ({
    state: mocks.state,
    subscribe: (listener: (s: Record<string, unknown>) => void) => { mocks.listener = listener; listener(mocks.state); return () => { mocks.listener = undefined; }; },
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

const play = vi.fn<() => Promise<void>>();
const pause = vi.fn<() => void>();
const load = vi.fn<() => void>();
describe('CastWidget live media playback', () => {
  beforeEach(() => {
    play.mockReset().mockResolvedValue(); pause.mockReset(); load.mockReset();
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(play);
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(pause);
    vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(load);
  });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it('plays a relay URL instead of a provider and detaches it on stop', () => {
    mocks.state = { ...baseReceiverState(), presentationEpoch: 1, relayMedia: { url: 'blob:relay', hasVideo: true, epoch: 1 } };
    const ctx = context({ sourceKind: 'website', sourceUrl: 'https://example.test', muted: false });
    const { container } = render(<CastWidget context={ctx} />);
    const video = container.querySelector('video')!;
    expect(video.getAttribute('src')).toBe('blob:relay'); expect(video.hidden).toBe(false);
    expect(play).toHaveBeenCalled();
    act(() => mocks.listener?.({ ...baseReceiverState(), relayMedia: null }));
    expect(video.getAttribute('src')).toBeNull(); expect(video.srcObject).toBeNull();
    expect(container.querySelector('video')).toBeNull();
  });

  it.each([false, true])('retains hidden relay playback with hasVideo=%s in audio-only mode', (hasVideo) => {
    const queue = { ...createCastQueueSnapshot(true), outputMode: 'audio-only' };
    mocks.state = { ...baseReceiverState(), queue, relayMedia: { url: 'blob:audio', hasVideo, epoch: 1 }, presentationEpoch: 1,
      command: { sourceKind: 'idle', sourceUrl: '', muted: false, volume: 0.4 } };
    const { container } = render(<CastWidget context={context({ muted: false })} />);
    const video = container.querySelector('video')!;
    expect(video.hidden).toBe(true); expect(video.getAttribute('src')).toBe('blob:audio');
    expect(play).toHaveBeenCalled(); expect(video.muted).toBe(false); expect(video.volume).toBe(0.4);
    expect(container.querySelector('[aria-label="Audio casting active"]')).not.toBeNull();
  });

  it('plays an audio-only relay without showing a picture in the default output mode', () => {
    mocks.state = { ...baseReceiverState(), relayMedia: { url: 'blob:audio', hasVideo: false, epoch: 1 }, presentationEpoch: 1 };
    const { container } = render(<CastWidget context={context({ muted: false })} />);
    const video = container.querySelector('video')!;
    expect(video.hidden).toBe(true); expect(video.getAttribute('src')).toBe('blob:audio'); expect(play).toHaveBeenCalled();
  });

  it('keeps audio-only native streams attached to a hidden playback element', () => {
    const stream = Object.assign(new window.MediaStream(), { getTracks: () => [] });
    mocks.state = { ...baseReceiverState(), stream };
    const { container } = render(<CastWidget context={context({ muted: false })} />);
    const video = container.querySelector('video')!;
    expect(video.hidden).toBe(true); expect(video.srcObject).toBe(stream); expect(play).toHaveBeenCalled();
  });

  it('updates relay playback controls without detaching and switches to a native source', () => {
    mocks.state = { ...baseReceiverState(), relayMedia: { url: 'blob:relay', hasVideo: true, epoch: 1 }, presentationEpoch: 1 };
    const { container } = render(<CastWidget context={context({ muted: false })} />);
    const video = container.querySelector('video')!;
    load.mockClear();
    act(() => mocks.listener?.({ ...mocks.state, command: { sourceKind: 'idle', sourceUrl: '', muted: true, volume: 0.2, paused: true } }));
    expect(video.muted).toBe(true); expect(video.volume).toBe(0.2); expect(pause).toHaveBeenCalled();
    expect(load).not.toHaveBeenCalled();
    const stream = Object.assign(new window.MediaStream(), { getTracks: () => [] });
    vi.spyOn(stream, 'getVideoTracks').mockReturnValue([{} as MediaStreamTrack]);
    act(() => mocks.listener?.({ ...baseReceiverState(), stream, relayMedia: null, presentationEpoch: 2 }));
    expect(video.getAttribute('src')).toBeNull(); expect(video.srcObject).toBe(stream);
  });
});
