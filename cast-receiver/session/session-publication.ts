import type { GuestWidgetContext } from '@/sandbox/sdk';
import type { CastQueueSnapshot } from '@/cast-protocol';
import type { ReceiverState } from '../receiver';

export type TimerHandle = number | NodeJS.Timeout;
export interface ScreenSession {
  state: ReceiverState & { roomJoinCode: string; authCode: string; relayUrl: string; senderUrl: string; queue: CastQueueSnapshot; pairingReveal: number; pairingVisible: boolean };
  subscribe(listener: (state: ScreenSession['state']) => void): () => void;
  close(): void;
}

export function publishSessionState(context: GuestWidgetContext, sessionId: string, state: ScreenSession['state'], patch: Partial<ScreenSession['state']>, listeners: Set<(state: ScreenSession['state']) => void>): void {
  if ('stream' in patch && !('relayMedia' in patch)) patch.relayMedia = null;
  if ('sas' in patch && patch.sas === undefined) delete state.sas;
  if ('sasTrusted' in patch && patch.sasTrusted === undefined) delete state.sasTrusted;
  if (state.sasTrusted === true && patch.sasTrusted === undefined) delete patch.sasTrusted;
  Object.assign(state, patch); listeners.forEach((listener) => listener({ ...state }));
  const hostState = { status: state.status, command: state.command, presentationEpoch: state.presentationEpoch, peerCount: state.peerCount, error: state.error,
    roomJoinCode: state.roomJoinCode, authCode: state.authCode, relayUrl: state.relayUrl, senderUrl: state.senderUrl, pairingReveal: state.pairingReveal, pairingVisible: state.pairingVisible,
    screenInstanceId: context.instanceId, sessionId,
    ...(state.sas ? { sas: state.sas } : {}), ...(state.sasTrusted === undefined ? {} : { sasTrusted: state.sasTrusted }) };
  void context.setCastState(hostState).catch((cause: unknown) => {
    context.telemetry.failure({ operation: 'cast.state.publish', category: 'dependency_transport', cause });
  });
}
