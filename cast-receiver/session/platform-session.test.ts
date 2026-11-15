import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GuestWidgetContext } from '@/sandbox/sdk';
import type { AuthenticatedMessageHandler } from '@/core/cast/protocol/data-message';
import type { PlatformRequest, PlatformResponse } from '@/protocol/platform';
import type { createPluginReceiver, ReceiverState } from '../receiver';

const mocks = vi.hoisted(() => ({ pairing: vi.fn(), receiver: vi.fn<typeof createPluginReceiver>() }));
vi.mock('./pairing', () => ({ createPairingSession: mocks.pairing }));
vi.mock('../receiver', () => ({ createPluginReceiver: mocks.receiver }));
import { createScreenSession } from './screen-session';

const volume = { status: 'ok', operation: 'volume.read', value: { level: 0.4, max: 15 } } as const;
const connected: ReceiverState = { status: 'paired', command: null, presentationEpoch: 0, stream: null, peerCount: 1, error: null };
const tick = async (): Promise<void> => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };
async function fixture() {
  const room = { options: { generation: 'abcdefghijklmnop' }, roomJoinCode: '123456', authCode: '654321', expiresAt: Date.now() + 60_000, close: vi.fn(() => Promise.resolve()) };
  mocks.pairing.mockResolvedValueOnce(room).mockImplementation(() => Promise.withResolvers().promise);
  let message: AuthenticatedMessageHandler;
  let connection: (event: { generation: string; trusted: boolean }) => void;
  let update: (state: ReceiverState) => void;
  const receiver = { listening: Promise.resolve(), close: vi.fn(), confirmSas: vi.fn(), revokePresenter: vi.fn(), send: vi.fn() };
  mocks.receiver.mockImplementation((_options, _asset, onState, _binding, _revoke, onMessage, onConnection) => {
    if (!onMessage || !onConnection) throw new Error('Expected receiver authentication callbacks');
    update = onState; message = onMessage; connection = onConnection; return receiver;
  });
  const request = vi.fn<(request: PlatformRequest) => Promise<PlatformResponse>>().mockResolvedValue(volume);
  const ingest = vi.fn();
  const setCastState = vi.fn(() => Promise.resolve());
  const getCastState = vi.fn<() => Promise<Record<string, unknown> | null>>().mockResolvedValue(null);
  const context = { instanceId: 'receiver-widget', config: { relayUrl: 'wss://relay.test', senderUrl: '/cast.html' },
    validateNativeOrigin: vi.fn(() => Promise.resolve()), secureWebRtcCryptoAsset: vi.fn(() => Promise.resolve({ bytes: new Uint8Array(), sha256: 'digest' })),
    setCastState, getCastState, reportStatus: vi.fn(), platform: { request }, castResume: { get: vi.fn(() => Promise.resolve([])), delete: vi.fn(() => Promise.resolve()) },
    telemetry: { ingest, failure: vi.fn(), disclose: vi.fn() } } as unknown as GuestWidgetContext;
  const session = createScreenSession(context);
  await tick(); await tick();
  expect(mocks.receiver).toHaveBeenCalledOnce();
  return { session, receiver, request, ingest, setCastState, getCastState,
    send: (request: PlatformRequest, requestId: string = crypto.randomUUID()) => { message({ type: 'platform-request', request, requestId }, receiver.send); return requestId; },
    trust: (generation = room.options.generation, trusted = true) => connection({ generation, trusted }),
    update: (state: ReceiverState) => update(state) };
}

describe('screen session protected platform lifecycle', () => {
  afterEach(() => { vi.useRealTimers(); vi.resetAllMocks(); });

  it('requires matching trusted connected generation and never broadcasts or persists device volume', async () => {
    const { session, receiver, request, setCastState, send, trust, update } = await fixture();
    send({ kind: 'execute', operation: 'volume.read' });
    trust('wrong-generation'); update(connected); send({ kind: 'execute', operation: 'volume.read' });
    expect(request).not.toHaveBeenCalled();
    trust(); receiver.send.mockClear();
    const queue = session.state.queue;
    const id = send({ kind: 'execute', operation: 'volume.read' }); await tick();
    expect(request).toHaveBeenCalledExactlyOnceWith({ kind: 'execute', operation: 'volume.read' });
    expect(receiver.send).toHaveBeenCalledExactlyOnceWith({ type: 'platform-response', requestId: id, response: volume });
    expect(session.state.queue).toBe(queue);
    expect(session.state.command).toBeNull();
    expect(JSON.stringify(setCastState.mock.calls)).not.toMatch(/"level"|"max"|"platform-response"/);
    session.close();
  });

  it.each(['disconnect', 'revoke', 'close'] as const)('suppresses a late host response and queued operation after %s', async (action) => {
    vi.useFakeTimers();
    const { session, receiver, request, send, trust, update, getCastState } = await fixture();
    update(connected); trust(); receiver.send.mockClear();
    const pending = Promise.withResolvers<PlatformResponse>(); request.mockReturnValueOnce(pending.promise);
    send({ kind: 'execute', operation: 'volume.read' });
    send({ kind: 'execute', operation: 'volume.write', arguments: { level: 0.6 } });
    if (action === 'disconnect') update({ ...connected, status: 'disconnected', peerCount: 0 });
    if (action === 'revoke') {
      getCastState.mockResolvedValue({ sasDecision: { version: 1, action: 'unlink' } });
      await vi.advanceTimersByTimeAsync(200);
    }
    if (action === 'close') session.close();
    pending.resolve(volume); await tick();
    expect(request).toHaveBeenCalledTimes(1);
    expect(receiver.send).not.toHaveBeenCalled();
    session.close();
  });

  it('returns host capability errors without another failure record', async () => {
    const { session, request, send, trust, update, receiver, ingest } = await fixture();
    update(connected); trust(); receiver.send.mockClear();
    const response = { status: 'error', category: 'permission_denied', correlationId: crypto.randomUUID() } as const;
    request.mockResolvedValue(response);
    const id = send({ kind: 'execute', operation: 'volume.write', arguments: { level: 0.7 } }); await tick();
    expect(receiver.send).toHaveBeenCalledExactlyOnceWith({ type: 'platform-response', requestId: id, response });
    expect(ingest).not.toHaveBeenCalled(); session.close();
  });
});
