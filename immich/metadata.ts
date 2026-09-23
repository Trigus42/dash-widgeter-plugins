import type { ImmichAsset } from './types';

export interface AssetMetadata {
  date: string | null;
  location: string | null;
  description: string | null;
  people: string | null;
}

/** Which metadata lines the frame's corner overlay should show. */
export interface MetadataOptions {
  showDate: boolean;
  showLocation: boolean;
  showDescription: boolean;
  showPeople: boolean;
}

/** Derive the display metadata for an asset, honoring the enabled fields. */
export function deriveMetadata(asset: ImmichAsset, options: MetadataOptions): AssetMetadata {
  const exif = asset.exifInfo;
  const rawDate = exif?.dateTimeOriginal ?? asset.localDateTime;

  const location = options.showLocation
    ? [exif?.city, exif?.state, exif?.country].filter(Boolean).join(', ') || null
    : null;

  const people =
    options.showPeople && asset.people && asset.people.length > 0
      ? asset.people.map((p) => p.name).filter(Boolean).join(', ') || null
      : null;

  return {
    date: options.showDate && rawDate ? new Date(rawDate).toLocaleDateString() : null,
    location,
    description: options.showDescription && exif?.description ? exif.description : null,
    people,
  };
}

/** True when at least one metadata line will render. */
export function hasMetadata(meta: AssetMetadata): boolean {
  return Boolean(meta.date || meta.location || meta.description || meta.people);
}
