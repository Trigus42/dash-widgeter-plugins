import type { HttpRequest, HttpResponse } from '@/types';
import type { PhotoImageSize } from '@/sandbox/photoframe';
import type {
  EntityFilter,
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

/** Minimal HTTP surface, satisfied by both the host and the sandbox context —
 * so ImmichService has no dependency on host singletons and runs unchanged
 * inside the plugin sandbox. Blob caching is owned by the shared photo-frame
 * SDK engine (which executes {@link ImmichService.imageRequest}). */
export interface ImmichTransport {
  request(req: HttpRequest): Promise<HttpResponse<unknown>>;
}

/**
 * Immich API client. All requests go through the injected transport (host HTTP
 * capability → Rust command natively / dev proxy in the browser), never a direct
 * fetch, so the API key and CORS stay handled in one place. The client is pure:
 * it fetches/parses the asset list and builds image requests, but never touches
 * the blob cache or DOM — the shared SDK engine owns offline caching + decoding.
 */
export class ImmichService {
  constructor(
    private readonly transport: ImmichTransport,
    private readonly config: ImmichConfig,
  ) {}

  private get base(): string {
    return `${this.config.serverUrl.replace(/\/$/, '')}/api`;
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
   * TanStack Query), not here.
   */
  async fetchAssets(count: number): Promise<ImmichAsset[]> {
    return this.fetchPool(count);
  }

  /** Stable identity for the asset pool; used as the shared query key. */
  poolCacheKey(): string {
    const c = this.config;
    const f = (e: EntityFilter): string => `${e.include.join(',')}!${e.exclude.join(',')}`;
    return `${c.serverUrl}|${c.poolMode}|${f(c.albums)}|${f(c.people)}|${f(c.tags)}|r${c.rating}|v${
      c.showVideos ? 1 : 0
    }|p${c.onlyWithPersons ? 1 : 0}`;
  }

  private async fetchPool(count: number): Promise<ImmichAsset[]> {
    switch (this.config.poolMode) {
      case 'memories':
        return this.fetchMemories();
      case 'favorites':
        return this.metadataSearch({ isFavorite: { eq: true } }, count);
      case 'random':
      default:
        return this.fetchRandom(count);
    }
  }

  /**
   * Builds the modern Immich v3+ structured SearchFilter.
   * Crucially, combining `filter` with deprecated flat fields (e.g. top-level type,
   * rating, or id arrays) triggers an HTTP 400 validation error on Immich server.
   * All criteria are packaged inside `filter`.
   */
  private buildSearchFilter(extraFilter: Record<string, unknown> = {}): Record<string, unknown> {
    const c = this.config;
    const filter: Record<string, unknown> = { ...extraFilter };

    if (!c.showVideos) {
      filter.type = { in: ['IMAGE'] };
    }
    if (c.rating > 0) {
      filter.rating = { ge: c.rating };
    }
    if (c.onlyWithPersons) {
      filter.hasPeople = { eq: true };
    }

    const buildIds = (e: EntityFilter): { any?: string[]; none?: string[] } | null => {
      const res: { any?: string[]; none?: string[] } = {};
      if (e.include.length) res.any = e.include;
      if (e.exclude.length) res.none = e.exclude;
      return Object.keys(res).length > 0 ? res : null;
    };

    const albumIds = buildIds(c.albums);
    if (albumIds) filter.albumIds = albumIds;

    const personIds = buildIds(c.people);
    if (personIds) filter.personIds = personIds;

    const tagIds = buildIds(c.tags);
    if (tagIds) filter.tagIds = tagIds;

    return filter;
  }

  private postProcessAssets(items: ImmichAsset[]): ImmichAsset[] {
    let result = items;
    if (this.config.onlyWithPersons) {
      result = result.filter((a) => a.people && a.people.length > 0);
    }
    if (this.config.people.exclude.length > 0) {
      const excluded = new Set(this.config.people.exclude);
      result = result.filter((a) => !a.people || !a.people.some((p) => excluded.has(p.id)));
    }
    if (this.config.tags.exclude.length > 0) {
      const excluded = new Set(this.config.tags.exclude);
      result = result.filter((a) => !a.tags || !a.tags.some((t) => excluded.has(t.id)));
    }
    return result;
  }

  private async fetchRandom(count: number): Promise<ImmichAsset[]> {
    const filter = this.buildSearchFilter();
    const hasFilter = Object.keys(filter).length > 0;
    const body: Record<string, unknown> = {
      size: count,
      withExif: true,
      withPeople: true,
      ...(hasFilter ? { filter } : {}),
    };
    const res = await this.req<ImmichAsset[]>({
      url: `${this.base}/search/random`,
      method: 'POST',
      headers: this.jsonHeaders,
      body,
      proxy: PROXY,
    });
    if (!res.ok) throw new Error(`Immich random search failed (${res.status})`);
    const items = Array.isArray(res.data) ? res.data : [];
    return this.postProcessAssets(items);
  }

  private async metadataSearch(
    extraFilter: Record<string, unknown>,
    count: number,
  ): Promise<ImmichAsset[]> {
    const filter = this.buildSearchFilter(extraFilter);
    const hasFilter = Object.keys(filter).length > 0;
    const body: Record<string, unknown> = {
      size: count,
      withExif: true,
      withPeople: true,
      ...(hasFilter ? { filter } : {}),
    };
    const res = await this.req<MetadataEnvelope>({
      url: `${this.base}/search/metadata`,
      method: 'POST',
      headers: this.jsonHeaders,
      body,
      proxy: PROXY,
    });
    if (!res.ok) throw new Error(`Immich metadata search failed (${res.status})`);
    const items = res.data.assets?.items ?? [];
    return this.postProcessAssets(items);
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
    const items = (res.data ?? []).flatMap((memory) => {
      const years = memory.data?.year ? now - memory.data.year : 0;
      const title = years > 0 ? `${years} year${years > 1 ? 's' : ''} ago` : 'Memory';
      return (memory.assets ?? []).map((a) => ({ ...a, memoryTitle: title }));
    });
    return this.postProcessAssets(items);
  }

  async fetchAssetAlbums(assetId: string): Promise<string[]> {
    try {
      const res = await this.req<Array<{ id: string; albumName: string }>>({
        url: `${this.base}/albums?assetId=${assetId}`,
        method: 'GET',
        headers: this.jsonHeaders,
        proxy: PROXY,
      });
      if (!res.ok || !Array.isArray(res.data)) return [];
      return res.data.map((a) => a.albumName).filter(Boolean);
    } catch {
      return [];
    }
  }

  /**
   * Build the request that returns an asset's image bytes. Pure — the shared
   * SDK engine executes it with `responseType: 'binary'`, caches, and decodes.
   */
  imageRequest(assetId: string, size: PhotoImageSize = 'preview'): HttpRequest {
    return {
      url: `${this.base}/assets/${assetId}/thumbnail?size=${size}`,
      method: 'GET',
      headers: { 'x-api-key': this.config.apiKey },
      proxy: PROXY,
    };
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
