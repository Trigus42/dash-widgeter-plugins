import { createCastReceiver } from '@/core/cast/session';
import type { CastCommand, CastSessionOptions } from '@/cast-protocol';
import type { SpakeRuntimeAsset } from '@/core/cast/crypto/runtime';

export interface ReceiverState {
  status: 'idle' | 'connecting' | 'paired' | 'casting' | 'disconnected' | 'error';
  command: CastCommand | null;
  stream: MediaStream | null;
  peerCount: number;
  error: string | null;
  sas?: string;
}

export function createPluginReceiver(options: CastSessionOptions, asset: SpakeRuntimeAsset, onState: (state: ReceiverState) => void): () => void {
  return createCastReceiver(options, (state) => onState({ ...state, stream: state.screenStream }), asset);
}
