import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GuestWidgetContext } from '@/sandbox/sdk';

const mocks = vi.hoisted(() => ({ createPairingSession: vi.fn(), createResumeSession: vi.fn(), createPluginReceiver: vi.fn() }));
vi.mock('./pairing', () => ({ createPairingSession: mocks.createPairingSession }));
vi.mock('@/core/cast/setup/receiver-client', () => ({ createResumeSession: mocks.createResumeSession }));
vi.mock('../receiver', () => ({ createPluginReceiver: mocks.createPluginReceiver }));
import { createScreenSession } from './screen-session';

const lifecycleTick = async (): Promise<void> => { await Promise.resolve(); await Promise.resolve(); };

describe('screen session room lifecycle', () => {
  afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); });
  it('rotates an unpaired room at expiry', async () => {
    vi.useFakeTimers(); vi.setSystemTime(1_000);
    const first = { roomCode: '1234111111', expiresAt: 31_000, options: {}, renew: vi.fn(), close: vi.fn(() => Promise.resolve()) };
    const second = { roomCode: '5678222222', expiresAt: 64_000, options: {}, renew: vi.fn(), close: vi.fn(() => Promise.resolve()) };
    mocks.createPairingSession.mockResolvedValueOnce(first).mockResolvedValueOnce(second);
    mocks.createPluginReceiver.mockReturnValue({ listening: Promise.resolve(), close: vi.fn(), confirmSas: vi.fn(), revokePresenter: vi.fn() });
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
      return { listening: Promise.resolve(), close: vi.fn(), confirmSas: vi.fn(), revokePresenter: vi.fn() };
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
      return { listening: Promise.resolve(), close: vi.fn(), confirmSas: vi.fn(), revokePresenter: vi.fn() };
    });
    const setCastState = vi.fn<(state: Record<string, unknown>) => Promise<void>>(() => Promise.resolve());
    const context = { config: { relayUrl: 'https://relay.example', senderUrl: '/cast.html' }, validateNativeOrigin: vi.fn(() => Promise.resolve()),
      secureWebRtcCryptoAsset: vi.fn(() => Promise.resolve({ bytes: new Uint8Array(), sha256: 'x' })), setCastState, reportStatus: vi.fn() } as unknown as GuestWidgetContext;
    const session = createScreenSession(context);
    await vi.waitFor(() => expect(setCastState).toHaveBeenCalledWith(expect.objectContaining({ sas: '654321', sasTrusted: false })));
    expect(() => structuredClone(setCastState.mock.calls.at(-1)?.[0])).not.toThrow();
    session.close();
  });
  it('publishes the trusted SAS transition so pairing UI can close', async () => {
    const pairing = { roomCode: '1234111111', expiresAt: Date.now() + 60_000, options: {}, close: vi.fn(() => Promise.resolve()) };
    mocks.createPairingSession.mockResolvedValueOnce(pairing);
    let callback: ((state: Record<string, unknown>) => void) | undefined;
    mocks.createPluginReceiver.mockImplementation((_options, _asset, onState: (state: Record<string, unknown>) => void) => {
      callback = onState; return { listening: Promise.resolve(), close: vi.fn(), confirmSas: vi.fn(), revokePresenter: vi.fn(), send: vi.fn() };
    });
    const context = { config: { relayUrl: 'https://relay.example', senderUrl: '/cast.html' }, validateNativeOrigin: vi.fn(() => Promise.resolve()),
      secureWebRtcCryptoAsset: vi.fn(() => Promise.resolve({ bytes: new Uint8Array(), sha256: 'x' })), setCastState: vi.fn(() => Promise.resolve()), reportStatus: vi.fn() } as unknown as GuestWidgetContext;
    const session = createScreenSession(context); await vi.waitFor(() => expect(callback).toBeTypeOf('function'));
    callback?.({ status: 'paired', command: null, presentationEpoch: 0, stream: null, peerCount: 1, error: null, sas: '654321', sasTrusted: false });
    callback?.({ status: 'paired', command: null, presentationEpoch: 0, stream: null, peerCount: 1, error: null, sasTrusted: true });
    expect(session.state.sas).toBeUndefined(); expect(session.state.sasTrusted).toBe(true);
    callback?.({ status: 'paired', command: null, presentationEpoch: 0, stream: null, peerCount: 1, error: null });
    expect(session.state.sasTrusted).toBe(true); session.close();
  });

  it('ignores a dismissal token left by a previous SAS dialog', async () => {
    vi.useFakeTimers();
    const pairing = { roomCode: '1234111111', expiresAt: Date.now() + 60_000, options: {}, close: vi.fn(() => Promise.resolve()) };
    mocks.createPairingSession.mockResolvedValueOnce(pairing);
    let callback: ((state: Record<string, unknown>) => void) | undefined;
    const receiver = { listening: Promise.resolve(), close: vi.fn(), confirmSas: vi.fn(), revokePresenter: vi.fn(), send: vi.fn() };
    mocks.createPluginReceiver.mockImplementation((_options, _asset, onState: (state: Record<string, unknown>) => void) => {
      callback = onState; return receiver;
    });
    const getCastState = vi.fn(() => Promise.resolve({ dismissSas: 123 }));
    const context = { config: { relayUrl: 'https://relay.example', senderUrl: '/cast.html' }, validateNativeOrigin: vi.fn(() => Promise.resolve()),
      secureWebRtcCryptoAsset: vi.fn(() => Promise.resolve({ bytes: new Uint8Array(), sha256: 'x' })), setCastState: vi.fn(() => Promise.resolve()), getCastState,
      reportStatus: vi.fn() } as unknown as GuestWidgetContext;
    const session = createScreenSession(context); await vi.waitFor(() => expect(callback).toBeTypeOf('function'));
    callback?.({ status: 'paired', command: null, presentationEpoch: 0, stream: null, peerCount: 1, error: null, sas: '654321', sasTrusted: false });
    await vi.advanceTimersByTimeAsync(201);
    expect(receiver.confirmSas).not.toHaveBeenCalled();
    expect(session.state.sas).toBe('654321');
    session.close();
  });
  it('keeps another connected room alive when one receiver disconnects', async () => {
    const rooms = ['1111111111', '2222222222', '3333333333'].map((roomCode) => ({
      roomCode, expiresAt: Date.now() + 60_000, options: {}, renew: vi.fn(), close: vi.fn(() => Promise.resolve()),
    }));
    mocks.createPairingSession.mockResolvedValueOnce(rooms[0]).mockResolvedValueOnce(rooms[1]).mockResolvedValueOnce(rooms[2]);
    const callbacks: Array<(state: { status: 'paired' | 'disconnected'; command: null; stream: null; peerCount: number; error: null }) => void> = [];
    const receivers = rooms.map(() => ({ listening: Promise.resolve(), close: vi.fn(), confirmSas: vi.fn(), revokePresenter: vi.fn() }));
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
  it('keeps a trusted fresh-pair receiver alive while allocating the next pairing room', async () => {
    const rooms = ['1111111111', '2222222222'].map((roomCode, index) => ({
      roomCode, expiresAt: Date.now() + 60_000, options: { generation: `generation-${index}` }, close: vi.fn(() => Promise.resolve()),
    }));
    mocks.createPairingSession.mockResolvedValueOnce(rooms[0]).mockResolvedValueOnce(rooms[1]);
    const states: Array<(state: Record<string, unknown>) => void> = [];
    const messages: Array<(message: { type: string; mutation?: object }) => void> = [];
    const connections: Array<(event: { generation: string; trusted: boolean }) => void> = [];
    const receivers = rooms.map(() => ({ listening: Promise.resolve(), close: vi.fn(), confirmSas: vi.fn(), revokePresenter: vi.fn(), send: vi.fn() }));
    mocks.createPluginReceiver.mockImplementation((_options, _asset, onState: (state: Record<string, unknown>) => void,
      _binding, _revoke, onMessage: (message: { type: string; mutation?: object }, send: () => void) => void,
      onConnection: (event: { generation: string; trusted: boolean }) => void) => {
      const index = states.length; states.push(onState); messages.push((message) => onMessage(message, vi.fn())); connections.push(onConnection); return receivers[index];
    });
    const context = { config: { relayUrl: 'https://relay.example', senderUrl: '/cast.html' }, validateNativeOrigin: vi.fn(() => Promise.resolve()),
      secureWebRtcCryptoAsset: vi.fn(() => Promise.resolve({ bytes: new Uint8Array(), sha256: 'x' })), setCastState: vi.fn(() => Promise.resolve()), reportStatus: vi.fn() } as unknown as GuestWidgetContext;
    const session = createScreenSession(context); await vi.waitFor(() => expect(states).toHaveLength(1));
    states[0]!({ status: 'paired', command: null, presentationEpoch: 0, stream: null, peerCount: 1, error: null });
    connections[0]!({ generation: 'generation-0', trusted: true });
    await vi.waitFor(() => expect(states).toHaveLength(2));
    expect(receivers[0]!.close).not.toHaveBeenCalled(); expect(rooms[0]!.close).not.toHaveBeenCalled(); expect(session.state.peerCount).toBe(1);
    const command = { sourceKind: 'website', sourceUrl: 'https://example.test', muted: false, outputMode: 'audio-video' };
    messages[0]!({ type: 'queue-mutation', mutation: { type: 'queue-add', item: { id: '0123456789abcdef', command }, expectedRevision: 0 } });
    expect(session.state.queue.revision).toBe(1);
    states[0]!({ status: 'paired', command: null, presentationEpoch: 0, stream: null, peerCount: 1, error: null });
    expect(session.state.peerCount).toBe(1); expect(receivers[0]!.close).not.toHaveBeenCalled(); session.close();
  });
  it('accepts authenticated messages only after the exact receiver generation is trusted', async () => {
    const options = { relayUrl: 'https://relay.example', roomCode: 'room', authCode: 'code', generation: 'expected-generation' };
    const pairing = { roomCode: '1234111111', expiresAt: Date.now() + 60_000, options, close: vi.fn(() => Promise.resolve()) };
    mocks.createPairingSession.mockResolvedValueOnce(pairing);
    let message: ((value: { type: string; mutation?: object; visible?: boolean }) => void) | undefined;
    let connection: ((event: { generation: string; trusted: boolean }) => void) | undefined;
    const send = vi.fn();
    mocks.createPluginReceiver.mockImplementation((_options, _asset, _state, _binding, _revoke,
      onMessage: (value: { type: string; mutation?: object; visible?: boolean }, outgoing: (message: object) => void) => void,
      onConnection: (event: { generation: string; trusted: boolean }) => void) => {
      message = (value) => { onMessage(value, send); }; connection = onConnection;
      connection?.({ generation: 'wrong-generation', trusted: true });
      return { listening: Promise.resolve(), close: vi.fn(), confirmSas: vi.fn(), revokePresenter: vi.fn(), send };
    });
    const context = { config: { relayUrl: 'https://relay.example', senderUrl: '/cast.html' }, validateNativeOrigin: vi.fn(() => Promise.resolve()),
      secureWebRtcCryptoAsset: vi.fn(() => Promise.resolve({ bytes: new Uint8Array(), sha256: 'x' })), setCastState: vi.fn(() => Promise.resolve()), reportStatus: vi.fn() } as unknown as GuestWidgetContext;
    const session = createScreenSession(context); await vi.waitFor(() => expect(message).toBeTypeOf('function'));
    const command = { sourceKind: 'website', sourceUrl: 'https://example.test', muted: false, outputMode: 'audio-video' };
    const mutation = { type: 'queue-add', item: { id: '0123456789abcdef', command }, expectedRevision: 0 };
    message?.({ type: 'pair-display-request', visible: true }); message?.({ type: 'queue-mutation', mutation });
    expect(session.state.pairingReveal).toBe(0); expect(session.state.queue.revision).toBe(0); expect(send).not.toHaveBeenCalled();
    connection?.({ generation: 'wrong-generation', trusted: true }); message?.({ type: 'queue-mutation', mutation });
    expect(session.state.queue.revision).toBe(0);
    connection?.({ generation: options.generation, trusted: true }); message?.({ type: 'pair-display-request', visible: true }); message?.({ type: 'queue-mutation', mutation });
    expect(session.state.pairingReveal).toBe(1); expect(session.state.queue.revision).toBe(1); expect(send).toHaveBeenCalledWith(expect.objectContaining({ type: 'queue-snapshot' }));
    session.close();
  });
  it('preserves authoritative playback and queue while a sender reconnects', async () => {
    const rooms = ['1111111111', '2222222222'].map((roomCode, index) => ({ roomCode, expiresAt: Date.now() + 60_000, options: { generation: String(index) }, close: vi.fn(() => Promise.resolve()) }));
    mocks.createPairingSession.mockResolvedValueOnce(rooms[0]).mockResolvedValueOnce(rooms[1]);
    const callbacks: Array<(state: Record<string, unknown>) => void> = [];
    const messages: Array<(message: { type: string; mutation?: object }) => void> = [];
    const receivers = rooms.map(() => ({ listening: Promise.resolve(), close: vi.fn(), confirmSas: vi.fn(), revokePresenter: vi.fn(), send: vi.fn() }));
    mocks.createPluginReceiver.mockImplementation((_options, _asset, onState: (state: Record<string, unknown>) => void,
      _binding, _revoke, onMessage: (message: { type: string; mutation?: object }, send: () => void) => void,
      onConnection: (event: { generation: string; trusted: boolean }) => void) => {
      const index = callbacks.length; callbacks.push(onState); messages.push((message) => onMessage(message, vi.fn())); queueMicrotask(() => onConnection({ generation: String(index), trusted: true })); return receivers[index];
    });
    const context = { config: { relayUrl: 'https://relay.example', senderUrl: '/cast.html' }, validateNativeOrigin: vi.fn(() => Promise.resolve()),
      secureWebRtcCryptoAsset: vi.fn(() => Promise.resolve({ bytes: new Uint8Array(), sha256: 'x' })), setCastState: vi.fn(() => Promise.resolve()), reportStatus: vi.fn() } as unknown as GuestWidgetContext;
    const session = createScreenSession(context); await vi.waitFor(() => expect(callbacks).toHaveLength(1));
    await Promise.resolve();
    const command = { sourceKind: 'website', sourceUrl: 'https://example.test', muted: false, outputMode: 'audio-video' };
    callbacks[0]!({ status: 'casting', command, presentationEpoch: 1, stream: null, peerCount: 1, error: null });
    messages[0]!({ type: 'queue-mutation', mutation: { type: 'queue-add', item: { id: '0123456789abcdef', command }, expectedRevision: 0 } });
    const before = { command: session.state.command, epoch: session.state.presentationEpoch, queue: session.state.queue };
    callbacks[0]!({ status: 'disconnected', command: null, presentationEpoch: 1, stream: null, peerCount: 0, error: null });
    await vi.waitFor(() => expect(callbacks).toHaveLength(2));
    await Promise.resolve();
    callbacks[1]!({ status: 'connecting', command: null, presentationEpoch: 0, stream: null, peerCount: 0, error: null });
    expect(session.state).toMatchObject({ command: before.command, presentationEpoch: before.epoch, queue: before.queue });
    callbacks[1]!({ status: 'paired', command: null, presentationEpoch: 0, stream: null, peerCount: 1, error: null });
    messages[1]!({ type: 'queue-mutation', mutation: { type: 'queue-play', itemId: '0123456789abcdef', expectedRevision: 1 } });
    expect(session.state.queue.revision).toBe(2); expect(session.state.command).toEqual({ ...command, paused: false }); session.close();
  });
  it('ignores revoked epochs and permits a genuinely newer A epoch to reacquire', async () => {
    const rooms = ['1111111111', '2222222222'].map((roomCode) => ({
      roomCode, expiresAt: Date.now() + 60_000, options: {}, close: vi.fn(() => Promise.resolve()),
    }));
    mocks.createPairingSession.mockResolvedValueOnce(rooms[0]).mockResolvedValueOnce(rooms[1]);
    const callbacks: Array<(state: Record<string, unknown>) => void> = [];
    const receivers = rooms.map(() => ({ listening: Promise.resolve(), close: vi.fn(), confirmSas: vi.fn(), revokePresenter: vi.fn() }));
    mocks.createPluginReceiver.mockImplementation((_options, _asset, onState: (state: Record<string, unknown>) => void) => {
      callbacks.push(onState); return receivers[callbacks.length - 1];
    });
    const context = { config: { relayUrl: 'https://relay.example', senderUrl: '/cast.html' }, validateNativeOrigin: vi.fn(() => Promise.resolve()),
      secureWebRtcCryptoAsset: vi.fn(() => Promise.resolve({ bytes: new Uint8Array(), sha256: 'x' })), setCastState: vi.fn(() => Promise.resolve()), reportStatus: vi.fn() } as unknown as GuestWidgetContext;
    const session = createScreenSession(context); await vi.waitFor(() => expect(callbacks).toHaveLength(1));
    const firstCommand = { sourceKind: 'youtube', sourceUrl: 'first', muted: false, outputMode: 'audio-video' };
    callbacks[0]!({ status: 'casting', command: firstCommand, presentationEpoch: 1, stream: null, peerCount: 1, error: null });
    await vi.waitFor(() => expect(callbacks).toHaveLength(2));
    callbacks[1]!({ status: 'paired', command: null, presentationEpoch: 0, stream: null, peerCount: 1, error: null });
    const secondCommand = { sourceKind: 'youtube', sourceUrl: 'second', muted: false, outputMode: 'audio-video' };
    callbacks[1]!({ status: 'casting', command: secondCommand, presentationEpoch: 1, stream: null, peerCount: 1, error: null });
    expect(receivers[0]!.revokePresenter).toHaveBeenCalledWith(1);
    callbacks[0]!({ status: 'paired', command: null, presentationEpoch: 1, stream: null, peerCount: 1, error: null });
    callbacks[0]!({ status: 'casting', command: firstCommand, presentationEpoch: 1, stream: null, peerCount: 1, error: null });
    expect(session.state.command).toEqual(secondCommand);
    callbacks[0]!({ status: 'casting', command: { ...firstCommand, sourceUrl: 'fresh' }, presentationEpoch: 2, stream: null, peerCount: 1, error: null });
    expect(session.state.command?.sourceUrl).toBe('fresh');
    expect(receivers[1]!.revokePresenter).toHaveBeenCalledWith(1);
    callbacks[1]!({ status: 'paired', command: null, presentationEpoch: 1, stream: null, peerCount: 1, error: null });
    expect(session.state.command?.sourceUrl).toBe('fresh'); session.close();
  });
  it('does not retain or reclaim with contentless casting state at a revoked epoch', async () => {
    const rooms = ['1111111111', '2222222222'].map((roomCode) => ({
      roomCode, expiresAt: Date.now() + 60_000, options: {}, close: vi.fn(() => Promise.resolve()),
    }));
    mocks.createPairingSession.mockResolvedValueOnce(rooms[0]).mockResolvedValueOnce(rooms[1]);
    const callbacks: Array<(state: Record<string, unknown>) => void> = [];
    const receivers = rooms.map(() => ({ listening: Promise.resolve(), close: vi.fn(), confirmSas: vi.fn(), revokePresenter: vi.fn() }));
    mocks.createPluginReceiver.mockImplementation((_options, _asset, onState: (state: Record<string, unknown>) => void) => {
      callbacks.push(onState); return receivers[callbacks.length - 1];
    });
    const context = { config: { relayUrl: 'https://relay.example', senderUrl: '/cast.html' }, validateNativeOrigin: vi.fn(() => Promise.resolve()),
      secureWebRtcCryptoAsset: vi.fn(() => Promise.resolve({ bytes: new Uint8Array(), sha256: 'x' })), setCastState: vi.fn(() => Promise.resolve()), reportStatus: vi.fn() } as unknown as GuestWidgetContext;
    const session = createScreenSession(context); await vi.waitFor(() => expect(callbacks).toHaveLength(1));
    const firstCommand = { sourceKind: 'youtube', sourceUrl: 'first', muted: false, outputMode: 'audio-video' };
    callbacks[0]!({ status: 'casting', command: firstCommand, presentationEpoch: 1, stream: null, peerCount: 1, error: null });
    await vi.waitFor(() => expect(callbacks).toHaveLength(2));
    callbacks[1]!({ status: 'paired', command: null, presentationEpoch: 0, stream: null, peerCount: 1, error: null });
    const secondCommand = { sourceKind: 'youtube', sourceUrl: 'second', muted: false, outputMode: 'audio-video' };
    callbacks[1]!({ status: 'casting', command: secondCommand, presentationEpoch: 1, stream: null, peerCount: 1, error: null });
    expect(receivers[0]!.revokePresenter).toHaveBeenCalledWith(1);
    callbacks[0]!({ status: 'casting', command: null, presentationEpoch: 1, stream: null, peerCount: 1, error: null });
    expect(session.state.command).toEqual(secondCommand);
    callbacks[1]!({ status: 'paired', command: null, presentationEpoch: 1, stream: null, peerCount: 1, error: null });
    expect(session.state.command).toEqual(secondCommand);
    expect(receivers[0]!.revokePresenter).toHaveBeenCalledTimes(1);
    session.close();
  });
  it('settles binding only after the resume listener starts and retains it until revoke or close', async () => {
    const pairing = { roomCode: '1234111111', expiresAt: Date.now() + 60_000, options: { generation: 'pair-generation' }, close: vi.fn(() => Promise.resolve()) };
    const never = Promise.withResolvers<never>();
    mocks.createPairingSession.mockResolvedValueOnce(pairing).mockImplementation(() => never.promise);
    mocks.createResumeSession.mockResolvedValue({ generation: 'resume-generation', relayUrl: 'wss://relay.example/socket', roomCode: 'a'.repeat(43), authCode: '', resumeBindingId: 'a'.repeat(43), resumePassword: new Uint8Array(32) });
    let install: ((binding: { bindingId: string; resumePassword: string; expiresAt: number }) => Promise<void>) | undefined;
    let revoke: ((bindingId: string) => Promise<void>) | undefined;
    const listening = Promise.withResolvers<void>();
    const pairingReceiver = { listening: Promise.resolve(), close: vi.fn(), confirmSas: vi.fn(), revokePresenter: vi.fn(), send: vi.fn() };
    const resumeReceiver = { listening: listening.promise, close: vi.fn(), confirmSas: vi.fn(), revokePresenter: vi.fn(), send: vi.fn() };
    mocks.createPluginReceiver.mockImplementation((_options, _asset, _state,
      onBinding: (binding: { bindingId: string; resumePassword: string; expiresAt: number }) => Promise<void>, onRevoke: (bindingId: string) => Promise<void>) => {
      if (!install) { install = onBinding; revoke = onRevoke; return pairingReceiver; }
      return resumeReceiver;
    });
    const stored: Array<{ bindingId: string; resumePassword: string; expiresAt: number }> = [];
    const context = { config: { relayUrl: 'https://relay.example', senderUrl: '/cast.html' }, validateNativeOrigin: vi.fn(() => Promise.resolve()),
      secureWebRtcCryptoAsset: vi.fn(() => Promise.resolve({ bytes: new Uint8Array(), sha256: 'x' })), setCastState: vi.fn(() => Promise.resolve()), reportStatus: vi.fn(),
      castResume: { get: vi.fn(() => Promise.resolve([...stored])), replace: vi.fn((bindings: typeof stored) => { stored.splice(0, stored.length, ...bindings); return Promise.resolve(); }), delete: vi.fn((bindingId: string) => { const index = stored.findIndex((item) => item.bindingId === bindingId); if (index >= 0) stored.splice(index, 1); return Promise.resolve(); }) } } as unknown as GuestWidgetContext;
    const session = createScreenSession(context); await vi.waitFor(() => expect(install).toBeTypeOf('function'));
    const binding = { bindingId: 'a'.repeat(43), resumePassword: 'A'.repeat(43), expiresAt: Date.now() + 60_000 };
    let settled = false; const installing = install!(binding).then(() => { settled = true; });
    await vi.waitFor(() => expect(mocks.createPluginReceiver).toHaveBeenCalledTimes(2));
    expect(settled).toBe(false); expect(resumeReceiver.close).not.toHaveBeenCalled();
    listening.resolve(); await installing; expect(settled).toBe(true);
    pairingReceiver.close(); expect(resumeReceiver.close).not.toHaveBeenCalled();
    await revoke!(binding.bindingId); expect(resumeReceiver.close).toHaveBeenCalledOnce();
    session.close();
  });
});
