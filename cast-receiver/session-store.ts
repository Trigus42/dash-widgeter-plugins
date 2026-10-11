import { useEffect, useState } from 'react';
import type { GuestWidgetContext } from '@/sandbox/sdk';
import { createPairingSession } from './pairing';
import { createPluginReceiver, type ReceiverState } from './receiver';
import { readCastConfig } from './resolve';

export interface CastSessionState extends ReceiverState {
  roomCode: string;
  relayUrl: string;
  senderUrl: string;
}

const INITIAL: CastSessionState = {
  status: 'connecting', command: null, stream: null, peerCount: 0, error: null,
  roomCode: '', relayUrl: '', senderUrl: '',
};
const RENEW_EARLY_MS = 30_000;
const RELEASE_DELAY_MS = 1_000;

type Listener = (state: CastSessionState) => void;
interface Entry { state: CastSessionState; listeners: Set<Listener>; refs: number; release: number | undefined; dispose: () => void }
const sessions = new Map<string, Entry>();
const playbackListeners = new Set<Listener>();
let playbackState: CastSessionState = INITIAL;

function publishPlayback(state: CastSessionState): void {
  playbackState = state;
  playbackListeners.forEach((listener) => listener(state));
}


function sessionKey(config: ReturnType<typeof readCastConfig>): string {
  return `${config.relayUrl}\n${config.senderUrl}`;
}

function createEntry(context: GuestWidgetContext, key: string): Entry {
  const config = readCastConfig(context.config);
  const abort = new AbortController();
  const entry: Entry = { state: { ...INITIAL, relayUrl: config.relayUrl, senderUrl: config.senderUrl }, listeners: new Set(), refs: 0, release: undefined, dispose: () => undefined };
  let stop: (() => void) | null = null;
  let close: (() => Promise<void>) | null = null;
  let renewal: number | undefined;
  let hadPeer = false;
  const publish = (patch: Partial<CastSessionState>): void => {
    entry.state = { ...entry.state, ...patch };
    entry.listeners.forEach((listener) => listener(entry.state));
    publishPlayback(entry.state);
    void context.setCastState({ ...entry.state, stream: null });
  };
  const fail = (cause: unknown): void => {
    if (abort.signal.aborted) return;
    const error = cause instanceof Error ? cause.message : String(cause);
    publish({ status: 'error', error, roomCode: '' });
    context.reportStatus('error', error);
  };
  const open = async (): Promise<void> => {
    const session = await createPairingSession(config.relayUrl, abort.signal,
      (url) => context.validateNativeOrigin('signaling', url));
    if (abort.signal.aborted) { await session.close(); return; }
    stop?.();
    if (close) await close().catch(() => undefined);
    close = () => session.close();
    stop = createPluginReceiver(session.options, (next) => {
      if (next.peerCount > 0) hadPeer = true;
      publish({ ...next, roomCode: session.roomCode });
      if (next.error) context.reportStatus('error', next.error); else context.reportStatus('ok', '');
      if (hadPeer && next.status === 'disconnected' && next.peerCount === 0) {
        hadPeer = false; clearTimeout(renewal); renewal = window.setTimeout(() => void open().catch(fail), 0);
      }
    });
    publish({ roomCode: session.roomCode, status: 'connecting', error: null });
    renewal = window.setTimeout(() => void open().catch(fail),
      Math.max(1_000, session.expiresAt - Date.now() - RENEW_EARLY_MS));
  };
  if (!config.relayUrl) fail('Configure and approve a signaling origin.');
  else void open().catch(fail);
  entry.dispose = () => {
    abort.abort(); clearTimeout(renewal); stop?.(); if (close) void close().catch(() => undefined); sessions.delete(key);
  };
  return entry;
}

export function useCastSession(context: GuestWidgetContext): CastSessionState {
  const config = readCastConfig(context.config);
  const key = sessionKey(config);
  const [state, setState] = useState<CastSessionState>(() => {
    const existing = sessions.get(key);
    if (existing) return existing.state;
    const created = createEntry(context, key); sessions.set(key, created); return created.state;
  });
  useEffect(() => {
    const entry = sessions.get(key) ?? createEntry(context, key);
    sessions.set(key, entry); clearTimeout(entry.release); entry.release = undefined;
    entry.refs += 1; entry.listeners.add(setState); setState(entry.state);
    return () => {
      entry.listeners.delete(setState); entry.refs -= 1;
      if (entry.refs === 0) entry.release = window.setTimeout(entry.dispose, RELEASE_DELAY_MS);
    };
  }, [context, key]);
  return state;
}

export function useCastPlayback(context: GuestWidgetContext): CastSessionState {
  const [state, setState] = useState(playbackState);
  useEffect(() => {
    let cancelled = false;
    const refresh = async (): Promise<void> => {
      const next = await context.getCastState();
      if (!cancelled && next) setState(next as unknown as CastSessionState);
    };
    void refresh();
    const interval = window.setInterval(() => void refresh(), 200);
    return () => { cancelled = true; clearInterval(interval); };
  }, [context]);
  return state;
}
