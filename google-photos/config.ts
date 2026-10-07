import { GOOGLE_PHOTOS_DEFAULT_CONFIG, type GooglePhotosConfig } from './types';

function str(raw: unknown, fallback: string): string {
  return typeof raw === 'string' ? raw : fallback;
}

/** Coerce persisted config (unknown JSON) into validated Google Photos fields. */
export function readGooglePhotosConfig(raw: Record<string, unknown>): GooglePhotosConfig {
  const d = GOOGLE_PHOTOS_DEFAULT_CONFIG;
  return {
    clientId: str(raw.clientId, d.clientId),
    albumId: str(raw.albumId, d.albumId),
  };
}
