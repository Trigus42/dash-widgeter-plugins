/** Immich API subset used by the photo frame (mirrors spec v3.2.x). */
export interface ImmichExifInfo {
  dateTimeOriginal?: string | null;
  description?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  exifImageWidth?: number | null;
  exifImageHeight?: number | null;
}

export interface ImmichPerson {
  id: string;
  name: string;
}

export interface ImmichTag {
  id: string;
  name: string;
  value: string;
}

export interface ImmichAsset {
  id: string;
  type: string;
  originalFileName: string;
  localDateTime?: string;
  thumbhash?: string | null;
  exifInfo?: ImmichExifInfo | null;
  people?: ImmichPerson[];
  tags?: ImmichTag[];
  /** Injected by the memories pool: "X years ago". */
  memoryTitle?: string;
}

/** A face bounding box (fractions 0..1) used to bias Ken Burns zoom origin. */
export interface FaceBox {
  cx: number;
  cy: number;
}

export type ImmichPoolMode = 'random' | 'favorites' | 'memories';

/**
 * A tri-state entity filter: ids to include (any-of) and ids to exclude
 * (none-of). Empty include means "no include constraint" for that category.
 */
export interface EntityFilter {
  include: string[];
  exclude: string[];
}

export type FrameLayout = 'single' | 'split';
export type TransitionMode = 'fade' | 'zoom' | 'pan' | 'kenburns' | 'none';
export type ImageFit = 'contain' | 'cover';
export type ProgressBarPosition = 'top' | 'bottom' | 'none';
export type MetadataPosition = 'none' | 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right';

/** Named picklist option for album/person/tag selection in settings. */
export interface SelectOption {
  label: string;
  value: string;
}

export interface ImmichConfig {
  // Connection
  serverUrl: string;
  apiKey: string;

  // Pool / source
  poolMode: ImmichPoolMode;
  /** Tri-state album/person/tag filters, combined (AND across categories). */
  albums: EntityFilter;
  people: EntityFilter;
  tags: EntityFilter;
  rating: number; // 0 = any
  showVideos: boolean;

  // Slideshow
  intervalSeconds: number;
  layout: FrameLayout;
  transition: TransitionMode;
  transitionSeconds: number;
  imageFit: ImageFit;
  showControls: boolean;

  // Overlay
  progressBar: ProgressBarPosition;
  /** Corner for the info overlay (date/location/people), or 'none' to hide. */
  metadataPosition: MetadataPosition;
  metadataShowDate: boolean;
  metadataShowLocation: boolean;
  metadataShowDescription: boolean;
  metadataShowPeople: boolean;

  // Caching
  cacheEnabled: boolean;
  cacheMaxMB: number;
  /** Cached images older than this are evicted (0 = never expire). */
  cacheExpirationDays: number;
  listTtlMinutes: number;
}

export const IMMICH_DEFAULT_CONFIG: ImmichConfig = {
  serverUrl: '',
  apiKey: '',
  poolMode: 'random',
  albums: { include: [], exclude: [] },
  people: { include: [], exclude: [] },
  tags: { include: [], exclude: [] },
  rating: 0,
  showVideos: false,
  intervalSeconds: 15,
  layout: 'single',
  transition: 'kenburns',
  transitionSeconds: 1.2,
  imageFit: 'cover',
  showControls: true,
  progressBar: 'bottom',
  metadataPosition: 'bottom-right',
  metadataShowDate: true,
  metadataShowLocation: true,
  metadataShowDescription: false,
  metadataShowPeople: true,
  cacheEnabled: true,
  cacheMaxMB: 500,
  cacheExpirationDays: 0,
  listTtlMinutes: 720,
};

/** Layout uses two panes only for portrait pairing in split mode. */
export function panesForLayout(layout: FrameLayout): number {
  return layout === 'split' ? 2 : 1;
}
