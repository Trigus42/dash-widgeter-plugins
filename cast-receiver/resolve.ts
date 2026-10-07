import { CAST_DEFAULT_CONFIG, type CastConfig, type CastSourceKind } from './types';

function str(raw: unknown, fallback: string): string {
  return typeof raw === 'string' ? raw : fallback;
}
function bool(raw: unknown, fallback: boolean): boolean {
  return typeof raw === 'boolean' ? raw : fallback;
}

const SOURCE_KINDS: CastSourceKind[] = ['idle', 'website', 'media', 'youtube'];
const OVERLAY_MODES = ['inline', 'cover', 'dim'] as const;

/** Coerce persisted (unknown JSON) config into a validated CastConfig. */
export function readCastConfig(raw: Record<string, unknown>): CastConfig {
  const d = CAST_DEFAULT_CONFIG;
  const sourceKind = SOURCE_KINDS.includes(raw.sourceKind as CastSourceKind)
    ? (raw.sourceKind as CastSourceKind)
    : d.sourceKind;
  const overlayMode = (OVERLAY_MODES as readonly string[]).includes(raw.overlayMode as string)
    ? (raw.overlayMode as CastConfig['overlayMode'])
    : d.overlayMode;
  return {
    sourceKind,
    sourceUrl: str(raw.sourceUrl, d.sourceUrl),
    pairingCode: str(raw.pairingCode, d.pairingCode),
    overlayMode,
    showPairingWhenIdle: bool(raw.showPairingWhenIdle, d.showPairingWhenIdle),
    muted: bool(raw.muted, d.muted),
  };
}

/** Extract a YouTube video id from an id, a watch URL, a youtu.be or embed URL. */
export function youTubeVideoId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  // A bare id (YouTube ids are 11 url-safe chars).
  if (/^[A-Za-z0-9_-]{11}$/.test(trimmed)) return trimmed;
  const patterns = [
    /[?&]v=([A-Za-z0-9_-]{11})/, // watch?v=ID
    /youtu\.be\/([A-Za-z0-9_-]{11})/, // youtu.be/ID
    /\/embed\/([A-Za-z0-9_-]{11})/, // /embed/ID
    /\/shorts\/([A-Za-z0-9_-]{11})/, // /shorts/ID
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(trimmed);
    if (match?.[1]) return match[1];
  }
  return null;
}

/** True only for an https URL — the receiver refuses non-TLS targets. */
export function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * What the receiver should render, derived purely from config. Returns a
 * discriminated result the widget maps to an <iframe>, a <video>, or the idle
 * pairing screen — never throws, so a half-entered target just stays idle.
 */
export type CastTarget =
  | { kind: 'idle' }
  | { kind: 'website'; url: string }
  | { kind: 'media'; url: string }
  | { kind: 'youtube'; embedUrl: string };

/** Privacy-friendly YouTube embed (nocookie) with autoplay/mute flags. */
export function youTubeEmbedUrl(videoId: string, muted: boolean): string {
  const params = new URLSearchParams({
    autoplay: '1',
    mute: muted ? '1' : '0',
    rel: '0',
    modestbranding: '1',
    playsinline: '1',
  });
  return `https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`;
}

export function resolveCastTarget(config: CastConfig): CastTarget {
  if (config.sourceKind === 'idle') return { kind: 'idle' };
  if (config.sourceKind === 'youtube') {
    const videoId = youTubeVideoId(config.sourceUrl);
    return videoId ? { kind: 'youtube', embedUrl: youTubeEmbedUrl(videoId, config.muted) } : { kind: 'idle' };
  }
  // website + media both require a concrete https URL.
  if (!isHttpsUrl(config.sourceUrl)) return { kind: 'idle' };
  return config.sourceKind === 'media'
    ? { kind: 'media', url: config.sourceUrl }
    : { kind: 'website', url: config.sourceUrl };
}
