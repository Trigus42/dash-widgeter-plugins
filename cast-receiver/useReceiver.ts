import { useEffect, useState } from 'react';
import type { GuestWidgetContext } from '@/sandbox/sdk';
import { createPairingSession } from './pairing';
import { createPluginReceiver, type ReceiverState } from './receiver';
import { readCastConfig } from './resolve';

export interface ReceiverViewState extends ReceiverState { roomCode: string }
const INITIAL: ReceiverViewState = {
  status: 'connecting', command: null, stream: null, peerCount: 0, error: null, roomCode: '',
};
const RENEW_EARLY_MS = 30_000;

export function useReceiver(context: GuestWidgetContext): ReceiverViewState {
  const config = readCastConfig(context.config);
  const [state, setState] = useState(INITIAL);
  useEffect(() => {
    if (!config.relayUrl) {
      const error = 'Configure and approve a signaling origin.';
      setState({ ...INITIAL, status: 'error', error }); context.reportStatus('error', error);
      return;
    }
    const abort = new AbortController();
    let stop: (() => void) | null = null;
    let close: (() => Promise<void>) | null = null;
    let renewal: number | undefined;
    const open = async (): Promise<void> => {
      const session = await createPairingSession(config.relayUrl, abort.signal,
        (url) => context.validateNativeOrigin('signaling', url));
      if (abort.signal.aborted) { await session.close(); return; }
      stop?.(); if (close) await close().catch(() => undefined);
      close = () => session.close();
      setState((current) => ({ ...current, roomCode: session.roomCode }));
      stop = createPluginReceiver(session.options, (next) => {
        setState({ ...next, roomCode: session.roomCode });
        if (next.error) context.reportStatus('error', next.error); else context.reportStatus('ok', '');
      });
      renewal = window.setTimeout(() => void open().catch(reportError),
        Math.max(1_000, session.expiresAt - Date.now() - RENEW_EARLY_MS));
    };
    const reportError = (cause: unknown): void => {
      if (abort.signal.aborted) return;
      const error = cause instanceof Error ? cause.message : String(cause);
      setState({ ...INITIAL, status: 'error', error }); context.reportStatus('error', error);
    };
    void open().catch(reportError);
    return () => {
      abort.abort(); clearTimeout(renewal); stop?.(); if (close) void close().catch(() => undefined);
    };
  }, [config.relayUrl, context]);
  return state;
}
