import { describe, expect, it } from 'vitest';
import { GooglePhotosService, type GooglePhotosTransport } from './service';
import type { HttpRequest } from '@/types';
import { GOOGLE_PHOTOS_DEFAULT_CONFIG, type GooglePhotosConfig } from './types';

const config: GooglePhotosConfig = {
  ...GOOGLE_PHOTOS_DEFAULT_CONFIG,
  clientId: 'client-123.apps.googleusercontent.com',
};

function stubHttp(
  handler: (req: HttpRequest) => { status: number; data: unknown },
): { transport: GooglePhotosTransport; calls: HttpRequest[] } {
  const calls: HttpRequest[] = [];
  const transport: GooglePhotosTransport = {
    request: (req) => {
      calls.push(req);
      const r = handler(req);
      return Promise.resolve({ status: r.status, ok: r.status < 400, headers: {}, data: r.data });
    },
  };
  return { transport, calls };
}

function route(req: HttpRequest): { status: number; data: unknown } {
  if (req.url.includes('oauth2.googleapis.com/token')) {
    return { status: 200, data: { access_token: 'ya29.ACCESS', expires_in: 3600 } };
  }
  if (req.url.includes('mediaItems:search')) {
    return {
      status: 200,
      data: {
        mediaItems: [
          { id: 'm1', baseUrl: 'https://lh3.googleusercontent.com/x1', mimeType: 'image/jpeg' },
          { id: 'v1', baseUrl: 'https://lh3.googleusercontent.com/v1', mimeType: 'video/mp4' },
        ],
      },
    };
  }
  if (req.url.includes('/albums')) {
    return { status: 200, data: { albums: [{ id: 'a1', title: 'Trips' }, { id: 'a2' }] } };
  }
  return { status: 404, data: null };
}

describe('GooglePhotosService token exchange', () => {
  it('refreshes with secret placeholders in the body and reuses the token', async () => {
    const { transport, calls } = stubHttp(route);
    const service = new GooglePhotosService(transport, config);
    await service.fetchAssets(10);
    await service.fetchAssets(10);

    const tokenCalls = calls.filter((c) => c.url.includes('oauth2.googleapis.com/token'));
    // Token cached across the two fetches → exchanged exactly once.
    expect(tokenCalls).toHaveLength(1);
    const body = String(tokenCalls[0]?.body);
    // The durable credentials are LITERAL placeholders (not URL-encoded) so the
    // host can match and substitute them at egress.
    expect(body).toContain('client_secret={{secret:clientSecret}}');
    expect(body).toContain('refresh_token={{secret:refreshToken}}');
    expect(body).toContain('grant_type=refresh_token');
    expect(tokenCalls[0]?.proxy).toBe('always');
  });

  it('sends the access token as a Bearer header on search', async () => {
    const { transport, calls } = stubHttp(route);
    await new GooglePhotosService(transport, config).fetchAssets(10);
    const search = calls.find((c) => c.url.includes('mediaItems:search'));
    expect(search?.headers?.authorization).toBe('Bearer ya29.ACCESS');
  });

  it('throws when the token refresh fails', async () => {
    const { transport } = stubHttp((req) =>
      req.url.includes('/token') ? { status: 400, data: { error: 'invalid_grant' } } : route(req),
    );
    await expect(new GooglePhotosService(transport, config).fetchAssets(10)).rejects.toThrow(
      /token refresh failed/,
    );
  });
});

describe('GooglePhotosService.fetchAssets', () => {
  it('filters out non-image media items', async () => {
    const { transport } = stubHttp(route);
    const items = await new GooglePhotosService(transport, config).fetchAssets(10);
    expect(items.map((i) => i.id)).toEqual(['m1']);
  });

  it('includes albumId in the search body only when set', async () => {
    const { transport, calls } = stubHttp(route);
    await new GooglePhotosService(transport, { ...config, albumId: 'alb-9' }).fetchAssets(10);
    const search = calls.find((c) => c.url.includes('mediaItems:search'));
    expect((search?.body as { albumId?: string }).albumId).toBe('alb-9');

    const { transport: t2, calls: c2 } = stubHttp(route);
    await new GooglePhotosService(t2, config).fetchAssets(10);
    const search2 = c2.find((c) => c.url.includes('mediaItems:search'));
    expect((search2?.body as { albumId?: string }).albumId).toBeUndefined();
  });
});

describe('GooglePhotosService.imageRequest', () => {
  it('appends a size suffix to the pre-signed baseUrl and sends no auth', () => {
    const service = new GooglePhotosService(stubHttp(route).transport, config);
    const preview = service.imageRequest('https://lh3.googleusercontent.com/x1', 'preview');
    expect(preview.url).toBe('https://lh3.googleusercontent.com/x1=w2048-h1365');
    expect(preview.headers).toBeUndefined();
    const thumb = service.imageRequest('https://lh3.googleusercontent.com/x1', 'thumbnail');
    expect(thumb.url).toContain('=w640-h640');
  });
});

describe('GooglePhotosService.listAlbums', () => {
  it('maps albums with a fallback title for untitled albums', async () => {
    const { transport } = stubHttp(route);
    const albums = await new GooglePhotosService(transport, config).listAlbums();
    expect(albums).toEqual([
      { label: 'Trips', value: 'a1' },
      { label: '(untitled album)', value: 'a2' },
    ]);
  });
});
