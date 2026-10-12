import type { GuestWidgetContext } from '@/sandbox/sdk';
import { createPairingSession, type PairingSession } from './pairing';
import { createPluginReceiver, type PluginReceiver, type ReceiverState } from './receiver';
import { readCastConfig } from './resolve';

export interface ScreenSession {
  state: ReceiverState & { roomCode: string; relayUrl: string; senderUrl: string };
  subscribe(listener: (state: ScreenSession['state']) => void): () => void;
  confirmSas(accepted: boolean): void;
  close(): void;
}

export function createScreenSession(context: GuestWidgetContext): ScreenSession {
  const config = readCastConfig(context.config);
  const state: ScreenSession['state'] = { status: 'connecting', command: null, stream: null, peerCount: 0, error: null,
    roomCode: '', relayUrl: config.relayUrl, senderUrl: config.senderUrl };
  const listeners = new Set<(state: ScreenSession['state']) => void>();
  const abort = new AbortController();
  let room: PairingSession | undefined, receiver: PluginReceiver | undefined, renewal: number | undefined, decisionPoll: number | undefined, disposed = false;
  let lifecycle = Promise.resolve();

  const publish = (patch: Partial<ScreenSession['state']>): void => {
    Object.assign(state, patch);
    listeners.forEach((listener) => listener({ ...state, stream: state.stream }));
    const { stream: _stream, ...serializableState } = state; void context.setCastState(serializableState);
  };
  const report = (error: unknown): void => publish({ status: 'error', error: error instanceof Error ? error.message : String(error) });
  const schedule = (expiresAt: number): void => {
    clearTimeout(renewal); renewal = window.setTimeout(() => enqueue(maintain), Math.max(1_000, expiresAt - Date.now() - 30_000));
  };
  const allocate = async (): Promise<void> => {
    if (disposed) return;
    room = await createPairingSession(config.relayUrl, abort.signal, (url) => context.validateNativeOrigin('signaling', url));
    if (disposed) { await room.close(); room = undefined; return; }
    const asset = await context.secureWebRtcCryptoAsset();
    receiver = createPluginReceiver(room.options, asset, (next) => {
      publish({ ...next, roomCode: state.roomCode }); context.reportStatus(next.error ? 'error' : 'ok', next.error ?? '');
    });
    publish({ roomCode: room.roomCode, error: null });
    decisionPoll = window.setInterval(() => { void context.getCastSasDecision().then((decision) => {
      if (decision && decision.roomCode === state.roomCode && decision.sas === state.sas) receiver?.confirmSas(decision.accepted);
    }).catch(report); }, 250); schedule(room.expiresAt);
  };
  const maintain = async (): Promise<void> => {
    if (disposed || !room) return;
    if (state.peerCount > 0) { schedule(await room.renew()); return; }
    receiver?.close(); receiver = undefined; await room.close(); room = undefined; await allocate();
  };
  const enqueue = (operation: () => Promise<void>): void => {
    lifecycle = lifecycle.then(operation).catch(report);
  };

  if (!config.relayUrl) report('Configure and approve a signaling origin.'); else enqueue(allocate);
  return {
    state,
    subscribe(listener) { listeners.add(listener); listener({ ...state }); return () => listeners.delete(listener); },
    confirmSas(accepted) { receiver?.confirmSas(accepted); },
    close() { disposed = true; abort.abort(); clearTimeout(renewal); clearInterval(decisionPoll); receiver?.close(); receiver = undefined; const active = room; room = undefined;
      if (active) lifecycle = lifecycle.then(() => active.close()).catch(report); listeners.clear(); },
  };
}
