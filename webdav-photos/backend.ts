import type { HttpRequest } from '@/types';
import type { GuestWidgetContext } from '@/sandbox/sdk';
import type { PhotoAsset, PhotoBackend, PhotoImageSize } from '@/sandbox/photoframe';
import { WebDavService, type WebDavTransport } from './service';
import { readWebDavConfig } from './config';
import type { WebDavEntry } from './types';

/** Last path segment of a URL, decoded, for the asset's display filename. */
function fileNameOf(href: string): string {
  const path = href.split('?')[0] ?? href;
  const segment = path.replace(/\/+$/, '').split('/').pop() ?? '';
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/** Map a WebDAV file entry to the SDK's backend-neutral PhotoAsset. */
function toPhotoAsset(entry: WebDavEntry): PhotoAsset {
  const asset: PhotoAsset = {
    // The absolute href is the stable id (keys the blob cache + React lists) and
    // the address the image request is built from.
    id: entry.href,
    type: 'IMAGE',
    originalFileName: fileNameOf(entry.href),
  };
  if (entry.lastModified) asset.localDateTime = new Date(entry.lastModified).toISOString();
  return asset;
}

/**
 * The WebDAV photo-source backend: a thin adapter over {@link WebDavService}
 * satisfying the shared photo-frame SDK's {@link PhotoBackend} contract. The SDK
 * engine owns the slideshow, caching, transitions and overlay; this backend only
 * lists a WebDAV collection and addresses each file's bytes.
 */
export class WebDavBackend implements PhotoBackend {
  private readonly service: WebDavService;
  private readonly configured: boolean;

  constructor(context: GuestWidgetContext, rawConfig: Record<string, unknown>) {
    const config = readWebDavConfig(rawConfig);
    this.configured = config.folderUrl.trim() !== '';
    const transport: WebDavTransport = { request: (req) => context.http(req) };
    this.service = new WebDavService(transport, config);
  }

  isConfigured(): boolean {
    return this.configured;
  }

  poolCacheKey(): string {
    return this.service.poolCacheKey();
  }

  async fetchAssets(_count: number): Promise<PhotoAsset[]> {
    const entries = await this.service.listImages();
    return entries.map(toPhotoAsset);
  }

  imageRequest(asset: PhotoAsset, size: PhotoImageSize): HttpRequest {
    return this.service.imageRequest(asset.id, size);
  }
}
