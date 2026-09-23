import type { CachePolicy, HttpRequest, HttpResponse } from '@/types';
import type {
  FaceBox,
  ImmichAsset,
  ImmichConfig,
  SelectOption,
} from './types';

interface MetadataEnvelope {
  assets?: { items?: ImmichAsset[] };
}
interface MemoryResponse {
  data?: { year?: number };
  assets?: ImmichAsset[];
}

const PROXY = 'always' as const;

/** Minimal HTTP + blob-cache surface, satisfied by both the host and the
 * sandbox context — so ImmichService has no dependency on host singletons and
 * runs unchanged inside the plugin sandbox. */
export interface ImmichTransport {
  request(req: HttpRequest): Promise<HttpResponse<unknown>>;
  cacheGet(key: string): Promise<Blob | null>;
  cachePut(key: string, blob: Blob, policy?: CachePolicy): Promise<void>;
}

/**
 * Immich API client. All requests go through the injected transport (host HTTP
 * capability → Rust command natively / dev proxy in the browser), never a direct
 * fetch, so the API key and CORS stay handled in one place. Image bytes are
 * persisted to the namespaced blob cache for offline + speed; the asset list is
 * cached by the shared query layer.
 */
export class ImmichService {
  constructor(
    private readonly transport: ImmichTransport,
    private readonly config: ImmichConfig,
  ) {}

  private get base(): string {
    return `${this.config.serverUrl.replace(/\/$/, '')}/api`;
  }

  /** Host-enforced eviction bounds for cached image blobs, from user config.
   *  cacheExpirationDays of 0 means never expire (maxAgeMs = Infinity). */
  private get cachePolicy(): CachePolicy {
    const days = this.config.cacheExpirationDays;
    return {
      maxBytes: this.config.cacheMaxMB * 1024 * 1024,
      maxAgeMs: days > 0 ? days * 24 * 60 * 60 * 1000 : Infinity,
    };
  }

  private get jsonHeaders(): Record<string, string> {
    return {
      // `apiKey` is the `{{secret:apiKey}}` sentinel (a secret field); the host
      // HTTP layer substitutes the real key at egress, so it never enters this
      // frame. Sending the sentinel verbatim here is correct.
      'x-api-key': this.config.apiKey,
      accept: 'application/json',
      'content-type': 'application/json',
    };
  }

  /** Typed request helper: the transport returns `unknown` data (RPC-crossed). */
  private async req<T>(request: HttpRequest): Promise<HttpResponse<T>> {
    return (await this.transport.request(request)) as HttpResponse<T>;
  }

  /**
   * Pool-aware asset-list fetch. Pure network fetch: caching, staleness, and
   * offline fallback are handled by the shared data layer (useWidgetData /
   * TanStack Query), not here. Image bytes still use the dedicated size-capped
   * blob cache (see fetchImageBlob) because that needs LRU eviction the query
   * cache does not provide.
   */
  async fetchAssets(count: number): Promise<ImmichAsset[]> {
    return this.fetchPool(count);
  }

  /** Stable identity for the asset pool; used as the shared query key. */
  poolCacheKey(): string {
    const c = this.config;
    return `${c.serverUrl}|${c.poolMode}|${c.albumIds.join(',')}|${c.personIds.join(
      ',',
    )}|${c.tagIds.join(',')}|r${c.rating}|v${c.showVideos ? 1 : 0}`;
  }

  private async fetchPool(count: number): Promise<ImmichAsset[]> {
    switch (this.config.poolMode) {
      case 'memories':
        return this.fetchMemories();
      case 'favorites':
        return this.metadataSearch({ isFavorite: true }, count);
      case 'albums':
        return this.metadataSearch({ albumIds: this.config.albumIds }, count);
      case 'people':
        return this.metadataSearch({ personIds: this.config.personIds }, count);
      case 'tags':
        return this.metadataSearch({ tagIds: this.config.tagIds }, count);
      case 'random':
      default:
        return this.fetchRandom(count);
    }
  }

  private assetType(): Record<string, unknown> {
    return this.config.showVideos ? {} : { type: 'IMAGE' };
  }

  private async fetchRandom(count: number): Promise<ImmichAsset[]> {
    const res = await this.req<ImmichAsset[]>({
      url: `${this.base}/search/random`,
      method: 'POST',
      headers: this.jsonHeaders,
      body: {
        size: count,
        withExif: true,
        withPeople: true,
        ...this.assetType(),
        ...(this.config.rating > 0 ? { rating: this.config.rating } : {}),
      },
      proxy: PROXY,
    });
    if (!res.ok) throw new Error(`Immich random search failed (${res.status})`);
    return Array.isArray(res.data) ? res.data : [];
  }

  private async metadataSearch(
    filter: Record<string, unknown>,
    count: number,
  ): Promise<ImmichAsset[]> {
    const res = await this.req<MetadataEnvelope>({
      url: `${this.base}/search/metadata`,
      method: 'POST',
      headers: this.jsonHeaders,
      body: {
        ...filter,
        withExif: true,
        withPeople: true,
        size: count,
        ...this.assetType(),
        ...(this.config.rating > 0 ? { rating: this.config.rating } : {}),
      },
      proxy: PROXY,
    });
    if (!res.ok) throw new Error(`Immich metadata search failed (${res.status})`);
    return res.data.assets?.items ?? [];
  }

  private async fetchMemories(): Promise<ImmichAsset[]> {
    const today = new Date().toISOString().slice(0, 10);
    const res = await this.req<MemoryResponse[]>({
      url: `${this.base}/memories?for=${today}`,
      method: 'GET',
      headers: this.jsonHeaders,
      proxy: PROXY,
    });
    if (!res.ok) throw new Error(`Immich memories failed (${res.status})`);
    const now = new Date().getFullYear();
    return (res.data ?? []).flatMap((memory) => {
      const years = memory.data?.year ? now - memory.data.year : 0;
      const title = years > 0 ? `${years} year${years > 1 ? 's' : ''} ago` : 'Memory';
      return (memory.assets ?? []).map((a) => ({ ...a, memoryTitle: title }));
    });
  }

  /**
   * Fetch a preview image as a Blob, serving from the local size-capped blob
   * cache first (offline + instant). Network responses are cached and the store
   * is pruned to the configured budget. Returns the Blob itself — the caller
   * owns object-URL creation and revocation so the URL lifecycle is tied to the
   * element that renders it.
   */
  async fetchImageBlob(assetId: string, size: 'preview' | 'thumbnail' = 'preview'): Promise<Blob> {
    const cacheKey = `${assetId}:${size}`;
    if (this.config.cacheEnabled) {
      const cached = await this.transport.cacheGet(cacheKey);
      if (cached) return cached;
    }
    const res = await this.req<Blob>({
      url: `${this.base}/assets/${assetId}/thumbnail?size=${size}`,
      method: 'GET',
      headers: { 'x-api-key': this.config.apiKey },
      responseType: 'binary',
      proxy: PROXY,
    });
    if (!res.ok) throw new Error(`Immich image failed (${res.status})`);
    if (this.config.cacheEnabled) {
      // Write with the eviction policy; the host prunes by age then size after
      // the write, so the cache stays within the user's configured bounds.
      await this.transport.cachePut(cacheKey, res.data, this.cachePolicy);
    }
    return res.data;
  }

  /** Face center (0..1) of the first detected face, to bias Ken Burns origin. */
  async fetchFaceBox(assetId: string): Promise<FaceBox | null> {
    const res = await this.req<
      Array<{
        boundingBoxX1: number;
        boundingBoxX2: number;
        boundingBoxY1: number;
        boundingBoxY2: number;
        imageWidth: number;
        imageHeight: number;
      }>
    >({
      url: `${this.base}/faces?id=${assetId}`,
      method: 'GET',
      headers: this.jsonHeaders,
      proxy: PROXY,
    });
    if (!res.ok || !Array.isArray(res.data) || res.data.length === 0) return null;
    const f = res.data[0];
    if (!f || !f.imageWidth || !f.imageHeight) return null;
    return {
      cx: (f.boundingBoxX1 + f.boundingBoxX2) / 2 / f.imageWidth,
      cy: (f.boundingBoxY1 + f.boundingBoxY2) / 2 / f.imageHeight,
    };
  }

  async listAlbums(): Promise<SelectOption[]> {
    const res = await this.req<Array<{ id: string; albumName: string }>>({
      url: `${this.base}/albums`,
      method: 'GET',
      headers: this.jsonHeaders,
      proxy: PROXY,
    });
    if (!res.ok) throw new Error(`Immich albums failed (${res.status})`);
    return (res.data ?? []).map((a) => ({ label: a.albumName, value: a.id }));
  }

  async listPeople(): Promise<SelectOption[]> {
    const res = await this.req<{ people?: Array<{ id: string; name: string }> }>({
      url: `${this.base}/people?withHidden=false`,
      method: 'GET',
      headers: this.jsonHeaders,
      proxy: PROXY,
    });
    if (!res.ok) throw new Error(`Immich people failed (${res.status})`);
    return (res.data.people ?? [])
      .filter((p) => p.name)
      .map((p) => ({ label: p.name, value: p.id }));
  }

  async listTags(): Promise<SelectOption[]> {
    const res = await this.req<Array<{ id: string; value: string }>>({
      url: `${this.base}/tags`,
      method: 'GET',
      headers: this.jsonHeaders,
      proxy: PROXY,
    });
    if (!res.ok) throw new Error(`Immich tags failed (${res.status})`);
    return (res.data ?? []).map((t) => ({ label: t.value, value: t.id }));
  }
}
