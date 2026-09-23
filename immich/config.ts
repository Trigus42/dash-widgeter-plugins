import {
  IMMICH_DEFAULT_CONFIG,
  type FrameLayout,
  type ImageFit,
  type ImmichConfig,
  type ImmichPoolMode,
  type MetadataPosition,
  type ProgressBarPosition,
  type TransitionMode,
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

const POOL_MODES: ImmichPoolMode[] = ['random', 'favorites', 'memories', 'albums', 'people', 'tags'];
const TRANSITIONS: TransitionMode[] = ['fade', 'zoom', 'pan', 'kenburns', 'none'];
const METADATA_POSITIONS: MetadataPosition[] = [
  'none',
  'bottom-left',
  'bottom-right',
  'top-left',
  'top-right',
];

/** Coerce persisted config (unknown JSON) into a validated ImmichConfig. */
export function readImmichConfig(raw: Record<string, unknown>): ImmichConfig {
  const d = IMMICH_DEFAULT_CONFIG;
  const poolMode = POOL_MODES.includes(raw.poolMode as ImmichPoolMode)
    ? (raw.poolMode as ImmichPoolMode)
    : d.poolMode;
  const transition = TRANSITIONS.includes(raw.transition as TransitionMode)
    ? (raw.transition as TransitionMode)
    : d.transition;
  const layout: FrameLayout = raw.layout === 'split' ? 'split' : 'single';
  const imageFit: ImageFit = raw.imageFit === 'contain' ? 'contain' : 'cover';
  const progressBar: ProgressBarPosition =
    raw.progressBar === 'top' || raw.progressBar === 'none'
      ? raw.progressBar
      : d.progressBar;
  const metadataPosition = METADATA_POSITIONS.includes(raw.metadataPosition as MetadataPosition)
    ? (raw.metadataPosition as MetadataPosition)
    : d.metadataPosition;

  return {
    serverUrl: str(raw.serverUrl, d.serverUrl),
    apiKey: str(raw.apiKey, d.apiKey),
    poolMode,
    albumIds: strArray(raw.albumIds),
    personIds: strArray(raw.personIds),
    tagIds: strArray(raw.tagIds),
    rating: num(raw.rating, d.rating),
    showVideos: bool(raw.showVideos, d.showVideos),
    intervalSeconds: num(raw.intervalSeconds, d.intervalSeconds),
    layout,
    transition,
    transitionSeconds: num(raw.transitionSeconds, d.transitionSeconds),
    imageFit,
    showControls: bool(raw.showControls, d.showControls),
    progressBar,
    metadataPosition,
    metadataShowDate: bool(raw.metadataShowDate, d.metadataShowDate),
    metadataShowLocation: bool(raw.metadataShowLocation, d.metadataShowLocation),
    metadataShowDescription: bool(raw.metadataShowDescription, d.metadataShowDescription),
    metadataShowPeople: bool(raw.metadataShowPeople, d.metadataShowPeople),
    cacheEnabled: bool(raw.cacheEnabled, d.cacheEnabled),
    cacheMaxMB: num(raw.cacheMaxMB, d.cacheMaxMB),
    cacheExpirationDays: num(raw.cacheExpirationDays, d.cacheExpirationDays),
    listTtlMinutes: num(raw.listTtlMinutes, d.listTtlMinutes),
  };
}
