/**
 * Google Photos connection + source config. Durable credentials (client secret,
 * refresh token) are `secret` fields held in the host-only store and referenced
 * via `{{secret:…}}` placeholders — only the non-secret client id + album id
 * live in `config`. Slideshow / overlay / caching fields are owned by the shared
 * photo-frame SDK (`FrameConfig`) and read from the same instance config.
 */
export interface GooglePhotosConfig {
  /** OAuth 2.0 client id (non-secret, identifies the app). */
  clientId: string;
  /** Album id to show, or '' for the whole library (recent media). */
  albumId: string;
}

export const GOOGLE_PHOTOS_DEFAULT_CONFIG: GooglePhotosConfig = {
  clientId: '',
  albumId: '',
};

/** One Google Photos media item (subset the frame needs). */
export interface GoogleMediaItem {
  id: string;
  /** Pre-signed, auth-free URL; the frame appends a `=w{W}-h{H}` size suffix. */
  baseUrl: string;
  filename?: string;
  mimeType?: string;
  mediaMetadata?: {
    creationTime?: string;
    width?: string;
    height?: string;
    photo?: Record<string, unknown>;
  };
}
