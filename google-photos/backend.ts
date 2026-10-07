import type { HttpRequest, SettingOption } from '@/types';
import type { GuestWidgetContext, OptionsContext } from '@/sandbox/sdk';
import type { PhotoAsset, PhotoBackend, PhotoImageSize } from '@/sandbox/photoframe';
import { GooglePhotosService, type GooglePhotosTransport } from './service';
import { readGooglePhotosConfig } from './config';
import type { GoogleMediaItem } from './types';

/** Map a Google media item to the SDK's backend-neutral PhotoAsset. */
function toPhotoAsset(item: GoogleMediaItem): PhotoAsset {
  const asset: PhotoAsset = {
    // The id is used by the engine for cache keys + React lists, but the image
    // request needs the pre-signed baseUrl, so stash it in the id. We keep the
    // baseUrl as the id (stable per render) and read it back in imageRequest.
    id: item.baseUrl,
    type: 'IMAGE',
  };
  if (item.filename) asset.originalFileName = item.filename;
  const created = item.mediaMetadata?.creationTime;
  if (created) asset.localDateTime = created;
  return asset;
}

/**
 * The Google Photos backend: a thin adapter over {@link GooglePhotosService}
 * satisfying the shared photo-frame SDK's {@link PhotoBackend} contract. The SDK
 * engine owns the slideshow, caching, transitions and overlay; this backend only
 * lists media items and addresses each item's pre-signed image bytes.
 */
export class GooglePhotosBackend implements PhotoBackend {
  private readonly service: GooglePhotosService;
  private readonly configured: boolean;

  constructor(context: GuestWidgetContext, rawConfig: Record<string, unknown>) {
    const config = readGooglePhotosConfig(rawConfig);
    // The refresh token + client secret live in the host-only secret store (not
    // visible here), so "configured" is gated on the non-secret client id; a
    // missing token surfaces as a fetch error, not a silent blank frame.
    this.configured = config.clientId.trim() !== '';
    const transport: GooglePhotosTransport = { request: (req) => context.http(req) };
    this.service = new GooglePhotosService(transport, config);
  }

  isConfigured(): boolean {
    return this.configured;
  }

  poolCacheKey(): string {
    return this.service.poolCacheKey();
  }

  async fetchAssets(count: number): Promise<PhotoAsset[]> {
    const items = await this.service.fetchAssets(count);
    return items.map(toPhotoAsset);
  }

  imageRequest(asset: PhotoAsset, size: PhotoImageSize): HttpRequest {
    // asset.id carries the pre-signed baseUrl (see toPhotoAsset).
    return this.service.imageRequest(asset.id, size);
  }
}

/**
 * Dynamic option loader for the album picker, running in the plugin sandbox.
 * Uses the client id entered in settings plus the host-held OAuth secrets
 * (substituted at egress) to list the user's albums.
 */
export async function loadGooglePhotosAlbums(
  context: OptionsContext,
  rawConfig: Record<string, unknown>,
): Promise<SettingOption[]> {
  const config = readGooglePhotosConfig(rawConfig);
  if (!config.clientId) {
    throw new Error('Enter the OAuth client id and connect your account first.');
  }
  const service = new GooglePhotosService({ request: (req) => context.http(req) }, config);
  return service.listAlbums();
}
