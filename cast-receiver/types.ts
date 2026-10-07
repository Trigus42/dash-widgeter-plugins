/**
 * Cast receiver config. The receiver renders a "cast target" full-bleed inside a
 * softened sandbox frame and is otherwise mostly invisible (showing only a
 * pairing code). Google Cast proper needs vendor certificates we don't have, so
 * this is an open, self-hosted receiver: a target is any https website, media
 * stream, or YouTube video the user (or a LAN sender) points it at.
 */

export type CastSourceKind = 'idle' | 'website' | 'media' | 'youtube';

/** How casting content layers over the rest of the dashboard. */
export type CastOverlayMode = 'inline' | 'cover' | 'dim';

export interface CastConfig {
  /** What to display: nothing (pairing code), a site, a media stream, a video. */
  sourceKind: CastSourceKind;
  /** The target URL (website/media) or YouTube video id/URL, per sourceKind. */
  sourceUrl: string;
  /**
   * Stable pairing code shown while idle, so a sender knows which receiver it is
   * controlling. Display-only here (no backend signaling in the sandbox).
   */
  pairingCode: string;
  /** How the cast content layers over other widgets while active. */
  overlayMode: CastOverlayMode;
  /** Show the pairing code + hint while idle (otherwise fully invisible). */
  showPairingWhenIdle: boolean;
  /** Mute embedded media/video by default (wall-display friendly). */
  muted: boolean;
}

export const CAST_DEFAULT_CONFIG: CastConfig = {
  sourceKind: 'idle',
  sourceUrl: '',
  pairingCode: '',
  overlayMode: 'cover',
  showPairingWhenIdle: true,
  muted: true,
};
