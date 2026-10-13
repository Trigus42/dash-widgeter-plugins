import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GuestWidgetContext } from '@/sandbox/sdk';

const mocks = vi.hoisted(() => ({ createPairingSession: vi.fn(), createPluginReceiver: vi.fn() }));
vi.mock('./pairing', () => ({ createPairingSession: mocks.createPairingSession }));
vi.mock('./receiver', () => ({ createPluginReceiver: mocks.createPluginReceiver }));
import { createScreenSession } from './screen-session';

const lifecycleTick = async (): Promise<void> => { await Promise.resolve(); await Promise.resolve(); };

describe('screen session room lifecycle', () => {
  afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); });
  it('rotates an unpaired room at expiry', async () => {
    vi.useFakeTimers(); vi.setSystemTime(1_000);
    const first = { roomCode: '1234111111', expiresAt: 31_000, options: {}, renew: vi.fn(), close: vi.fn(() => Promise.resolve()) };
    const second = { roomCode: '5678222222', expiresAt: 64_000, options: {}, renew: vi.fn(), close: vi.fn(() => Promise.resolve()) };
    mocks.createPairingSession.mockResolvedValueOnce(first).mockResolvedValueOnce(second);
    mocks.createPluginReceiver.mockReturnValue({ close: vi.fn(), confirmSas: vi.fn(), revokePresenter: vi.fn() });
    const context = { config: { relayUrl: 'https://relay.example', senderUrl: '/cast.html' }, validateNativeOrigin: vi.fn(() => Promise.resolve()),
      secureWebRtcCryptoAsset: vi.fn(() => Promise.resolve({ bytes: new Uint8Array(), sha256: 'x' })), setCastState: vi.fn(() => Promise.resolve()),
      reportStatus: vi.fn() } as unknown as GuestWidgetContext;
    const session = createScreenSession(context); await vi.advanceTimersByTimeAsync(1);
    expect(session.state.roomCode).toBe(first.roomCode);
    await vi.advanceTimersByTimeAsync(31_001); await lifecycleTick();
    expect(first.close).toHaveBeenCalledOnce(); expect(mocks.createPairingSession).toHaveBeenCalledTimes(2);
    expect(session.state.roomCode).toBe(second.roomCode); session.close();
  });
  it('never sends live media through host state RPC', async () => {
    const pairing = { roomCode: '1234111111', expiresAt: Date.now() + 60_000, options: {}, renew: vi.fn(), close: vi.fn(() => Promise.resolve()) };
    mocks.createPairingSession.mockResolvedValueOnce(pairing);
    mocks.createPluginReceiver.mockImplementation((_options, _asset, onState: (state: object) => void) => {
      onState({ status: 'connecting', command: null, stream: {} as MediaStream, peerCount: 0, error: null });
      return { close: vi.fn(), confirmSas: vi.fn(), revokePresenter: vi.fn() };
    });
    const setCastState = vi.fn<(state: Record<string, unknown>) => Promise<void>>(() => Promise.resolve());
    const context = { config: { relayUrl: 'https://relay.example', senderUrl: '/cast.html' }, validateNativeOrigin: vi.fn(() => Promise.resolve()),
      secureWebRtcCryptoAsset: vi.fn(() => Promise.resolve({ bytes: new Uint8Array(), sha256: 'x' })), setCastState, reportStatus: vi.fn() } as unknown as GuestWidgetContext;
    const session = createScreenSession(context); await vi.waitFor(() => expect(setCastState).toHaveBeenCalled());
    for (const [state] of setCastState.mock.calls) {
      expect(state).not.toHaveProperty('stream'); expect(state).not.toHaveProperty('screenStream');
    }
    session.close();
  });

  it('publishes the receiver SAS through clone-safe host state', async () => {
    const pairing = { roomCode: '1234111111', expiresAt: Date.now() + 60_000, options: {}, renew: vi.fn(), close: vi.fn(() => Promise.resolve()) };
    mocks.createPairingSession.mockResolvedValueOnce(pairing);
    mocks.createPluginReceiver.mockImplementation((_options, _asset, onState: (state: object) => void) => {
      onState({ status: 'paired', command: null, stream: null, peerCount: 1, error: null, sas: '654321', sasTrusted: false });
      return { close: vi.fn(), confirmSas: vi.fn(), revokePresenter: vi.fn() };
    });
    const setCastState = vi.fn<(state: Record<string, unknown>) => Promise<void>>(() => Promise.resolve());
    const context = { config: { relayUrl: 'https://relay.example', senderUrl: '/cast.html' }, validateNativeOrigin: vi.fn(() => Promise.resolve()),
      secureWebRtcCryptoAsset: vi.fn(() => Promise.resolve({ bytes: new Uint8Array(), sha256: 'x' })), setCastState, reportStatus: vi.fn() } as unknown as GuestWidgetContext;
    const session = createScreenSession(context);
    await vi.waitFor(() => expect(setCastState).toHaveBeenCalledWith(expect.objectContaining({ sas: '654321', sasTrusted: false })));
    expect(() => structuredClone(setCastState.mock.calls.at(-1)?.[0])).not.toThrow();
    session.close();
  });

  it('keeps another connected room alive when one receiver disconnects', async () => {
    const rooms = ['1111111111', '2222222222', '3333333333'].map((roomCode) => ({
      roomCode, expiresAt: Date.now() + 60_000, options: {}, renew: vi.fn(), close: vi.fn(() => Promise.resolve()),
    }));
    mocks.createPairingSession.mockResolvedValueOnce(rooms[0]).mockResolvedValueOnce(rooms[1]).mockResolvedValueOnce(rooms[2]);
    const callbacks: Array<(state: { status: 'paired' | 'disconnected'; command: null; stream: null; peerCount: number; error: null }) => void> = [];
    const receivers = rooms.map(() => ({ close: vi.fn(), confirmSas: vi.fn(), revokePresenter: vi.fn() }));
    mocks.createPluginReceiver.mockImplementation((_options, _asset, onState: (state: Parameters<(typeof callbacks)[number]>[0]) => void) => {
      callbacks.push(onState); return receivers[callbacks.length - 1];
    });
    const setCastState = vi.fn<(state: Record<string, unknown>) => Promise<void>>(() => Promise.resolve());
    const context = { config: { relayUrl: 'https://relay.example', senderUrl: '/cast.html' }, validateNativeOrigin: vi.fn(() => Promise.resolve()),
      secureWebRtcCryptoAsset: vi.fn(() => Promise.resolve({ bytes: new Uint8Array(), sha256: 'x' })), setCastState, reportStatus: vi.fn() } as unknown as GuestWidgetContext;
    const session = createScreenSession(context); await vi.waitFor(() => expect(callbacks).toHaveLength(1));
    callbacks[0]!({ status: 'paired', command: null, stream: null, peerCount: 1, error: null });
    await vi.waitFor(() => expect(callbacks).toHaveLength(2));
    callbacks[1]!({ status: 'paired', command: null, stream: null, peerCount: 1, error: null });
    await vi.waitFor(() => expect(session.state.peerCount).toBe(2));
    callbacks[0]!({ status: 'disconnected', command: null, stream: null, peerCount: 0, error: null });
    await vi.waitFor(() => expect(rooms[0]!.close).toHaveBeenCalledOnce());
    expect(receivers[0]!.close).toHaveBeenCalledOnce();
    expect(receivers[1]!.close).not.toHaveBeenCalled();
    expect(session.state.peerCount).toBe(1);
    expect(session.state.status).toBe('paired');
    for (const call of setCastState.mock.calls) expect(() => structuredClone(call[0])).not.toThrow();
    session.close();
  });
  it('keeps the active presenter until another sender starts or it stops', async () => {
    const rooms = ['1111111111', '2222222222', '3333333333'].map((roomCode) => ({
      roomCode, expiresAt: Date.now() + 60_000, options: {}, close: vi.fn(() => Promise.resolve()),
    }));
    mocks.createPairingSession.mockResolvedValueOnce(rooms[0]).mockResolvedValueOnce(rooms[1]);
    const callbacks: Array<(state: Record<string, unknown>) => void> = [];
    const receivers = rooms.map(() => ({ close: vi.fn(), confirmSas: vi.fn(), revokePresenter: vi.fn() }));
    mocks.createPluginReceiver.mockImplementation((_options, _asset, onState: (state: Record<string, unknown>) => void) => {
      callbacks.push(onState); return receivers[callbacks.length - 1];
    });
    const context = { config: { relayUrl: 'https://relay.example', senderUrl: '/cast.html' }, validateNativeOrigin: vi.fn(() => Promise.resolve()),
      secureWebRtcCryptoAsset: vi.fn(() => Promise.resolve({ bytes: new Uint8Array(), sha256: 'x' })), setCastState: vi.fn(() => Promise.resolve()), reportStatus: vi.fn() } as unknown as GuestWidgetContext;
    const session = createScreenSession(context); await vi.waitFor(() => expect(callbacks).toHaveLength(1));
    const firstCommand = { sourceKind: 'youtube', sourceUrl: 'first', muted: false, outputMode: 'audio-video' };
    callbacks[0]!({ status: 'casting', command: firstCommand, stream: null, peerCount: 1, error: null });
    await vi.waitFor(() => expect(callbacks).toHaveLength(2));
    callbacks[1]!({ status: 'paired', command: null, stream: null, peerCount: 1, error: null });
    expect(session.state.command).toEqual(firstCommand);
    const secondCommand = { sourceKind: 'youtube', sourceUrl: 'second', muted: false, outputMode: 'audio-video' };
    callbacks[1]!({ status: 'casting', command: secondCommand, stream: null, peerCount: 1, error: null });
    expect(session.state.command).toEqual(secondCommand); expect(receivers[0]!.revokePresenter).toHaveBeenCalledOnce();
    callbacks[0]!({ status: 'casting', command: firstCommand, stream: null, peerCount: 1, error: null });
    expect(session.state.command).toEqual(secondCommand); expect(receivers[1]!.revokePresenter).not.toHaveBeenCalled();
    callbacks[0]!({ status: 'paired', command: null, stream: null, peerCount: 1, error: null });
    callbacks[0]!({ status: 'casting', command: firstCommand, stream: null, peerCount: 1, error: null });
    expect(session.state.command).toEqual(firstCommand); expect(receivers[1]!.revokePresenter).toHaveBeenCalledOnce();
    callbacks[0]!({ status: 'paired', command: null, stream: null, peerCount: 1, error: null });
    expect(session.state.command).toBeNull(); session.close();
  });
});
