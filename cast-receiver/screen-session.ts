import type { GuestWidgetContext } from '@/sandbox/sdk';
import { createPairingSession } from './pairing';
import { createResumeSession } from '@/core/cast/receiver-client';
import { decode, type CastSessionOptions } from '@/cast-protocol';
import { createPluginReceiver, type PluginReceiver, type ReceiverState } from './receiver';
import { readCastConfig } from './resolve';

export interface ScreenSession {
  state: ReceiverState & { roomCode: string; relayUrl: string; senderUrl: string };
  subscribe(listener: (state: ScreenSession['state']) => void): () => void;
  close(): void;
}
interface ReceiverEntry { room: { options: CastSessionOptions; roomCode: string; expiresAt: number; close(): Promise<void> }; receiver?: PluginReceiver; state: ReceiverState; connected: boolean; revokedEpoch: number }
type TimerHandle = number | NodeJS.Timeout;


export function createScreenSession(context: GuestWidgetContext): ScreenSession {
  const config = readCastConfig(context.config);
  const state: ScreenSession['state'] = { status: 'connecting', command: null, presentationEpoch: 0, stream: null, peerCount: 0, error: null,
    roomCode: '', relayUrl: config.relayUrl, senderUrl: config.senderUrl };
  const listeners = new Set<(state: ScreenSession['state']) => void>();
  const listeningBindings = new Set<string>();
  const resumeEntries = new Map<string, ReceiverEntry>();
  const connected = new Set<ReceiverEntry>(); const abort = new AbortController();
  let pairing: ReceiverEntry | undefined, presenter: ReceiverEntry | undefined, sasOwner: ReceiverEntry | undefined, renewal: TimerHandle | undefined, disposed = false;
  let lifecycle: Promise<void> = Promise.resolve();
  const publish = (patch: Partial<ScreenSession['state']>): void => {
    if ('sas' in patch && patch.sas === undefined) delete state.sas;
    if ('sasTrusted' in patch && patch.sasTrusted === undefined) delete state.sasTrusted;
    Object.assign(state, patch); listeners.forEach((listener) => listener({ ...state }));
    const hostState = { status: state.status, command: state.command, peerCount: state.peerCount, error: state.error,
      roomCode: state.roomCode, relayUrl: state.relayUrl, senderUrl: state.senderUrl, ...(state.sas ? { sas: state.sas } : {}),
      ...(state.sasTrusted === undefined ? {} : { sasTrusted: state.sasTrusted }) };
    void context.setCastState(hostState);
  };
  const report = (error: unknown): void => publish({ status: 'error', error: error instanceof Error ? error.message : String(error) });
  const enqueue = (operation: () => Promise<void>): void => { lifecycle = lifecycle.then(operation).catch(report); };
  const aggregate = (entry: ReceiverEntry): void => {
    const latest = entry.state;
    const presenting = latest.status === 'casting' || latest.stream !== null || (latest.command !== null && latest.command.sourceKind !== 'idle');
    const stale = latest.presentationEpoch <= entry.revokedEpoch;
    if (presenting && !stale && (presenter !== entry || presenter.state.presentationEpoch !== latest.presentationEpoch)) {
      if (presenter) {
        const revokedEpoch = presenter.state.presentationEpoch;
        presenter.revokedEpoch = Math.max(presenter.revokedEpoch, revokedEpoch);
        presenter.state = { ...presenter.state, command: null, stream: null, status: 'paired' };
        presenter.receiver?.revokePresenter(revokedEpoch);
      }
      presenter = entry;
    } else if (presenter === entry && !presenting && latest.presentationEpoch > entry.revokedEpoch) presenter = undefined;
    const displayed = presenter?.state ?? latest;
    const preservesPresenter = Boolean(presenter && presenter !== entry) || stale;
    const patch = preservesPresenter
      ? { peerCount: connected.size, roomCode: state.roomCode }
      : { ...displayed, peerCount: connected.size, roomCode: state.roomCode };
    if (latest.sas) sasOwner = entry;
    if (sasOwner === entry && (!latest.sas || latest.peerCount === 0)) sasOwner = undefined;
    const ownedSas = sasOwner?.state.sas;
    if (!ownedSas) { delete state.sas; delete state.sasTrusted; }
    publish({ ...patch, ...(ownedSas ? { sas: ownedSas } : {}),
      ...(ownedSas && sasOwner?.state.sasTrusted !== undefined ? { sasTrusted: sasOwner.state.sasTrusted } : {}) });
    context.reportStatus(latest.error ? 'error' : 'ok', latest.error ?? '');
  };
  const disposeEntry = async (entry: ReceiverEntry): Promise<void> => {
    connected.delete(entry); if (pairing === entry) pairing = undefined; if (presenter === entry) presenter = undefined; if (sasOwner === entry) sasOwner = undefined; entry.receiver?.close();
    publish({ peerCount: connected.size, status: connected.size > 0 ? 'paired' : 'disconnected',
      ...(presenter ? { command: presenter.state.command, stream: presenter.state.stream } : { command: null, stream: null }) });
    await entry.room.close();
  };
  const resume = async (): Promise<void> => {
    const bindings = await context.castResume.get();
    await Promise.all(bindings.map(async (binding) => {
      if (listeningBindings.has(binding.bindingId)) return;
      listeningBindings.add(binding.bindingId);
      const listen = async (): Promise<void> => {
        try {
          const options = await createResumeSession(config.relayUrl, binding.bindingId, decode(binding.resumePassword), abort.signal);
          const asset = await context.secureWebRtcCryptoAsset();
          const entry: ReceiverEntry = { room: { options, roomCode: binding.bindingId, expiresAt: binding.expiresAt, close: () => Promise.resolve() },
            state: { status: 'connecting', command: null, presentationEpoch: 0, stream: null, peerCount: 0, error: null }, connected: false, revokedEpoch: 0 };
          resumeEntries.set(binding.bindingId, entry);
          entry.receiver = createPluginReceiver(options, asset, (next) => {
            entry.state = next;
            if (next.peerCount > 0 && !entry.connected) { entry.connected = true; connected.add(entry); }
            if (next.peerCount === 0 && entry.connected) { entry.connected = false; connected.delete(entry); if (presenter === entry) presenter = undefined; resumeEntries.delete(binding.bindingId); listeningBindings.delete(binding.bindingId); entry.receiver?.close(); if (!disposed) enqueue(listen); }
            aggregate(entry);
          });
        } catch (error) {
          if (!disposed && !(error instanceof DOMException && error.name === 'AbortError')) enqueue(listen);
          else listeningBindings.delete(binding.bindingId);
        }
      };
      await listen();
    }));
  };
  const allocate = async (): Promise<void> => {
    if (disposed || pairing) return;
    const room = await createPairingSession(config.relayUrl, abort.signal, (url) => context.validateNativeOrigin('signaling', url));
    if (disposed) { await room.close(); return; }
    const asset = await context.secureWebRtcCryptoAsset();
    const initialState: ReceiverState = { status: 'connecting', command: null, presentationEpoch: 0, stream: null, peerCount: 0, error: null };
    const pendingStates: ReceiverState[] = [];
    const entry: ReceiverEntry = { room, state: initialState, connected: false, revokedEpoch: 0 };
    const applyState = (next: ReceiverState): void => {
      entry.state = next;
      if (next.peerCount > 0 && !entry.connected) { entry.connected = true; connected.add(entry);
        if (pairing === entry) { pairing = undefined; clearTimeout(renewal); enqueue(allocate); } }
      if (next.peerCount === 0 && entry.connected) { entry.connected = false; enqueue(() => disposeEntry(entry)); return; }
      aggregate(entry);
    };
    let initialized = false;
    entry.receiver = createPluginReceiver(room.options, asset, (next) => { if (initialized) applyState(next); else pendingStates.push(next); }, async (binding) => {
      const receiverBinding = { bindingId: binding.bindingId, resumePassword: binding.resumePassword, expiresAt: binding.expiresAt };
      const bindings = await context.castResume.get();
      await context.castResume.replace([...bindings.filter((item) => item.bindingId !== binding.bindingId), receiverBinding]);
      if (listeningBindings.has(binding.bindingId)) return;
      listeningBindings.add(binding.bindingId);
      void createResumeSession(config.relayUrl, binding.bindingId, decode(binding.resumePassword), abort.signal).then((options) => {
        const resumeEntry: ReceiverEntry = { room: { options, roomCode: binding.bindingId, expiresAt: binding.expiresAt, close: () => Promise.resolve() },
          state: { status: 'connecting', command: null, presentationEpoch: 0, stream: null, peerCount: 0, error: null }, connected: false, revokedEpoch: 0 };
        resumeEntries.set(binding.bindingId, resumeEntry);
        resumeEntry.receiver = createPluginReceiver(options, asset, (next) => {
          resumeEntry.state = next;
          if (next.peerCount > 0 && !resumeEntry.connected) { resumeEntry.connected = true; connected.add(resumeEntry); }
          if (next.peerCount === 0 && resumeEntry.connected) { resumeEntry.connected = false; connected.delete(resumeEntry); if (presenter === resumeEntry) presenter = undefined; resumeEntries.delete(binding.bindingId); listeningBindings.delete(binding.bindingId); resumeEntry.receiver?.close(); enqueue(resume); }
          aggregate(resumeEntry);
        }, undefined, (bindingId) => context.castResume.delete(bindingId));
      }).catch(report);
    }, (bindingId) => context.castResume.delete(bindingId));
    pairing = entry; initialized = true; pendingStates.forEach(applyState); if (pairing === entry) publish({ roomCode: room.roomCode, error: null });
    if (pairing === entry) { clearTimeout(renewal); renewal = setTimeout(() => enqueue(async () => {
      if (pairing === entry) { await disposeEntry(entry); await allocate(); }
    }), Math.max(1_000, room.expiresAt - Date.now() - 30_000)); }
  };
  if (!config.relayUrl) report('Configure and approve a signaling origin.'); else { enqueue(resume); enqueue(allocate); }
  return { state, subscribe(listener) { listeners.add(listener); listener({ ...state }); return () => listeners.delete(listener); },
    close() { disposed = true; abort.abort(); clearTimeout(renewal); const entries = new Set([...resumeEntries.values(), ...connected, ...(pairing ? [pairing] : [])]);
      for (const entry of entries) entry.receiver?.close();
      resumeEntries.clear(); listeningBindings.clear(); connected.clear(); pairing = undefined; presenter = undefined; sasOwner = undefined; lifecycle = lifecycle.then(() => Promise.all([...entries].map((entry) => entry.room.close()))).then(() => undefined).catch(report); listeners.clear(); } };
}
