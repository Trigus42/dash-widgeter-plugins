import {
  IMMICH_DEFAULT_CONFIG,
  type EntityFilter,
  type ImmichConfig,
  type ImmichPoolMode,
} from './types';

function str(raw: unknown, fallback: string): string {
  return typeof raw === 'string' ? raw : fallback;
}
function num(raw: unknown, fallback: number): number {
  return typeof raw === 'number' && !Number.isNaN(raw) ? raw : fallback;
}
function bool(raw: unknown, fallback: boolean): boolean {
  return typeof raw === 'boolean' ? raw : fallback;
}
function strArray(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((v): v is string => typeof v === 'string');
  // Settings multiselect may persist a comma-joined string.
  if (typeof raw === 'string' && raw.length > 0) return raw.split(',').map((s) => s.trim());
  return [];
}

const POOL_MODES: ImmichPoolMode[] = ['random', 'favorites', 'memories'];

/**
 * Coerce a tri-state entity filter. Accepts the current `{ include, exclude }`
 * shape and migrates the legacy flat id array (from when albums/people/tags
 * were single-select pool modes) into `include`.
 */
function entityFilter(raw: unknown, legacyIds: unknown): EntityFilter {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const v = raw as { include?: unknown; exclude?: unknown };
    return { include: strArray(v.include), exclude: strArray(v.exclude) };
  }
  return { include: strArray(legacyIds), exclude: [] };
}

/**
 * Coerce persisted config (unknown JSON) into the validated Immich connection +
 * source fields. The slideshow / overlay / caching fields live on the same
 * instance config but are read by the shared SDK via `readFrameConfig`.
 */
export function readImmichConfig(raw: Record<string, unknown>): ImmichConfig {
  const d = IMMICH_DEFAULT_CONFIG;
  // Legacy 'albums'/'people'/'tags' pool modes are gone: those are now
  // independent tri-state filters layered on the base pool, so anything not in
  // the current set falls back to 'random'.
  const poolMode = POOL_MODES.includes(raw.poolMode as ImmichPoolMode)
    ? (raw.poolMode as ImmichPoolMode)
    : d.poolMode;

  return {
    serverUrl: str(raw.serverUrl, d.serverUrl),
    apiKey: str(raw.apiKey, d.apiKey),
    poolMode,
    albums: entityFilter(raw.albums, raw.albumIds),
    people: entityFilter(raw.people, raw.personIds),
    tags: entityFilter(raw.tags, raw.tagIds),
    rating: num(raw.rating, d.rating),
    showVideos: bool(raw.showVideos, d.showVideos),
    onlyWithPersons: bool(raw.onlyWithPersons, d.onlyWithPersons),
  };
}
