
export type CastSourceKind = 'idle' | 'website' | 'media' | 'youtube' | 'spotify';

export interface CastCommand {
  sourceKind: CastSourceKind;
  sourceUrl: string;
  muted: boolean;
}

export type CastOverlayMode = 'inline' | 'cover' | 'dim';


export interface CastConfig extends CastCommand {
  overlayMode: CastOverlayMode;
  showPairingWhenIdle: boolean;
  relayUrl: string;
  senderUrl: string;
}

export const CAST_DEFAULT_CONFIG: CastConfig = {
  sourceKind: 'idle',
  sourceUrl: '',
  relayUrl: '',
  senderUrl: '',
  overlayMode: 'cover',
  showPairingWhenIdle: true,
  muted: true,
};
