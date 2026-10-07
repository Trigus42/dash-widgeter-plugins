
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
}

export const CAST_DEFAULT_CONFIG: CastConfig = {
  sourceKind: 'idle',
  sourceUrl: '',
  overlayMode: 'cover',
  showPairingWhenIdle: true,
  muted: true,
};
