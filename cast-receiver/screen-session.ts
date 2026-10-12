import type { GuestWidgetContext } from '@/sandbox/sdk';
import { createPairingSession } from './pairing';
import { createPluginReceiver, type ReceiverState } from './receiver';
import { readCastConfig } from './resolve';

export interface ScreenSession {
  state: ReceiverState & { roomCode: string; relayUrl: string; senderUrl: string };
  subscribe(listener: (state: ScreenSession['state']) => void): () => void;
  close(): void;
}

export function createScreenSession(context: GuestWidgetContext): ScreenSession {
  const config = readCastConfig(context.config);
  const state: ScreenSession['state'] = { status: 'connecting', command: null, stream: null, peerCount: 0, error: null,
    roomCode: '', relayUrl: config.relayUrl, senderUrl: config.senderUrl };
  const listeners = new Set<(state: ScreenSession['state']) => void>();
  const abort = new AbortController(); let stop: (() => void) | undefined; let closeRoom: (() => Promise<void>) | undefined;
  const publish = (patch: Partial<ScreenSession['state']>): void => {
    Object.assign(state, patch); document.body.dataset.castReceiverState = `${state.status}:${state.peerCount}:${state.error ?? ''}`;
    listeners.forEach((listener) => listener({ ...state, stream: state.stream }));
    void context.setCastState({ ...state, stream: null });
  };
  const open = async (): Promise<void> => {
    const room = await createPairingSession(config.relayUrl, abort.signal, (url) => context.validateNativeOrigin('signaling', url));
    if (abort.signal.aborted) { await room.close(); return; }
    closeRoom = () => room.close(); const asset = await context.secureWebRtcCryptoAsset();
    stop = createPluginReceiver(room.options, asset, (next) => {
      publish({ ...next, roomCode: state.roomCode });
      context.reportStatus(next.error ? 'error' : 'ok', next.error ?? '');
    });
    publish({ roomCode: room.roomCode, error: null });
  };
  if (!config.relayUrl) publish({ status: 'error', error: 'Configure and approve a signaling origin.' });
  else void open().catch((error: unknown) => publish({ status: 'error', error: error instanceof Error ? error.message : String(error) }));
  return {
    state,
    subscribe(listener) { listeners.add(listener); listener({ ...state }); return () => listeners.delete(listener); },
    close() { abort.abort(); stop?.(); if (closeRoom) void closeRoom(); listeners.clear(); },
  };
}
