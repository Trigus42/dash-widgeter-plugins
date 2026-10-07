import type { HttpRequest, HttpResponse } from '@/types';
import type { PhotoImageSize } from '@/sandbox/photoframe';
import { basicAuthSentinel } from '@/core/net/secret-placeholder';
import { parsePropfind } from './propfind';
import type { WebDavConfig, WebDavEntry } from './types';

const PROXY = 'always' as const;

/** Image file extensions the frame can display (lowercased, no dot). */
const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'bmp', 'heic', 'heif']);

/** Minimal HTTP surface, satisfied by both the host and the sandbox context. */
export interface WebDavTransport {
  request(req: HttpRequest): Promise<HttpResponse<unknown>>;
}

/** True when a URL or content-type looks like a displayable image. */
export function isImageResource(href: string, contentType: string | null): boolean {
  if (contentType && contentType.toLowerCase().startsWith('image/')) return true;
  const path = href.split('?')[0] ?? href;
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  return IMAGE_EXTENSIONS.has(ext);
}

/**
 * WebDAV photo-source client. Lists a collection via PROPFIND and addresses each
 * image by its absolute URL. All requests carry a composed Basic-auth header via
 * the `{{basic:username:password}}` placeholder, so the password is substituted
 * by the host at egress and never enters the sandbox frame. The client is pure:
 * it never touches the blob cache or DOM — the shared SDK engine owns those.
 */
export class WebDavService {
  constructor(
    private readonly transport: WebDavTransport,
    private readonly config: WebDavConfig,
  ) {}

  /** Collection URL with exactly one trailing slash (WebDAV collections end in /). */
  private get collectionUrl(): string {
    return `${this.config.folderUrl.replace(/\/+$/, '')}/`;
  }

  /** Basic-auth header value: a host-substituted placeholder, never the password. */
  private authHeaders(): Record<string, string> {
    if (!this.config.username) return {};
    return { authorization: basicAuthSentinel('username', 'password') };
  }

  /** Stable identity for the pool (folder + recursion); the shared query key. */
  poolCacheKey(): string {
    return `${this.collectionUrl}|r${this.config.recursive ? 1 : 0}`;
  }

  /**
   * List image files in the collection via PROPFIND. `Depth: 1` lists the direct
   * children; `infinity` recurses (servers may refuse infinity, in which case we
   * fall back to a one-level listing so a locked-down server still shows photos).
   */
  async listImages(): Promise<WebDavEntry[]> {
    const depth = this.config.recursive ? 'infinity' : '1';
    let entries = await this.propfind(depth);
    if (entries === null && depth === 'infinity') {
      entries = await this.propfind('1');
    }
    if (entries === null) throw new Error('WebDAV listing failed');
    return entries.filter((e) => !e.isCollection && isImageResource(e.href, e.contentType));
  }

  /** Issue one PROPFIND; returns parsed entries, or null on a non-207 response. */
  private async propfind(depth: '1' | 'infinity'): Promise<WebDavEntry[] | null> {
    const body =
      '<?xml version="1.0" encoding="utf-8"?>' +
      '<d:propfind xmlns:d="DAV:"><d:prop>' +
      '<d:getcontenttype/><d:getlastmodified/><d:resourcetype/>' +
      '</d:prop></d:propfind>';
    const res = await this.transport.request({
      url: this.collectionUrl,
      method: 'PROPFIND',
      headers: { ...this.authHeaders(), depth, 'content-type': 'application/xml' },
      body,
      responseType: 'text',
      proxy: PROXY,
    });
    // 207 Multi-Status is the WebDAV success code; anything else is a failure.
    if (res.status !== 207 || typeof res.data !== 'string') return null;
    return parsePropfind(res.data, this.collectionUrl);
  }

  /**
   * Build the request that returns an image's bytes. Pure — the SDK engine runs
   * it with `responseType: 'binary'`, caches and decodes. WebDAV has no server-
   * side thumbnailing, so the size tier is ignored (always the original file).
   */
  imageRequest(href: string, _size: PhotoImageSize): HttpRequest {
    return {
      url: href,
      method: 'GET',
      headers: this.authHeaders(),
      proxy: PROXY,
    };
  }
}
