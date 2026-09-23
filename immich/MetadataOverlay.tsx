import { deriveMetadata, hasMetadata, type MetadataOptions } from './metadata';
import type { ImmichAsset, MetadataPosition } from './types';

interface Props {
  asset: ImmichAsset;
  position: MetadataPosition;
  options: MetadataOptions;
}

/**
 * ImmichFrame-style photo caption: an unobtrusive gradient-scrim overlay pinned
 * to a corner of the photo, showing location + date (+ optional people /
 * description). Rendered inside the pane so it sits on the image it describes,
 * never as a separate tile. Returns null when hidden or empty.
 */
export function MetadataOverlay({ asset, position, options }: Props): React.JSX.Element | null {
  if (position === 'none') return null;
  const meta = deriveMetadata(asset, options);
  if (!hasMetadata(meta)) return null;

  return (
    <div className={`immich-caption immich-caption-${position}`}>
      {meta.location && <span className="immich-caption-primary">{meta.location}</span>}
      {meta.date && <span className="immich-caption-secondary">{meta.date}</span>}
      {meta.people && <span className="immich-caption-secondary">{meta.people}</span>}
      {meta.description && <span className="immich-caption-desc">{meta.description}</span>}
    </div>
  );
}
