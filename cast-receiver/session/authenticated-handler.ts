import type { GuestWidgetContext } from '@/sandbox/sdk';
import type { AuthenticatedMessageHandler } from '@/core/cast/protocol/data-message';
import { applyReceivedQueueMutation } from './queue-application';
import type { ReceiverEntry } from './receiver-entry';
import type { ScreenSession } from './session-publication';
import type { ReceiverPlatformHandler } from './platform-handler';

interface AuthenticatedSessionContext {
  state: ScreenSession['state'];
  connected: Set<ReceiverEntry>;
  telemetry: GuestWidgetContext['telemetry'];
  platform: ReceiverPlatformHandler;
  current: (entry: ReceiverEntry) => boolean;
  publish: (patch: Partial<ScreenSession['state']>) => void;
  advanceEpoch: () => number;
  revokeLivePresenter: () => void;
}

export function createAuthenticatedHandler(context: AuthenticatedSessionContext): (entry: ReceiverEntry) => AuthenticatedMessageHandler {
  const { state, publish } = context;
  const broadcastQueue = (conflictEntry?: ReceiverEntry): void => {
    for (const entry of context.connected) if (context.current(entry)) entry.receiver?.send?.({ type: 'queue-snapshot', snapshot: state.queue, conflict: entry === conflictEntry, pairingVisible: state.pairingVisible });
  };
  const handler = (entry: ReceiverEntry): AuthenticatedMessageHandler => (message, send) => {
    if (!context.current(entry)) return;
    if (message.type === 'platform-request') {
      const receiver = entry.receiver;
      context.platform.enqueue(entry, message, send, () => context.current(entry) && entry.connected && entry.receiver === receiver);
      return;
    }
    if (message.type === 'pair-display-request') {
      publish({ pairingVisible: message.visible, pairingReveal: message.visible ? state.pairingReveal + 1 : state.pairingReveal });
      broadcastQueue();
      return;
    }
    const next = applyReceivedQueueMutation(state.queue, message.mutation, context.telemetry);
    if (!next) { send({ type: 'queue-snapshot', snapshot: state.queue, conflict: true, pairingVisible: state.pairingVisible }); return; }
    state.queue = next;
    const current = next.items.find((item) => item.id === next.currentItemId);
    const sourceChanged = Boolean(current && (state.command?.sourceKind !== current.command.sourceKind || state.command.sourceUrl !== current.command.sourceUrl));
    const command = current ? { ...current.command, outputMode: next.outputMode } : null;
    if (current && sourceChanged) {
      const epoch = context.advanceEpoch(); entry.epochOffset = epoch - entry.state.presentationEpoch;
      context.revokeLivePresenter();
      publish({ queue: next, command, stream: null, presentationEpoch: epoch, status: 'casting' });
    } else if (!current && next.currentItemId === null && state.command && next.items.length === 0) {
      const epoch = context.advanceEpoch();
      context.revokeLivePresenter();
      publish({ queue: next, command: null, stream: null, presentationEpoch: epoch, status: context.connected.size ? 'paired' : 'disconnected' });
    } else publish({ queue: next, ...(command ? { command } : {}) });
    broadcastQueue();
  };
  return handler;
}
