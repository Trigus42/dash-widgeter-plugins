import { CAST_DEFAULT_CONFIG, type CastConfig, type CastSourceKind } from './types';

function str(raw: unknown, fallback: string): string {
  return typeof raw === 'string' ? raw : fallback;
}
function bool(raw: unknown, fallback: boolean): boolean {
  return typeof raw === 'boolean' ? raw : fallback;
}
function boundedSeconds(raw: unknown, fallback: number): number {
  return typeof raw === 'number' && Number.isInteger(raw) && raw >= 10 && raw <= 300 ? raw : fallback;
}

const SOURCE_KINDS: CastSourceKind[] = ['idle', 'website', 'media', 'youtube'];
const OVERLAY_MODES = ['inline', 'cover', 'dim'] as const;
const OUTPUT_MODES = ['audio-video', 'audio-only', 'video-only'] as const;

/** Coerce persisted (unknown JSON) config into a validated CastConfig. */
export function readCastConfig(raw: Record<string, unknown>): CastConfig {
  const d = CAST_DEFAULT_CONFIG;
  const sourceKind = SOURCE_KINDS.includes(raw.sourceKind as CastSourceKind)
    ? (raw.sourceKind as CastSourceKind)
    : d.sourceKind;
  const overlayMode = (OVERLAY_MODES as readonly string[]).includes(raw.overlayMode as string)
    ? (raw.overlayMode as CastConfig['overlayMode'])
    : d.overlayMode;
  const outputMode = (OUTPUT_MODES as readonly string[]).includes(raw.outputMode as string)
    ? raw.outputMode as CastConfig['outputMode'] : d.outputMode;
  return {
    sourceKind,
    sourceUrl: str(raw.sourceUrl, d.sourceUrl),
    relayUrl: str(raw.relayUrl, d.relayUrl),
    senderUrl: str(raw.senderUrl, d.senderUrl),
    overlayMode,
    muted: bool(raw.muted, d.muted),
    outputMode,
    autoplay: bool(raw.autoplay, d.autoplay),
    sasTimeoutSeconds: boundedSeconds(raw.sasTimeoutSeconds, d.sasTimeoutSeconds),
  };
}

export interface YouTubeTarget { videoId: string; playlistId?: string; index?: number }

/** Parse a YouTube id/URL while preserving only validated playlist navigation. */
export function parseYouTubeTarget(input: string): YouTubeTarget | null {
  const trimmed = input.trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(trimmed)) return { videoId: trimmed };
  let url: URL;
  try { url = new URL(trimmed); } catch { return null; }
  if (!['www.youtube.com', 'youtube.com', 'm.youtube.com', 'youtu.be', 'www.youtube-nocookie.com'].includes(url.hostname)) return null;
  const path = url.pathname.split('/').filter(Boolean);
  const candidate = url.hostname === 'youtu.be' ? path[0]
    : path[0] === 'embed' || path[0] === 'shorts' ? path[1] : url.searchParams.get('v');
  if (!candidate || !/^[A-Za-z0-9_-]{11}$/.test(candidate)) return null;
  const playlist = url.searchParams.get('list');
  const playlistId = playlist && /^[A-Za-z0-9_-]{10,80}$/.test(playlist) ? playlist : undefined;
  const rawIndex = url.searchParams.get('index'); const parsedIndex = rawIndex ? Number(rawIndex) : undefined;
  const index = playlistId && Number.isSafeInteger(parsedIndex) && parsedIndex! >= 1 && parsedIndex! <= 10_000 ? parsedIndex : undefined;
  return { videoId: candidate, ...(playlistId ? { playlistId } : {}), ...(index ? { index } : {}) };
}

export function youTubeVideoId(input: string): string | null { return parseYouTubeTarget(input)?.videoId ?? null; }

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
  | { kind: 'youtube'; videoId: string; embedUrl: string; playlistId?: string; index?: number };

/** Privacy-friendly YouTube embed with bounded playlist navigation. */
export function youTubeEmbedUrl(target: string | YouTubeTarget, muted: boolean, autoplay = true): string {
  const parsed = typeof target === 'string' ? { videoId: target } : target;
  const params = new URLSearchParams({ autoplay: autoplay ? '1' : '0', mute: muted ? '1' : '0', rel: '0', modestbranding: '1', playsinline: '1' });
  if (parsed.playlistId) { params.set('list', parsed.playlistId); if (parsed.index) params.set('index', String(parsed.index)); }
  return `https://www.youtube-nocookie.com/embed/${parsed.videoId}?${params.toString()}`;
}

export function resolveCastTarget(config: CastConfig): CastTarget {
  if (config.sourceKind === 'idle') return { kind: 'idle' };
  if (config.sourceKind === 'youtube') {
    const target = parseYouTubeTarget(config.sourceUrl);
    return target ? { kind: 'youtube', ...target, embedUrl: youTubeEmbedUrl(target, config.muted, config.autoplay) } : { kind: 'idle' };
  }
  if (!isHttpsUrl(config.sourceUrl)) return { kind: 'idle' };
  return config.sourceKind === 'media'
    ? { kind: 'media', url: config.sourceUrl }
    : { kind: 'website', url: config.sourceUrl };
}
