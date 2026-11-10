import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GuestWidgetContext } from '@/sandbox/sdk';
import type { createPluginReceiver, ReceiverState } from '../receiver';
import type { DataMessage } from '@/core/cast/protocol/data-message';

const mocks = vi.hoisted(() => ({ pairing: vi.fn(), receiver: vi.fn<typeof createPluginReceiver>() }));
vi.mock('./pairing', () => ({ createPairingSession: mocks.pairing }));
vi.mock('../receiver', () => ({ createPluginReceiver: mocks.receiver }));
import { createScreenSession } from './screen-session';

async function setup() {
  const rooms = [0, 1].map((index) => ({ options: { generation: `g-${index}` }, roomJoinCode: '123456', authCode: '654321', expiresAt: Date.now() + 60_000, close: vi.fn(() => Promise.resolve()) }));
  mocks.pairing.mockResolvedValueOnce(rooms[0]).mockResolvedValueOnce(rooms[1]).mockImplementation(() => new Promise(() => undefined));
  const updates: Array<(state: ReceiverState) => void> = [];
  const messages: Array<(message: Extract<DataMessage, { type: 'queue-mutation' | 'pair-display-request' }>, send: (message: DataMessage) => void) => void> = [];
  const connections: Array<(event: { generation: string; trusted: boolean }) => void> = [];
  const receivers = rooms.map(() => ({ listening: Promise.resolve(), close: vi.fn(), confirmSas: vi.fn(), revokePresenter: vi.fn(), send: vi.fn() }));
  mocks.receiver.mockImplementation((_options, _asset, update, _binding, _revoke, message, connection) => {
    if (!message || !connection) throw new Error('Receiver callbacks required by this fixture.');
    const index = updates.length; updates.push(update); messages.push(message); connections.push(connection); return receivers[index]!;
  });
  const setCastState = vi.fn<(state: Record<string, unknown>) => Promise<void>>(() => Promise.resolve());
  const context = { config: { relayUrl: 'wss://relay.test', senderUrl: '/cast.html' }, validateNativeOrigin: vi.fn(() => Promise.resolve()),
    secureWebRtcCryptoAsset: vi.fn(() => Promise.resolve({ bytes: new Uint8Array(), sha256: 'digest' })), setCastState, reportStatus: vi.fn(), telemetry: { failure: vi.fn(), disclose: vi.fn() } } as unknown as GuestWidgetContext;
  const session = createScreenSession(context);
  await vi.waitFor(() => expect(updates).toHaveLength(1));
  return { session, updates, messages, connections, receivers, setCastState };
}
const state = (epoch: number, relayMedia: ReceiverState['relayMedia'] = null, peerCount = 1): ReceiverState => ({ status: relayMedia ? 'casting' : peerCount ? 'paired' : 'disconnected', command: null, presentationEpoch: epoch, stream: null, relayMedia, peerCount, error: null });
const relay = (epoch: number, url = 'blob:relay') => ({ epoch, url, hasVideo: true });

describe('screen session relay presentation isolation', () => {
  afterEach(() => { vi.resetAllMocks(); });

  it.each(['stop', 'disconnect'] as const)('clears live relay media on %s without allowing the old epoch to return', async (action) => {
    const { session, updates, setCastState } = await setup();
    updates[0]!(state(1, relay(1)));
    expect(session.state.relayMedia?.url).toBe('blob:relay');
    updates[0]!(state(1, null, action === 'stop' ? 1 : 0));
    expect(session.state.relayMedia).toBeNull(); expect(session.state.stream).toBeNull();
    expect(session.state.status).toBe(action === 'stop' ? 'paired' : 'disconnected');
    if (action === 'disconnect') {
      updates[0]!(state(2, relay(2, 'blob:closed')));
      expect(session.state.relayMedia).toBeNull(); expect(session.state.peerCount).toBe(0);
    }
    if (action === 'stop') {
      updates[0]!(state(1, relay(1)));
      expect(session.state.relayMedia).toBeNull();
      updates[0]!(state(2, relay(2, 'blob:fresh')));
      expect(session.state.relayMedia?.url).toBe('blob:fresh');
    }
    for (const [host] of setCastState.mock.calls) expect(host).not.toHaveProperty('relayMedia');
    session.close(); expect(session.state.relayMedia).toBeNull();
  });

  it('does not let an old sender relay replace a newer native presenter', async () => {
    const { session, updates, receivers } = await setup();
    updates[0]!(state(1, relay(1)));
    await vi.waitFor(() => expect(updates).toHaveLength(2));
    const stream = {} as MediaStream;
    updates[1]!({ ...state(1), status: 'casting', stream });
    expect(receivers[0]!.revokePresenter).toHaveBeenCalledWith(1);
    expect(session.state.stream).toBe(stream); expect(session.state.relayMedia).toBeNull();
    updates[0]!(state(1, relay(1)));
    expect(session.state.stream).toBe(stream); expect(session.state.relayMedia).toBeNull();
    updates[0]!(state(2, relay(2, 'blob:reacquired')));
    expect(session.state.stream).toBeNull(); expect(session.state.relayMedia?.url).toBe('blob:reacquired');
    expect(session.state.presentationEpoch).toBeGreaterThan(2);
    updates[1]!(state(1));
    expect(session.state.relayMedia?.url).toBe('blob:reacquired'); session.close();
  });

  it('rejects relay sources from a different presentation epoch', async () => {
    const { session, updates } = await setup();
    updates[0]!(state(2, relay(1, 'blob:stale')));
    expect(session.state.relayMedia).toBeFalsy();
    updates[0]!(state(2, relay(2, 'blob:current')));
    expect(session.state.relayMedia?.url).toBe('blob:current'); session.close();
  });

  it('clears and revokes a relay source when an authenticated queue selects provider content', async () => {
    const { session, updates, messages, connections, receivers } = await setup();
    updates[0]!(state(1, relay(1)));
    connections[0]!({ generation: 'g-0', trusted: true });
    const command = { sourceKind: 'website' as const, sourceUrl: 'https://example.test', muted: false, outputMode: 'audio-video' as const };
    messages[0]!({ type: 'queue-mutation', mutation: { type: 'queue-add', item: { id: '0123456789abcdef', command }, expectedRevision: 0 } }, vi.fn());
    messages[0]!({ type: 'queue-mutation', mutation: { type: 'queue-play', itemId: '0123456789abcdef', expectedRevision: 1 } }, vi.fn());
    expect(session.state.command).toEqual({ ...command, paused: false }); expect(session.state.relayMedia).toBeNull();
    expect(receivers[0]!.revokePresenter).toHaveBeenCalledWith(1);
    updates[0]!(state(1, relay(1)));
    expect(session.state.command).toEqual({ ...command, paused: false }); expect(session.state.relayMedia).toBeNull(); session.close();
  });
});
