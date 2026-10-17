import { createCastReceiver } from '@/core/cast/session';
import type { CastCommand, CastSessionOptions } from '@/cast-protocol';
import type { DataMessage } from '@/core/cast/protocol/data-message';
import type { SpakeRuntimeAsset } from '@/core/cast/crypto/runtime';
import type { CastSessionStatus } from '@/core/cast/types';

export interface ReceiverState {
  status: CastSessionStatus;
  command: CastCommand | null;
  presentationEpoch: number;
  stream: MediaStream | null;
  peerCount: number;
  error: string | null;
  sas?: string;
  sasTrusted?: boolean;
}

export interface PluginReceiver { close(): void; confirmSas(accepted: boolean): void; revokePresenter(epoch: number): void; send(message: DataMessage): void }
export function createPluginReceiver(options: CastSessionOptions, asset: SpakeRuntimeAsset, onState: (state: ReceiverState) => void,
  onResumeBinding?: (binding: { bindingId: string; resumePassword: string; expiresAt: number }) => Promise<void>,
  onResumeRevoke?: (bindingId: string) => Promise<void>,
  onAuthenticatedMessage?: (message: Extract<DataMessage, { type: 'queue-mutation' | 'pair-display-request' }>, send: (message: DataMessage) => void) => void,
  onConnection?: (event: { generation: string; trusted: boolean }) => void): PluginReceiver {
  return createCastReceiver(options, (state) => onState({ status: state.status, command: state.command, presentationEpoch: state.presentationEpoch,
    stream: state.screenStream, peerCount: state.peerCount, error: state.error, ...(state.sas ? { sas: state.sas } : {}), ...(state.sasTrusted === undefined ? {} : { sasTrusted: state.sasTrusted }) }), asset, onResumeBinding, onResumeRevoke, onAuthenticatedMessage, onConnection);
}
