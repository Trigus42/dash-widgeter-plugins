
export type CastSourceKind = 'idle' | 'website' | 'media' | 'youtube';

export interface CastCommand {
  sourceKind: CastSourceKind;
  sourceUrl: string;
  muted: boolean;
  paused?: boolean;
  volume?: number;
}

export type CastOverlayMode = 'inline' | 'cover' | 'dim';


export interface CastConfig extends CastCommand {
  overlayMode: CastOverlayMode;
  relayUrl: string;
  senderUrl: string;
}

export const CAST_DEFAULT_CONFIG: CastConfig = {
  sourceKind: 'idle',
  sourceUrl: '',
  relayUrl: '',
  senderUrl: '',
  overlayMode: 'inline',
  muted: false,
};
