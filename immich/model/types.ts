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

/**
 * One Immich asset. Structurally a superset of the SDK's `PhotoAsset`, so the
 * shared slideshow engine renders it directly without a mapping step.
 */
export interface ImmichAsset {
  id: string;
  type: string;
  originalFileName: string;
  localDateTime?: string;
  thumbhash?: string | null;
  exifInfo?: ImmichExifInfo | null;
  people?: ImmichPerson[];
  tags?: ImmichTag[];
  albumName?: string;
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

/** Named picklist option for album/person/tag selection in settings. */
export interface SelectOption {
  label: string;
  value: string;
}

/**
 * Immich-specific connection + source config. The slideshow / overlay / caching
 * fields are owned by the shared photo-frame SDK (`FrameConfig`) and read from
 * the same instance config via `readFrameConfig`, so they are not duplicated here.
 */
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
  onlyWithPersons: boolean;
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
  onlyWithPersons: false,
};
