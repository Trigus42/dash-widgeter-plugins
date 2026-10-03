import { deriveMetadata, hasMetadata, type MetadataOptions } from './metadata';
import type { ImmichAsset, MetadataPosition } from './types';

interface Props {
  asset: ImmichAsset;
  position: MetadataPosition;
  options: MetadataOptions;
  locale: string;
}

/**
 * ImmichFrame-style photo caption: an unobtrusive gradient-scrim overlay pinned
 * to a corner of the photo, showing location + date (+ optional people /
 * description). Rendered inside the pane so it sits on the image it describes,
 * never as a separate tile. Returns null when hidden or empty.
 */
export function MetadataOverlay({ asset, position, options, locale }: Props): React.JSX.Element | null {
  if (position === 'none') return null;
  const meta = deriveMetadata(asset, options, locale);
  if (!hasMetadata(meta)) return null;

  return (
    <div className={`immich-caption immich-caption-${position}`}>
      {meta.location && <span className="immich-caption-primary">{meta.location}</span>}
      {meta.album && <span className="immich-caption-primary">{meta.album}</span>}
      {meta.date && <span className="immich-caption-secondary">{meta.date}</span>}
      {meta.people && <span className="immich-caption-secondary">{meta.people}</span>}
      {meta.tags && <span className="immich-caption-secondary">{meta.tags}</span>}
      {meta.description && <span className="immich-caption-desc">{meta.description}</span>}
    </div>
  );
}
