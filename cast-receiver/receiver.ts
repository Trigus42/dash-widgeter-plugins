import { createCastReceiver } from '@/core/cast/session';
import type { CastCommand, CastSessionOptions } from '@/cast-protocol';
import type { DataMessage } from '@/core/cast/protocol/data-message';
import type { SpakeRuntimeAsset } from '@/core/cast/crypto/runtime';
import type { CastReceiverState, CastSessionStatus } from '@/core/cast/types';
import type { TelemetrySink } from '@/protocol/telemetry';

export interface ReceiverState {
  status: CastSessionStatus;
  command: CastCommand | null;
  presentationEpoch: number;
  stream: MediaStream | null;
  relayMedia?: CastReceiverState['relayMedia'];
  peerCount: number;
  error: string | null;
  sas?: string;
  sasTrusted?: boolean;
}

export interface PluginReceiver { readonly listening: Promise<void>; close(): void; confirmSas(accepted: boolean): void; revokePresenter(epoch: number): void; send(message: DataMessage): void }
export function createPluginReceiver(options: CastSessionOptions, asset: SpakeRuntimeAsset, onState: (state: ReceiverState) => void,
  onResumeBinding?: (binding: { bindingId: string; resumePassword: string; expiresAt: number }) => Promise<void>,
  onResumeRevoke?: (bindingId: string) => Promise<void>,
  onAuthenticatedMessage?: (message: Extract<DataMessage, { type: 'queue-mutation' | 'pair-display-request' }>, send: (message: DataMessage) => void) => void,
  onConnection?: (event: { generation: string; trusted: boolean }) => void, telemetry?: TelemetrySink): PluginReceiver {
  return createCastReceiver(options, (state) => onState({ status: state.status, command: state.command, presentationEpoch: state.presentationEpoch,
    stream: state.screenStream, ...(state.relayMedia === undefined ? {} : { relayMedia: state.relayMedia }), peerCount: state.peerCount, error: state.error, ...(state.sas ? { sas: state.sas } : {}), ...(state.sasTrusted === undefined ? {} : { sasTrusted: state.sasTrusted }) }), asset, onResumeBinding, onResumeRevoke, onAuthenticatedMessage, onConnection, telemetry);
}
