import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import type { GuestWidgetContext } from '@/sandbox/sdk';
import { createCastQueueSnapshot } from '@/cast-protocol';
import type { MediaAdapter } from '@/protocol/media';
import { FRAME_PLAYBACK_ACTIVATION_MESSAGE } from '@/sandbox/frame-interaction';

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

type TestWidgetContext = Omit<GuestWidgetContext, 'setPresentation' | 'setPresentationMode' | 'telemetry'> & {
  setPresentation: Mock<(this: void, presentation: Parameters<GuestWidgetContext['setPresentation']>[0]) => Promise<void>>;
  setPresentationMode: Mock<(this: void, mode: 'normal' | 'active') => Promise<void>>;
  telemetry: Omit<GuestWidgetContext['telemetry'], 'disclose'> & { disclose: Mock<(this: void, input: Parameters<GuestWidgetContext['telemetry']['disclose']>[0]) => void> };
};

function context(config: Record<string, unknown>): TestWidgetContext {
  return { config, locale: 'en', setPresentation: vi.fn(() => Promise.resolve()), setPresentationMode: vi.fn(() => Promise.resolve()),
    reportStatus: vi.fn(), telemetry: { disclose: vi.fn() } } as unknown as TestWidgetContext;
}

describe('CastWidget static source fallback', () => {
  afterEach(() => cleanup());
  it('delegates a statically configured media URL to host presentation without plugin-local playback', async () => {
    mocks.state = baseReceiverState();
    const ctx = context({ relayUrl: '', senderUrl: '', sourceKind: 'media', sourceUrl: 'https://media.example/clip.mp4', overlayMode: 'inline', muted: true });
    const { container } = render(<CastWidget context={ctx} />);
    expect(container.querySelector('video')).toBeNull();
    expect(ctx.setPresentation).toHaveBeenCalledWith({ provider: 'media', adapter: 'video', src: 'https://media.example/clip.mp4', paused: false, muted: true, volume: 1, outputMode: 'audio-video' });
    await waitFor(() => expect(ctx.setPresentationMode).toHaveBeenCalledWith('active'));
  });

  it('stays on the idle pairing screen when no source is configured', () => {
    mocks.state = baseReceiverState();
    const { container } = render(<CastWidget context={context({ relayUrl: '', senderUrl: '', sourceKind: 'idle', sourceUrl: '', overlayMode: 'inline', muted: false })} />);
    expect(container.querySelector('video.cast-media')).toBeNull();
    expect(container.querySelector('.cast-empty')).not.toBeNull();
  });

  it.each<[MediaAdapter, string]>([
    ['audio', 'https://media.example/track.mp3'],
    ['spotify', 'https://open.spotify.com/track/123'], ['soundcloud', 'https://soundcloud.com/artist/track'],
    ['mixcloud', 'https://mixcloud.com/artist/mix/'],
  ])('elevates foreground %s playback and lowers background without losing the source', async (adapter, sourceUrl) => {
    mocks.state = baseReceiverState();
    const ctx = context({ sourceKind: 'media', sourceUrl, adapter, muted: false });
    const { container } = render(<CastWidget context={ctx} />);
    expect(container.querySelector('video')).toBeNull();
    expect(ctx.setPresentation).toHaveBeenCalledWith(expect.objectContaining({ provider: 'media', adapter, src: sourceUrl }));
    await waitFor(() => expect(ctx.setPresentationMode).toHaveBeenLastCalledWith('active'));
    mocks.state = { ...baseReceiverState(), queue: { ...createCastQueueSnapshot(true), outputMode: 'audio-only' } };
    const background = context({ sourceKind: 'media', sourceUrl, adapter, muted: false });
    render(<CastWidget context={background} />);
    await waitFor(() => expect(background.setPresentationMode).toHaveBeenLastCalledWith('normal'));
    expect(background.setPresentation).toHaveBeenCalledWith(expect.objectContaining({ src: sourceUrl, outputMode: 'audio-only', muted: false }));
  });

  it('forwards live media adapter and playback controls, while legacy commands default to video', () => {
    mocks.state = { ...baseReceiverState(), command: { sourceKind: 'media', adapter: 'dash', sourceUrl: 'https://media.example/live.mpd', paused: true, muted: true, volume: 0.3 } };
    const ctx = context({ sourceKind: 'media', adapter: 'spotify', sourceUrl: 'https://open.spotify.com/track/123' });
    render(<CastWidget context={ctx} />);
    expect(ctx.setPresentation).toHaveBeenLastCalledWith({ provider: 'media', adapter: 'dash', src: 'https://media.example/live.mpd', paused: true, muted: true, volume: 0.3, outputMode: 'audio-video' });
    act(() => mocks.listener?.({ ...baseReceiverState(), command: { sourceKind: 'media', sourceUrl: 'https://media.example/clip.mp4', muted: false } }));
    expect(ctx.setPresentation).toHaveBeenLastCalledWith(expect.objectContaining({ provider: 'media', adapter: 'video' }));
  });

  it('treats an unrecognized lookalike domain as a website, not an authorized provider', () => {
    mocks.state = baseReceiverState();
    const ctx = context({ sourceKind: 'media', adapter: 'spotify', sourceUrl: 'https://open.spotify.com.evil.test/track/123' });
    const { container } = render(<CastWidget context={ctx} />);
    expect(ctx.setPresentation).toHaveBeenCalledWith({ provider: 'website', url: 'https://open.spotify.com.evil.test/track/123', outputMode: 'audio-video' });
    expect(container.querySelector('video')).toBeNull();
  });

  it('retains the existing YouTube host presentation path', () => {
    mocks.state = baseReceiverState();
    const ctx = context({ sourceKind: 'youtube', sourceUrl: 'https://youtu.be/dQw4w9WgXcQ', muted: false });
    render(<CastWidget context={ctx} />);
    expect(ctx.setPresentation).toHaveBeenCalledWith(expect.objectContaining({ provider: 'youtube', videoId: 'dQw4w9WgXcQ' }));
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

  it('plays a relay URL instead of a provider and detaches it on stop', async () => {
    mocks.state = { ...baseReceiverState(), presentationEpoch: 1, relayMedia: { url: 'blob:relay', hasVideo: true, hasAudio: true, epoch: 1 } };
    const ctx = context({ sourceKind: 'media', adapter: 'hlsjs', sourceUrl: 'https://media.example/live.m3u8', muted: false });
    const { container } = render(<CastWidget context={ctx} />);
    const video = container.querySelector('video')!;
    expect(video.getAttribute('src')).toBe('blob:relay'); expect(video.hidden).toBe(false);
    await waitFor(() => expect(play).toHaveBeenCalled());
    expect(video.controls).toBe(false);
    expect(ctx.setPresentation).toHaveBeenCalledWith(null);
    act(() => mocks.listener?.({ ...baseReceiverState(), relayMedia: null }));
    expect(video.getAttribute('src')).toBeNull(); expect(video.srcObject).toBeNull();
    expect(container.querySelector('video')).toBeNull();
    await waitFor(() => expect(ctx.setPresentation).toHaveBeenLastCalledWith(expect.objectContaining({ provider: 'media', adapter: 'hlsjs' })));
  });
  it('sets mute before attaching an audio-less relay URL and playing it', async () => {
    mocks.state = { ...baseReceiverState(), presentationEpoch: 1, relayMedia: { url: 'blob:relay', hasVideo: true, hasAudio: false, epoch: 1 } };
    const received: boolean[] = [];
    const descriptor = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'src')!;
    vi.spyOn(HTMLMediaElement.prototype, 'src', 'set').mockImplementation(function (this: HTMLMediaElement, value: string) {
      received.push(this.muted && this.defaultMuted); descriptor.set?.call(this, value);
    });
    const { container } = render(<CastWidget context={context({ muted: false })} />);
    await waitFor(() => expect(play).toHaveBeenCalled());
    expect(received).toEqual([true]);
    expect(container.querySelector('video')?.muted).toBe(true);
  });

  it('never unmutes an audio-less share when volume or track state updates', async () => {
    mocks.state = { ...baseReceiverState(), presentationEpoch: 1, relayMedia: { url: 'blob:relay', hasVideo: true, hasAudio: false, epoch: 1 } };
    const { container } = render(<CastWidget context={context({ muted: false })} />);
    const video = container.querySelector('video')!;
    await waitFor(() => expect(play).toHaveBeenCalled());
    const muteWrites: boolean[] = [];
    const descriptor = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'muted')!;
    vi.spyOn(video, 'muted', 'set').mockImplementation(function (this: HTMLMediaElement, value: boolean) {
      muteWrites.push(value); descriptor.set?.call(this, value);
    });
    act(() => mocks.listener?.({ ...mocks.state, command: { sourceKind: 'idle', sourceUrl: '', muted: false, volume: 0.3 } }));
    await waitFor(() => expect(video.volume).toBe(0.3));
    expect(muteWrites).not.toContain(false); expect(video.muted).toBe(true);
  });

  it('retries blocked playback only for its host activation and clears the failure after playing', async () => {
    const denial = new DOMException('Autoplay denied', 'NotAllowedError');
    play.mockRejectedValueOnce(denial);
    mocks.state = { ...baseReceiverState(), presentationEpoch: 1, relayMedia: { url: 'blob:relay', hasVideo: true, hasAudio: true, epoch: 1 } };
    const ctx = context({ muted: false });
    render(<CastWidget context={ctx} />);
    await waitFor(() => expect(ctx.telemetry.disclose).toHaveBeenCalledWith(expect.objectContaining({ operation: 'cast.playback.play', category: 'permission_denied', cause: denial })));
    expect(play).toHaveBeenCalledOnce();
    act(() => { window.dispatchEvent(new MessageEvent('message', { data: { type: FRAME_PLAYBACK_ACTIVATION_MESSAGE }, source: null })); });
    expect(play).toHaveBeenCalledOnce();
    await act(async () => { window.dispatchEvent(new MessageEvent('message', { data: { type: FRAME_PLAYBACK_ACTIVATION_MESSAGE }, source: window.parent })); });
    await waitFor(() => expect(ctx.reportStatus).toHaveBeenCalledWith('ok', ''));
    expect(play).toHaveBeenCalledTimes(2); expect(ctx.telemetry.disclose).toHaveBeenCalledOnce();
    act(() => mocks.listener?.({ ...baseReceiverState() }));
    act(() => { window.dispatchEvent(new MessageEvent('message', { data: { type: FRAME_PLAYBACK_ACTIVATION_MESSAGE }, source: window.parent })); });
    expect(play).toHaveBeenCalledTimes(2);
  });

  it.each([false, true])('retains hidden relay playback with hasVideo=%s in audio-only mode', async (hasVideo) => {
    const queue = { ...createCastQueueSnapshot(true), outputMode: 'audio-only' };
    mocks.state = { ...baseReceiverState(), queue, relayMedia: { url: 'blob:audio', hasVideo, hasAudio: true, epoch: 1 }, presentationEpoch: 1,
      command: { sourceKind: 'idle', sourceUrl: '', muted: false, volume: 0.4 } };
    const { container } = render(<CastWidget context={context({ muted: false })} />);
    const video = container.querySelector('video')!;
    expect(video.hidden).toBe(true); expect(video.getAttribute('src')).toBe('blob:audio');
    await waitFor(() => expect(play).toHaveBeenCalled()); expect(video.muted).toBe(false); expect(video.volume).toBe(0.4);
    expect(container.querySelector('[aria-label="Audio casting active"]')).not.toBeNull();
  });

  it('plays an audio-only relay without showing a picture in the default output mode', async () => {
    mocks.state = { ...baseReceiverState(), relayMedia: { url: 'blob:audio', hasVideo: false, hasAudio: true, epoch: 1 }, presentationEpoch: 1 };
    const { container } = render(<CastWidget context={context({ muted: false })} />);
    const video = container.querySelector('video')!;
    expect(video.hidden).toBe(true); expect(video.getAttribute('src')).toBe('blob:audio'); await waitFor(() => expect(play).toHaveBeenCalled());
  });

  it('keeps audio-only native streams attached to a hidden playback element', async () => {
    const stream = Object.assign(new window.MediaStream(), { getTracks: () => [] });
    mocks.state = { ...baseReceiverState(), stream };
    const { container } = render(<CastWidget context={context({ muted: false })} />);
    const video = container.querySelector('video')!;
    expect(video.hidden).toBe(true); expect(video.srcObject).toBe(stream); await waitFor(() => expect(play).toHaveBeenCalled());
  });

  it('retains a live video stream even when the configured adapter is audio-only', async () => {
    const stream = Object.assign(new window.MediaStream(), { getTracks: () => [] });
    vi.spyOn(stream, 'getVideoTracks').mockReturnValue([{} as MediaStreamTrack]);
    mocks.state = { ...baseReceiverState(), stream };
    const ctx = context({ sourceKind: 'media', adapter: 'spotify', sourceUrl: 'https://open.spotify.com/track/123', muted: false });
    const { container } = render(<CastWidget context={ctx} />);
    const video = container.querySelector('video')!;
    expect(video.hidden).toBe(false); expect(video.srcObject).toBe(stream); await waitFor(() => expect(play).toHaveBeenCalled());
    expect(ctx.setPresentation).toHaveBeenCalledWith(null);
    await waitFor(() => expect(ctx.setPresentationMode).toHaveBeenLastCalledWith('active'));
  });

  it('updates relay playback controls without detaching and switches to a native source', async () => {
    mocks.state = { ...baseReceiverState(), relayMedia: { url: 'blob:relay', hasVideo: true, hasAudio: true, epoch: 1 }, presentationEpoch: 1 };
    const { container } = render(<CastWidget context={context({ muted: false })} />);
    const video = container.querySelector('video')!;
    await waitFor(() => expect(play).toHaveBeenCalled());
    load.mockClear();
    act(() => mocks.listener?.({ ...mocks.state, command: { sourceKind: 'idle', sourceUrl: '', muted: true, volume: 0.2, paused: true } }));
    await waitFor(() => expect(video.volume).toBe(0.2)); expect(video.muted).toBe(true); expect(pause).toHaveBeenCalled();
    expect(load).not.toHaveBeenCalled();
    const stream = Object.assign(new window.MediaStream(), { getTracks: () => [] });
    vi.spyOn(stream, 'getVideoTracks').mockReturnValue([{} as MediaStreamTrack]);
    act(() => mocks.listener?.({ ...baseReceiverState(), stream, relayMedia: null, presentationEpoch: 2 }));
    expect(video.getAttribute('src')).toBeNull(); expect(video.srcObject).toBe(stream);
  });
});
