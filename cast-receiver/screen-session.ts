import type { GuestWidgetContext } from '@/sandbox/sdk';
import { createPairingSession } from './pairing';
import { createResumeSession } from '@/core/cast/receiver-client';
import { applyCastQueueMutation, createCastQueueSnapshot, decode, type CastQueueSnapshot, type CastSessionOptions } from '@/cast-protocol';
import type { DataMessage } from '@/core/cast/data-message';
import { createPluginReceiver, type PluginReceiver, type ReceiverState } from './receiver';
import { readCastConfig } from './resolve';

export interface ScreenSession {
  state: ReceiverState & { roomCode: string; relayUrl: string; senderUrl: string; queue: CastQueueSnapshot; pairingReveal: number; pairingVisible: boolean };
  subscribe(listener: (state: ScreenSession['state']) => void): () => void;
  confirmSas(accepted: boolean): void;
  close(): void;
}
interface ReceiverEntry { room: { options: CastSessionOptions; roomCode: string; expiresAt: number; close(): Promise<void> }; receiver?: PluginReceiver; state: ReceiverState; connected: boolean; trusted: boolean; revokedEpoch: number; epochOffset: number }
type TimerHandle = number | NodeJS.Timeout;


export function createScreenSession(context: GuestWidgetContext): ScreenSession {
  const config = readCastConfig(context.config);
  const state: ScreenSession['state'] = { status: 'connecting', command: null, presentationEpoch: 0, stream: null, peerCount: 0, error: null,
    roomCode: '', relayUrl: config.relayUrl, senderUrl: config.senderUrl, queue: createCastQueueSnapshot(config.autoplay), pairingReveal: 0, pairingVisible: false };
  const listeners = new Set<(state: ScreenSession['state']) => void>();
  const listeningBindings = new Set<string>();
  const resumeEntries = new Map<string, ReceiverEntry>();
  const connected = new Set<ReceiverEntry>(); const abort = new AbortController();
  const pendingConnectionEvents = new Map<ReceiverEntry, Array<{ generation: string; trusted: boolean }>>();
  let pairing: ReceiverEntry | undefined, livePresenter: ReceiverEntry | undefined, sasOwner: ReceiverEntry | undefined, renewal: TimerHandle | undefined, sasTimer: TimerHandle | undefined, disposed = false;
  let authoritativeEpoch = 0;
  let lifecycle: Promise<void> = Promise.resolve();
  let observedDismissSas: unknown;
  const publish = (patch: Partial<ScreenSession['state']>): void => {
    if ('sas' in patch && patch.sas === undefined) delete state.sas;
    if ('sasTrusted' in patch && patch.sasTrusted === undefined) delete state.sasTrusted;
    if (state.sasTrusted === true && patch.sasTrusted === undefined) delete patch.sasTrusted;
    Object.assign(state, patch); listeners.forEach((listener) => listener({ ...state }));
    const hostState = { status: state.status, command: state.command, presentationEpoch: state.presentationEpoch, peerCount: state.peerCount, error: state.error,
      roomCode: state.roomCode, relayUrl: state.relayUrl, senderUrl: state.senderUrl, pairingReveal: state.pairingReveal, pairingVisible: state.pairingVisible,
      ...(state.sas ? { sas: state.sas } : {}), ...(state.sasTrusted === undefined ? {} : { sasTrusted: state.sasTrusted }) };
    void context.setCastState(hostState);
  };
  const report = (error: unknown): void => publish({ status: 'error', error: error instanceof Error ? error.message : String(error) });
  const enqueue = (operation: () => Promise<void>): void => { lifecycle = lifecycle.then(operation).catch(report); };
  const dismissalInterval = context.getCastState ? window.setInterval(() => {
    void context.getCastState().then((hostState) => {
      const dismissed = hostState?.dismissSas;
      if (dismissed === undefined || dismissed === observedDismissSas) return;
      observedDismissSas = dismissed;
      if (!sasOwner) return;
      const entry = sasOwner;
      sasOwner = undefined;
      clearTimeout(sasTimer);
      entry.receiver?.confirmSas(false);
      entry.trusted = false;
      delete state.sas;
      delete state.sasTrusted;
      publish({});
    }).catch(report);
  }, 200) : undefined;
  const applyConnection = (entry: ReceiverEntry, expectedGeneration: string, event: { generation: string; trusted: boolean }): void => {
    if (event.generation !== expectedGeneration) return;
    entry.trusted = event.trusted;
    if (event.trusted) { delete state.sas; publish({ sasTrusted: true }); entry.receiver?.send?.({ type: 'queue-snapshot', snapshot: state.queue, conflict: false, pairingVisible: state.pairingVisible }); }
  };
  const broadcastQueue = (conflictEntry?: ReceiverEntry): void => {
    for (const entry of connected) if (entry.trusted) entry.receiver?.send?.({ type: 'queue-snapshot', snapshot: state.queue, conflict: entry === conflictEntry, pairingVisible: state.pairingVisible });
  };
  const authenticatedMessage = (entry: ReceiverEntry) => (message: Extract<DataMessage, { type: 'queue-mutation' | 'pair-display-request' }>, send: (outgoing: DataMessage) => void): void => {
    if (!entry.trusted) return;
    if (message.type === 'pair-display-request') {
      publish({ pairingVisible: message.visible, pairingReveal: message.visible ? state.pairingReveal + 1 : state.pairingReveal });
      broadcastQueue();
      return;
    }
    const next = applyCastQueueMutation(state.queue, message.mutation);
    if (!next) { send({ type: 'queue-snapshot', snapshot: state.queue, conflict: true, pairingVisible: state.pairingVisible }); return; }
    state.queue = next;
    const current = next.items.find((item) => item.id === next.currentItemId);
    const sourceChanged = Boolean(current && (state.command?.sourceKind !== current.command.sourceKind || state.command.sourceUrl !== current.command.sourceUrl));
    const command = current ? { ...current.command, outputMode: next.outputMode } : null;
    if (current && sourceChanged) {
      authoritativeEpoch += 1; entry.epochOffset = authoritativeEpoch - entry.state.presentationEpoch;
      if (livePresenter) { livePresenter.revokedEpoch = Math.max(livePresenter.revokedEpoch, livePresenter.state.presentationEpoch); livePresenter.receiver?.revokePresenter(livePresenter.state.presentationEpoch); livePresenter = undefined; }
      publish({ queue: next, command, stream: null, presentationEpoch: authoritativeEpoch, status: 'casting' });
    } else if (!current && next.currentItemId === null && state.command && next.items.length === 0) {
      authoritativeEpoch += 1; livePresenter = undefined;
      publish({ queue: next, command: null, stream: null, presentationEpoch: authoritativeEpoch, status: connected.size ? 'paired' : 'disconnected' });
    } else publish({ queue: next, ...(command ? { command } : {}) });
    broadcastQueue();
  };
  const aggregate = (entry: ReceiverEntry): void => {
    const latest = entry.state;
    const live = latest.stream !== null;
    const command = latest.command !== null && latest.command.sourceKind !== 'idle';
    const stale = latest.presentationEpoch <= entry.revokedEpoch;
    if ((live || command) && !stale) {
      const epoch = latest.presentationEpoch;
      if (livePresenter !== entry && latest.presentationEpoch > entry.revokedEpoch && epoch <= authoritativeEpoch) {
        entry.epochOffset = authoritativeEpoch + 1 - latest.presentationEpoch;
      }
      const globalEpoch = latest.presentationEpoch + entry.epochOffset;
      if (globalEpoch > authoritativeEpoch) {
        authoritativeEpoch = globalEpoch;
        if (livePresenter && livePresenter !== entry) { livePresenter.revokedEpoch = Math.max(livePresenter.revokedEpoch, livePresenter.state.presentationEpoch); livePresenter.receiver?.revokePresenter(livePresenter.state.presentationEpoch); }
        livePresenter = entry;
        publish({ ...latest, presentationEpoch: authoritativeEpoch, peerCount: connected.size, roomCode: state.roomCode });
      } else if (livePresenter === entry && (live || command) && globalEpoch === authoritativeEpoch) publish({ stream: latest.stream, command: latest.command, status: latest.status, peerCount: connected.size });
    } else publish({ peerCount: connected.size, roomCode: state.roomCode });
    if (latest.sas && sasOwner !== entry) {
      sasOwner = entry; delete state.sasTrusted; clearTimeout(sasTimer); sasTimer = setTimeout(() => {
        if (sasOwner === entry) { sasOwner = undefined; entry.receiver?.confirmSas(false); entry.trusted = false; delete state.sas; delete state.sasTrusted; publish({}); }
      }, config.sasTimeoutSeconds * 1_000);
    }
    if (sasOwner === entry && latest.sasTrusted === true) {
      sasOwner = undefined; clearTimeout(sasTimer); delete state.sas;
      publish({ sasTrusted: true }); context.reportStatus(latest.error ? 'error' : 'ok', latest.error ?? ''); return;
    }
    if (sasOwner === entry && !latest.sas) { sasOwner = undefined; clearTimeout(sasTimer); }
    const ownedSas = sasOwner?.state.sas;
    if (!ownedSas) { delete state.sas; if (state.sasTrusted !== true) delete state.sasTrusted; }
    publish({ ...(ownedSas ? { sas: ownedSas } : {}),
      ...(ownedSas && sasOwner?.state.sasTrusted !== undefined ? { sasTrusted: sasOwner.state.sasTrusted } : {}) });
    context.reportStatus(latest.error ? 'error' : 'ok', latest.error ?? '');
  };
  const disposeEntry = async (entry: ReceiverEntry): Promise<void> => {
    connected.delete(entry); if (pairing === entry) pairing = undefined; if (sasOwner === entry) sasOwner = undefined; entry.receiver?.close();
    publish({ peerCount: connected.size, status: state.command || state.stream ? 'casting' : connected.size > 0 ? 'paired' : 'disconnected' });
    await entry.room.close();
  };
  const resume = async (): Promise<void> => {
    const bindings = context.castResume ? await context.castResume.get() : [];
    await Promise.all(bindings.map(async (binding) => {
      if (listeningBindings.has(binding.bindingId)) return;
      listeningBindings.add(binding.bindingId);
      const listen = async (): Promise<void> => {
        try {
          const options = await createResumeSession(config.relayUrl, binding.bindingId, decode(binding.resumePassword), abort.signal);
          const asset = await context.secureWebRtcCryptoAsset();
          const entry: ReceiverEntry = { room: { options, roomCode: binding.bindingId, expiresAt: binding.expiresAt, close: () => Promise.resolve() },
            state: { status: 'connecting', command: null, presentationEpoch: 0, stream: null, peerCount: 0, error: null }, connected: false, trusted: true, revokedEpoch: 0, epochOffset: authoritativeEpoch };
          resumeEntries.set(binding.bindingId, entry);
          entry.receiver = createPluginReceiver(options, asset, (next) => {
            entry.state = next;
            if (next.peerCount > 0 && !entry.connected) { entry.connected = true; connected.add(entry); entry.receiver?.send?.({ type: 'queue-snapshot', snapshot: state.queue, conflict: false, pairingVisible: state.pairingVisible }); }
            if (next.peerCount === 0 && entry.connected) {
              entry.connected = false; connected.delete(entry); resumeEntries.delete(binding.bindingId); listeningBindings.delete(binding.bindingId);
              if (sasOwner === entry) { sasOwner = undefined; clearTimeout(sasTimer); }
              entry.receiver?.close(); publish({ peerCount: connected.size, status: state.command || state.stream ? 'casting' : connected.size ? 'paired' : 'disconnected' });
              if (!disposed) enqueue(listen); return;
            }
            aggregate(entry);
          }, undefined, context.castResume ? (bindingId) => context.castResume.delete(bindingId) : undefined, authenticatedMessage(entry), ({ trusted }) => { entry.trusted = trusted; if (trusted) { delete state.sas; publish({ sasTrusted: true }); } });
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
    const entry: ReceiverEntry = { room, state: initialState, connected: false, trusted: false, revokedEpoch: 0, epochOffset: authoritativeEpoch };
    const applyState = (next: ReceiverState): void => {
      entry.state = next;
      if (next.peerCount > 0 && !entry.connected) { entry.connected = true; connected.add(entry);
        if (entry.trusted) entry.receiver?.send?.({ type: 'queue-snapshot', snapshot: state.queue, conflict: false, pairingVisible: state.pairingVisible });
        if (pairing === entry) { pairing = undefined; clearTimeout(renewal); enqueue(allocate); } }
      if (next.peerCount === 0 && entry.connected) {
        entry.connected = false; connected.delete(entry); if (sasOwner === entry) { sasOwner = undefined; clearTimeout(sasTimer); }
        entry.receiver?.close(); void entry.room.close();
        publish({ peerCount: connected.size, status: state.command || state.stream ? 'casting' : connected.size ? 'paired' : 'disconnected' }); return;
      }
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
          state: { status: 'connecting', command: null, presentationEpoch: 0, stream: null, peerCount: 0, error: null }, connected: false, trusted: true, revokedEpoch: 0, epochOffset: authoritativeEpoch };
        resumeEntries.set(binding.bindingId, resumeEntry);
        resumeEntry.receiver = createPluginReceiver(options, asset, (next) => {
          resumeEntry.state = next;
          if (next.peerCount > 0 && !resumeEntry.connected) { resumeEntry.connected = true; connected.add(resumeEntry); resumeEntry.receiver?.send?.({ type: 'queue-snapshot', snapshot: state.queue, conflict: false, pairingVisible: state.pairingVisible }); }
          if (next.peerCount === 0 && resumeEntry.connected) {
            resumeEntry.connected = false; connected.delete(resumeEntry); resumeEntries.delete(binding.bindingId); listeningBindings.delete(binding.bindingId);
            if (sasOwner === resumeEntry) { sasOwner = undefined; clearTimeout(sasTimer); }
            resumeEntry.receiver?.close(); publish({ peerCount: connected.size, status: state.command || state.stream ? 'casting' : connected.size ? 'paired' : 'disconnected' });
            enqueue(resume); return;
          }
          aggregate(resumeEntry);
        }, undefined, (bindingId) => context.castResume.delete(bindingId), authenticatedMessage(resumeEntry), ({ trusted }) => { resumeEntry.trusted = trusted; if (trusted) { delete state.sas; publish({ sasTrusted: true }); } });
      }).catch(report);
    }, (bindingId) => context.castResume.delete(bindingId), authenticatedMessage(entry), (event) => {
      if (!initialized) { const pending = pendingConnectionEvents.get(entry) ?? []; pending.push(event); pendingConnectionEvents.set(entry, pending); return; }
      applyConnection(entry, room.options.generation, event);
    });
    pairing = entry; initialized = true; pendingStates.forEach(applyState);
    for (const event of pendingConnectionEvents.get(entry) ?? []) applyConnection(entry, room.options.generation, event);
    pendingConnectionEvents.delete(entry); if (pairing === entry) publish({ roomCode: room.roomCode, error: null });
    if (pairing === entry) { clearTimeout(renewal); renewal = setTimeout(() => enqueue(async () => {
      if (pairing === entry) { await disposeEntry(entry); await allocate(); }
    }), Math.max(1_000, room.expiresAt - Date.now() - 30_000)); }
  };
  if (!config.relayUrl) report('Configure and approve a signaling origin.'); else { enqueue(resume); enqueue(allocate); }
  return { state, subscribe(listener) { listeners.add(listener); listener({ ...state }); return () => listeners.delete(listener); },
    confirmSas(accepted) { if (!sasOwner) return; const entry = sasOwner; entry.receiver?.confirmSas(accepted); sasOwner = undefined; clearTimeout(sasTimer); delete state.sas; delete state.sasTrusted; publish({}); },
    close() { disposed = true; abort.abort(); clearInterval(dismissalInterval); clearTimeout(renewal); clearTimeout(sasTimer); const entries = new Set([...resumeEntries.values(), ...connected, ...(pairing ? [pairing] : [])]);
      for (const entry of entries) entry.receiver?.close();
      resumeEntries.clear(); listeningBindings.clear(); connected.clear(); pairing = undefined; livePresenter = undefined; sasOwner = undefined; lifecycle = lifecycle.then(() => Promise.all([...entries].map((entry) => entry.room.close()))).then(() => undefined).catch(report); listeners.clear(); } };
}
