
import type { CastOutputMode } from '@/cast-protocol';
import type { MediaAdapter } from '@/protocol/media';
export type CastSourceKind = 'idle' | 'website' | 'media' | 'youtube';

export interface CastCommand {
  /** Internal authenticated sender contract; static settings infer this from sourceUrl. */
  sourceKind: CastSourceKind;
  sourceUrl: string;
  adapter?: MediaAdapter;
  muted: boolean;
  paused?: boolean;
  volume?: number;
  outputMode: CastOutputMode;
}

export type CastOverlayMode = 'inline' | 'cover' | 'dim';


export interface CastConfig extends CastCommand {
  /** Inferred for static targets, or supplied by an authenticated sender command. */
  adapter: MediaAdapter;
  overlayMode: CastOverlayMode;
  relayUrl: string;
  senderUrl: string;
  autoplay: boolean;
  sasTimeoutSeconds: number;
  hidePairingWhileInactive: boolean;
  neverHidePairing: boolean;
}

export const CAST_DEFAULT_CONFIG: CastConfig = {
  sourceKind: 'idle',
  sourceUrl: '',
  adapter: 'video',
  relayUrl: '',
  senderUrl: '',
  outputMode: 'audio-video',
  overlayMode: 'inline',
  muted: false,
  autoplay: true,
  sasTimeoutSeconds: 60,
  hidePairingWhileInactive: false,
  neverHidePairing: false,
};
