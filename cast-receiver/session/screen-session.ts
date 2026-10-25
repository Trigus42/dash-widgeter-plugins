import type { GuestWidgetContext } from '@/sandbox/sdk';
import { createPairingSession } from './pairing';
import { provisionReceiverResume } from './resume-lifecycle';
import { createResumeSession } from '@/core/cast/setup/receiver-client';
import { applyCastQueueMutation, createCastQueueSnapshot, decode, type CastQueueSnapshot, type CastSessionOptions } from '@/cast-protocol';
import type { DataMessage } from '@/core/cast/protocol/data-message';
import { createPluginReceiver, type PluginReceiver, type ReceiverState } from '../receiver';
import { readCastConfig } from '../config/resolve';
import { publicFailure } from '@/protocol/telemetry';

const CAST_UNAVAILABLE_MESSAGE = publicFailure('dependency_transport', 'The plugin service is temporarily unavailable.').message;


export interface ScreenSession {
  state: ReceiverState & { roomJoinCode: string; authCode: string; relayUrl: string; senderUrl: string; queue: CastQueueSnapshot; pairingReveal: number; pairingVisible: boolean };
  subscribe(listener: (state: ScreenSession['state']) => void): () => void;
  confirmSas(accepted: boolean): void;
  close(): void;
}
interface ReceiverEntry { room: { options: CastSessionOptions; roomJoinCode: string; authCode: string; expiresAt: number; close(): Promise<void> }; receiver?: PluginReceiver; state: ReceiverState; connected: boolean; trusted: boolean; resumeBinding?: { bindingId: string; resumePassword: string; expiresAt: number; ownerCapability: string }; bindingInstall?: Promise<void>; revokedEpoch: number; epochOffset: number }
type TimerHandle = number | NodeJS.Timeout;


export function createScreenSession(context: GuestWidgetContext): ScreenSession {
  const config = readCastConfig(context.config);
  const state: ScreenSession['state'] = { status: 'connecting', command: null, presentationEpoch: 0, stream: null, peerCount: 0, error: null,
    roomJoinCode: '', authCode: '', relayUrl: config.relayUrl, senderUrl: config.senderUrl, queue: createCastQueueSnapshot(config.autoplay), pairingReveal: 0, pairingVisible: false };
  const listeners = new Set<(state: ScreenSession['state']) => void>();
  const listeningBindings = new Set<string>();
  const pendingBindingInstalls = new Map<string, Promise<void>>();
  const resumeEntries = new Map<string, ReceiverEntry>();
  const dormantBindings = new Map<string, NonNullable<ReceiverEntry['resumeBinding']>>();
  const connected = new Set<ReceiverEntry>(); const abort = new AbortController();
  const pendingConnectionEvents = new Map<ReceiverEntry, Array<{ generation: string; trusted: boolean }>>();
  let pairing: ReceiverEntry | undefined, livePresenter: ReceiverEntry | undefined, sasOwner: ReceiverEntry | undefined, renewal: TimerHandle | undefined, sasTimer: TimerHandle | undefined, disposed = false;
  let authoritativeEpoch = 0;
  let lifecycle: Promise<void> = Promise.resolve();
  let observedDecisionVersion = 0;
  const publish = (patch: Partial<ScreenSession['state']>): void => {
    if ('sas' in patch && patch.sas === undefined) delete state.sas;
    if ('sasTrusted' in patch && patch.sasTrusted === undefined) delete state.sasTrusted;
    if (state.sasTrusted === true && patch.sasTrusted === undefined) delete patch.sasTrusted;
    Object.assign(state, patch); listeners.forEach((listener) => listener({ ...state }));
    const hostState = { status: state.status, command: state.command, presentationEpoch: state.presentationEpoch, peerCount: state.peerCount, error: state.error,
      roomJoinCode: state.roomJoinCode, authCode: state.authCode, relayUrl: state.relayUrl, senderUrl: state.senderUrl, pairingReveal: state.pairingReveal, pairingVisible: state.pairingVisible,
      screenInstanceId: context.instanceId,
      ...(state.sas ? { sas: state.sas } : {}), ...(state.sasTrusted === undefined ? {} : { sasTrusted: state.sasTrusted }) };
    void context.setCastState(hostState).catch((cause: unknown) => {
      context.telemetry.failure({ operation: 'cast.state.publish', category: 'dependency_transport', cause });
    });
  };
  const report = (cause: unknown): void => {
    context.telemetry.disclose({ operation: 'cast.session', category: 'dependency_transport', cause, publicMessage: CAST_UNAVAILABLE_MESSAGE });
    publish({ status: 'error', error: CAST_UNAVAILABLE_MESSAGE });
  };
  const enqueue = (operation: () => Promise<void>): void => { lifecycle = lifecycle.then(operation).catch(report); };
  const dismissalInterval = context.getCastState ? window.setInterval(() => {
    void context.getCastState().then((hostState) => {
      const action = hostState?.sasDecision;
      if (disposed || !action || typeof action !== 'object') return;
      const record = action as Record<string, unknown>;
      if (!Number.isSafeInteger(record.version) || Number(record.version) <= observedDecisionVersion) return;
      observedDecisionVersion = Number(record.version);
      if (record.action === 'unlink') {
        const entries = [...connected];
        entries.forEach((entry) => { connected.delete(entry); entry.receiver?.close(); void entry.room.close(); });
        resumeEntries.clear(); dormantBindings.clear(); listeningBindings.clear(); livePresenter = undefined;
        publish({ peerCount: 0, command: null, stream: null, status: 'disconnected' });
        return;
      }
      if (!sasOwner || record.action !== 'sas' || record.sas !== state.sas
          || (record.decision !== 'accept' && record.decision !== 'dismiss')) return;
      const entry = sasOwner; sasOwner = undefined; clearTimeout(sasTimer);
      entry.receiver?.confirmSas(record.decision === 'accept');
      if (record.decision === 'dismiss') entry.trusted = false;
      delete state.sas; delete state.sasTrusted; publish({});
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
        publish({ ...latest, presentationEpoch: authoritativeEpoch, peerCount: connected.size, roomJoinCode: state.roomJoinCode, authCode: state.authCode });
      } else if (livePresenter === entry && globalEpoch === authoritativeEpoch) publish({ stream: latest.stream, command: latest.command, status: latest.status, peerCount: connected.size });
    } else if (livePresenter === entry && state.stream !== null && latest.presentationEpoch > entry.revokedEpoch
        && latest.presentationEpoch + entry.epochOffset === authoritativeEpoch) {
      livePresenter = undefined; publish({ stream: null, command: null, status: connected.size > 0 ? 'paired' : 'disconnected', peerCount: connected.size, roomJoinCode: state.roomJoinCode, authCode: state.authCode });
    } else publish({ peerCount: connected.size, roomJoinCode: state.roomJoinCode, authCode: state.authCode });
    if (latest.sas && sasOwner !== entry) {
      sasOwner = entry;
      delete state.sas;
      publish({ sasTrusted: true });
      return;
    }
    if (sasOwner === entry && latest.sasTrusted === true) {
      sasOwner = undefined;
      clearTimeout(sasTimer);
      delete state.sas;
      publish({ sasTrusted: true });
      context.reportStatus(latest.error ? 'error' : 'ok', latest.error ?? '');
      return;
    }
    publish({});
    context.reportStatus(latest.error ? 'error' : 'ok', latest.error ?? '');
  };
  const disposeEntry = async (entry: ReceiverEntry): Promise<void> => {
    connected.delete(entry); if (pairing === entry) pairing = undefined; if (sasOwner === entry) sasOwner = undefined; entry.receiver?.close();
    publish({ peerCount: connected.size, status: state.command || state.stream ? 'casting' : connected.size > 0 ? 'paired' : 'disconnected' });
    await entry.room.close();
  };
  const startResumeBinding = async (binding: NonNullable<ReceiverEntry['resumeBinding']>): Promise<void> => {
    if (listeningBindings.has(binding.bindingId)) return;
    listeningBindings.add(binding.bindingId);
    const listen = async (): Promise<void> => {
      try {
        const options = await createResumeSession(config.relayUrl, binding.bindingId, decode(binding.resumePassword), binding.ownerCapability, abort.signal);
        const asset = await context.secureWebRtcCryptoAsset();
        const entry: ReceiverEntry = { room: { options, roomJoinCode: '', authCode: '', expiresAt: binding.expiresAt, close: () => Promise.resolve() },
          state: { status: 'connecting', command: null, presentationEpoch: 0, stream: null, peerCount: 0, error: null }, connected: false, trusted: true, resumeBinding: binding, revokedEpoch: 0, epochOffset: authoritativeEpoch };
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
        await entry.receiver.listening;
      } catch (cause) {
        listeningBindings.delete(binding.bindingId);
        if (!abort.signal.aborted) context.telemetry.failure({ operation: 'cast.resume.listen', category: 'dependency_transport', cause });
      }
    };
    await listen();
  };
  const resume = async (): Promise<void> => {
    const bindings = context.castResume ? await context.castResume.get() : [];
    for (const binding of bindings) {
      if (!dormantBindings.has(binding.bindingId)) {
        void startResumeBinding(binding).catch((cause: unknown) => {
          if (!abort.signal.aborted) context.telemetry.failure({ operation: 'cast.resume.start', category: 'dependency_transport', cause });
        });
      }
    }
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
        entry.receiver?.close(); const settle = entry.bindingInstall ?? Promise.resolve(); void settle.then(() => { const binding = entry.resumeBinding; if (!binding) { void entry.room.close(); return; } dormantBindings.set(binding.bindingId, binding); if (connected.size === 0) { const pending = [...dormantBindings.values()]; dormantBindings.clear(); pending.forEach((candidate) => void startResumeBinding(candidate)); } }, () => { void entry.room.close(); });
        publish({ peerCount: connected.size, status: state.command || state.stream ? 'casting' : connected.size ? 'paired' : 'disconnected' }); return;
      }
      aggregate(entry);
    };
    let initialized = false;
    const installBinding = async (binding: { bindingId: string; resumePassword: string; expiresAt: number }): Promise<void> => {
      await provisionReceiverResume(config.relayUrl, room, binding, context.castResume, abort.signal);
      entry.resumeBinding = { ...binding, ownerCapability: room.ownerCapability };
    };
    entry.receiver = createPluginReceiver(room.options, asset, (next) => { if (initialized) applyState(next); else pendingStates.push(next); }, (binding) => {
      const existing = pendingBindingInstalls.get(binding.bindingId); if (existing) return existing;
      const install = installBinding(binding); entry.bindingInstall = install; pendingBindingInstalls.set(binding.bindingId, install);
      void install.finally(() => { if (pendingBindingInstalls.get(binding.bindingId) === install) pendingBindingInstalls.delete(binding.bindingId); }).catch(() => undefined);
      return install;
    }, async (bindingId) => {
      dormantBindings.delete(bindingId);
      await context.castResume.delete(bindingId);
      const resumeEntry = resumeEntries.get(bindingId);
      if (resumeEntry) { resumeEntries.delete(bindingId); listeningBindings.delete(bindingId); connected.delete(resumeEntry); resumeEntry.receiver?.close(); }
    }, authenticatedMessage(entry), (event) => {
      if (!initialized) { const pending = pendingConnectionEvents.get(entry) ?? []; pending.push(event); pendingConnectionEvents.set(entry, pending); return; }
      applyConnection(entry, room.options.generation, event);
    });
    pairing = entry; initialized = true; pendingStates.forEach(applyState);
    for (const event of pendingConnectionEvents.get(entry) ?? []) applyConnection(entry, room.options.generation, event);
    pendingConnectionEvents.delete(entry); if (pairing === entry) publish({ roomJoinCode: room.roomJoinCode, authCode: room.authCode, error: null });
    if (pairing === entry) { clearTimeout(renewal); renewal = setTimeout(() => enqueue(async () => {
      if (pairing === entry) { await disposeEntry(entry); await allocate(); }
    }), Math.max(1_000, room.expiresAt - Date.now() - 30_000)); }
  };
  if (!config.relayUrl) report('Configure and approve a signaling origin.'); else { enqueue(resume); enqueue(allocate); }
  return { state, subscribe(listener) { listeners.add(listener); listener({ ...state }); return () => listeners.delete(listener); },
    confirmSas(accepted) { if (!sasOwner) return; const entry = sasOwner; entry.receiver?.confirmSas(accepted); sasOwner = undefined; clearTimeout(sasTimer); delete state.sas; delete state.sasTrusted; publish({}); },
    close() { disposed = true; abort.abort(); clearInterval(dismissalInterval); clearTimeout(renewal); clearTimeout(sasTimer); const entries = new Set([...resumeEntries.values(), ...connected, ...(pairing ? [pairing] : [])]);
      for (const entry of entries) { entry.receiver?.close(); if (!entry.resumeBinding) void entry.room.close(); }
      resumeEntries.clear(); dormantBindings.clear(); listeningBindings.clear(); connected.clear(); pairing = undefined; livePresenter = undefined; sasOwner = undefined; listeners.clear(); } };
}
