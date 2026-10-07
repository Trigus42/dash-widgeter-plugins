import type { HttpRequest, HttpResponse } from '@/types';
import type { PhotoImageSize } from '@/sandbox/photoframe';
import { secretSentinel } from '@/core/net/secret-placeholder';
import type { GoogleMediaItem, GooglePhotosConfig } from './types';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const API_BASE = 'https://photoslibrary.googleapis.com/v1';
const PROXY = 'always' as const;

/** Image dimensions requested from a Google Photos baseUrl size suffix. */
const PREVIEW = { w: 2048, h: 1365 };
const THUMBNAIL = { w: 640, h: 640 };

/** Minimal HTTP surface, satisfied by both the host and the sandbox context. */
export interface GooglePhotosTransport {
  request(req: HttpRequest): Promise<HttpResponse<unknown>>;
}

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
}

interface SearchResponse {
  mediaItems?: GoogleMediaItem[];
  nextPageToken?: string;
}

/**
 * Google Photos Library API client. The durable OAuth credentials (client
 * secret + refresh token) are referenced as `{{secret:…}}` placeholders in the
 * token-exchange request body, which the host substitutes at egress — so they
 * never enter the sandbox frame. The resulting access token is short-lived and
 * used only as a Bearer header for list calls; image `baseUrl`s are pre-signed
 * and need no auth. The client is pure: no blob cache or DOM access (the shared
 * SDK engine owns those).
 */
export class GooglePhotosService {
  private accessToken: string | null = null;
  private tokenExpiresAt = 0;

  constructor(
    private readonly transport: GooglePhotosTransport,
    private readonly config: GooglePhotosConfig,
  ) {}

  /** Stable identity for the pool (client + album); the shared query key. */
  poolCacheKey(): string {
    return `${this.config.clientId}|${this.config.albumId || 'library'}`;
  }

  /**
   * Exchange the refresh token for a fresh access token, caching it until a
   * minute before expiry. The request body carries the client secret + refresh
   * token as host-substituted placeholders, so this frame never sees them.
   */
  private async accessTokenValue(): Promise<string> {
    const now = Date.now();
    if (this.accessToken && now < this.tokenExpiresAt) return this.accessToken;

    // Built by hand (not URLSearchParams) so the `{{secret:…}}` sentinels stay
    // literal: the host matches and substitutes them at egress, and
    // URLSearchParams would percent-encode the braces and defeat that. Only the
    // non-secret client id is user-supplied here, so it is the one value encoded;
    // the host substitutes the (URL-safe) secret values verbatim.
    const body =
      `client_id=${encodeURIComponent(this.config.clientId)}` +
      `&client_secret=${secretSentinel('clientSecret')}` +
      `&refresh_token=${secretSentinel('refreshToken')}` +
      `&grant_type=refresh_token`;

    const res = (await this.transport.request({
      url: TOKEN_URL,
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
      proxy: PROXY,
    })) as HttpResponse<TokenResponse>;

    if (!res.ok || !res.data.access_token) {
      throw new Error(`Google token refresh failed (${res.status})`);
    }
    this.accessToken = res.data.access_token;
    // Refresh a minute early to avoid using a token that expires mid-request.
    this.tokenExpiresAt = now + Math.max(0, (res.data.expires_in ?? 3600) - 60) * 1000;
    return this.accessToken;
  }

  private async authHeaders(): Promise<Record<string, string>> {
    return { authorization: `Bearer ${await this.accessTokenValue()}` };
  }

  /** Fetch up to `count` media items from the album, or recent library media. */
  async fetchAssets(count: number): Promise<GoogleMediaItem[]> {
    const headers = { ...(await this.authHeaders()), 'content-type': 'application/json' };
    const body: Record<string, unknown> = { pageSize: Math.min(100, Math.max(1, count)) };
    if (this.config.albumId) body.albumId = this.config.albumId;

    const res = (await this.transport.request({
      url: `${API_BASE}/mediaItems:search`,
      method: 'POST',
      headers,
      body,
      proxy: PROXY,
    })) as HttpResponse<SearchResponse>;

    if (!res.ok) throw new Error(`Google Photos search failed (${res.status})`);
    const items = res.data.mediaItems ?? [];
    // Only still images carry a usable baseUrl for the frame.
    return items.filter((item) => !item.mimeType || item.mimeType.startsWith('image/'));
  }

  /** List the user's albums for the settings picker (title + id). */
  async listAlbums(): Promise<Array<{ label: string; value: string }>> {
    const headers = await this.authHeaders();
    const albums: Array<{ label: string; value: string }> = [];
    let pageToken = '';
    // A couple of pages is plenty for a picker; avoid an unbounded loop.
    for (let page = 0; page < 5; page += 1) {
      const url = `${API_BASE}/albums?pageSize=50${pageToken ? `&pageToken=${pageToken}` : ''}`;
      const res = (await this.transport.request({ url, method: 'GET', headers, proxy: PROXY })) as HttpResponse<{
        albums?: Array<{ id: string; title?: string }>;
        nextPageToken?: string;
      }>;
      if (!res.ok) throw new Error(`Google Photos albums failed (${res.status})`);
      for (const album of res.data.albums ?? []) {
        albums.push({ label: album.title || '(untitled album)', value: album.id });
      }
      if (!res.data.nextPageToken) break;
      pageToken = res.data.nextPageToken;
    }
    return albums;
  }

  /**
   * Build the request for an item's image bytes. Google Photos baseUrls are
   * pre-signed (no auth) and take a `=w{W}-h{H}` size suffix. Pure — the SDK
   * engine runs it with `responseType: 'binary'`, caches and decodes.
   */
  imageRequest(baseUrl: string, size: PhotoImageSize): HttpRequest {
    const dim = size === 'thumbnail' ? THUMBNAIL : PREVIEW;
    return {
      url: `${baseUrl}=w${dim.w}-h${dim.h}`,
      method: 'GET',
      proxy: PROXY,
    };
  }
}
