import type { HttpRequest, SettingOption } from '@/types';
import type { GuestWidgetContext, OptionsContext } from '@/sandbox/sdk';
import type {
  FaceBox,
  PhotoAsset,
  PhotoBackend,
  PhotoImageSize,
} from '@/sandbox/photoframe';
import { ImmichService, type ImmichTransport } from './service';
import { readImmichConfig } from './config';
import type { ImmichAsset } from './types';

/**
 * The Immich photo-source backend: a thin adapter over {@link ImmichService}
 * that satisfies the shared photo-frame SDK's {@link PhotoBackend} contract.
 * The SDK engine owns the slideshow, caching, transitions and overlay; this
 * backend only knows how to list Immich assets and address their image bytes.
 */
export class ImmichBackend implements PhotoBackend {
  private readonly service: ImmichService;
  private readonly configured: boolean;

  constructor(context: GuestWidgetContext, rawConfig: Record<string, unknown>) {
    const config = readImmichConfig(rawConfig);
    this.configured = config.serverUrl !== '' && config.apiKey !== '';
    const transport: ImmichTransport = { request: (req) => context.http(req) };
    this.service = new ImmichService(transport, config);
  }

  isConfigured(): boolean {
    return this.configured;
  }

  poolCacheKey(): string {
    return this.service.poolCacheKey();
  }

  fetchAssets(count: number): Promise<PhotoAsset[]> {
    return this.service.fetchAssets(count);
  }

  imageRequest(asset: PhotoAsset, size: PhotoImageSize): HttpRequest {
    return this.service.imageRequest(asset.id, size);
  }

  fetchFaceBox(asset: PhotoAsset): Promise<FaceBox | null> {
    return this.service.fetchFaceBox(asset.id);
  }

  async enrichAsset(asset: PhotoAsset): Promise<void> {
    const immichAsset = asset as ImmichAsset;
    if (immichAsset.albumName) return;
    const albums = await this.service.fetchAssetAlbums(asset.id);
    if (albums.length > 0) immichAsset.albumName = albums.join(', ');
  }
}

/**
 * Dynamic option loader for the album/person/tag multiselects, running in the
 * plugin sandbox. Uses the server URL + API key already entered in the same
 * settings form (routed through the host HTTP capability) to query live lists so
 * users pick real entities instead of pasting UUIDs.
 */
export async function loadImmichOptions(
  context: OptionsContext,
  fieldKey: string,
  rawConfig: Record<string, unknown>,
): Promise<SettingOption[]> {
  const config = readImmichConfig(rawConfig);
  if (!config.serverUrl || !config.apiKey) {
    throw new Error('Enter the server URL and API key first.');
  }
  const service = new ImmichService({ request: (req) => context.http(req) }, config);
  if (fieldKey === 'albums') return service.listAlbums();
  if (fieldKey === 'people') return service.listPeople();
  return service.listTags();
}
