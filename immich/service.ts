import type { HttpRequest, HttpResponse } from '@/types';
import type { PhotoImageSize } from '@/sandbox/photoframe';
import type {
  EntityFilter,
  FaceBox,
  ImmichAsset,
  ImmichConfig,
  SelectOption,
} from './types';
import {
  fetchAssetAlbumsHelper,
  fetchFaceBoxHelper,
  fetchMemoriesHelper,
  listAlbumsHelper,
  listPeopleHelper,
  listTagsHelper,
} from './service-helpers';

interface MetadataEnvelope {
  assets?: { items?: ImmichAsset[] };
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
    const items = await fetchMemoriesHelper(this.req.bind(this), `${this.base}/memories`, this.jsonHeaders);
    return this.postProcessAssets(items);
  }

  fetchAssetAlbums(assetId: string): Promise<string[]> {
    return fetchAssetAlbumsHelper(this.req.bind(this), `${this.base}/albums?assetId=${assetId}`, this.jsonHeaders);
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

  /** Browser-native playback URL; direct media cannot carry the brokered API key. */
  videoUrl(assetId: string): string {
    return `${this.base}/assets/${assetId}/video/playback`;
  }

  /** Face center (0..1) of the first detected face, to bias Ken Burns origin. */
  fetchFaceBox(assetId: string): Promise<FaceBox | null> {
    return fetchFaceBoxHelper(this.req.bind(this), `${this.base}/faces?id=${assetId}`, this.jsonHeaders);
  }

  listAlbums(): Promise<SelectOption[]> {
    return listAlbumsHelper(this.req.bind(this), `${this.base}/albums`, this.jsonHeaders);
  }

  listPeople(): Promise<SelectOption[]> {
    return listPeopleHelper(this.req.bind(this), `${this.base}/people?withHidden=false`, this.jsonHeaders);
  }

  listTags(): Promise<SelectOption[]> {
    return listTagsHelper(this.req.bind(this), `${this.base}/tags`, this.jsonHeaders);
  }
}
