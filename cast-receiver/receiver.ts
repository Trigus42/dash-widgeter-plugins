import { createCastReceiver } from '@/core/cast/session';
import type { CastCommand, CastSessionOptions } from '@/cast-protocol';
import type { SpakeRuntimeAsset } from '@/core/cast/crypto/runtime';
import type { CastSessionStatus } from '@/core/cast/types';

export interface ReceiverState {
  status: CastSessionStatus;
  command: CastCommand | null;
  stream: MediaStream | null;
  peerCount: number;
  error: string | null;
  sas?: string;
  sasTrusted?: boolean;
}

export interface PluginReceiver { close(): void; confirmSas(accepted: boolean): void }
export function createPluginReceiver(options: CastSessionOptions, asset: SpakeRuntimeAsset, onState: (state: ReceiverState) => void): PluginReceiver {
  return createCastReceiver(options, (state) => onState({ ...state, stream: state.screenStream }), asset);
}
