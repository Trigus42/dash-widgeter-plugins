import { describe, expect, it } from 'vitest';
import { ImmichService, type ImmichTransport } from './service';
import type { CachePolicy, HttpRequest } from '@/types';
import { IMMICH_DEFAULT_CONFIG, type ImmichConfig } from './types';

const config: ImmichConfig = {
  ...IMMICH_DEFAULT_CONFIG,
  serverUrl: 'http://immich.local/',
  apiKey: 'secret-key',
};

function stubHttp(
  handler: (req: HttpRequest) => { ok: boolean; status: number; data: unknown },
): { transport: ImmichTransport; calls: HttpRequest[] } {
  const calls: HttpRequest[] = [];
  const transport: ImmichTransport = {
    request: (req) => {
      calls.push(req);
      const r = handler(req);
      return Promise.resolve({ status: r.status, ok: r.ok, headers: {}, data: r.data });
    },
    cacheGet: () => Promise.resolve(null),
    cachePut: () => Promise.resolve(),
  };
  return { transport, calls };
}

function service(transport: ImmichTransport, cfg: ImmichConfig = config): ImmichService {
  return new ImmichService(transport, cfg);
}

// Caching / staleness now live in the shared data layer (useWidgetData); the
// service is a pure API client, so we only test pool routing + parsing here.
describe('ImmichService pool routing', () => {
  it('random → POST /search/random with api key + proxy always', async () => {
    const { transport, calls } = stubHttp(() => ({
      ok: true,
      status: 200,
      data: [{ id: 'a1', type: 'IMAGE', originalFileName: 'a.jpg' }],
    }));
    const assets = await service(transport).fetchAssets(5);
    expect(assets).toHaveLength(1);
    expect(calls[0]?.url).toBe('http://immich.local/api/search/random');
    expect(calls[0]?.headers?.['x-api-key']).toBe('secret-key');
    expect(calls[0]?.proxy).toBe('always');
  });

  it('albums → POST /search/metadata with albumIds', async () => {
    const albumConfig = { ...config, poolMode: 'albums' as const, albumIds: ['al1'] };
    const { transport, calls } = stubHttp(() => ({
      ok: true,
      status: 200,
      data: { assets: { items: [{ id: 'b1', type: 'IMAGE', originalFileName: 'b.jpg' }] } },
    }));
    const assets = await service(transport, albumConfig).fetchAssets(5);
    expect(assets[0]?.id).toBe('b1');
    expect(calls[0]?.url).toBe('http://immich.local/api/search/metadata');
    expect((calls[0]?.body as { albumIds: string[] }).albumIds).toEqual(['al1']);
  });

  it('memories → GET /memories and injects a memory title', async () => {
    const memConfig = { ...config, poolMode: 'memories' as const };
    const year = new Date().getFullYear() - 3;
    const { transport } = stubHttp(() => ({
      ok: true,
      status: 200,
      data: [{ data: { year }, assets: [{ id: 'm1', type: 'IMAGE', originalFileName: 'm.jpg' }] }],
    }));
    const assets = await service(transport, memConfig).fetchAssets(5);
    expect(assets[0]?.memoryTitle).toBe('3 years ago');
  });

  it('throws on a non-ok response so the data layer can fall back to cache', async () => {
    const { transport } = stubHttp(() => ({ ok: false, status: 500, data: null }));
    await expect(service(transport).fetchAssets(5)).rejects.toThrow(/random search failed/);
  });

  it('derives a stable pool key that changes with the pool', () => {
    const key = service(stubHttp(() => ({ ok: true, status: 200, data: [] })).transport).poolCacheKey();
    const albumKey = service(
      stubHttp(() => ({ ok: true, status: 200, data: [] })).transport,
      { ...config, poolMode: 'albums', albumIds: ['x'] },
    ).poolCacheKey();
    expect(key).not.toBe(albumKey);
  });
});

/** A transport that records cachePut(key, blob, policy) calls. */
function cachingTransport(): {
  transport: ImmichTransport;
  puts: Array<{ key: string; policy: CachePolicy | undefined }>;
} {
  const puts: Array<{ key: string; policy: CachePolicy | undefined }> = [];
  const transport: ImmichTransport = {
    request: () =>
      Promise.resolve({ status: 200, ok: true, headers: {}, data: new Blob(['img']) }),
    cacheGet: () => Promise.resolve(null),
    cachePut: (key, _blob, policy) => {
      puts.push({ key, policy });
      return Promise.resolve();
    },
  };
  return { transport, puts };
}

describe('ImmichService image caching policy', () => {
  it('writes with the size + age bounds from config', async () => {
    const { transport, puts } = cachingTransport();
    await service(transport, { ...config, cacheEnabled: true, cacheMaxMB: 500, cacheExpirationDays: 3 })
      .fetchImageBlob('asset-1');
    expect(puts).toHaveLength(1);
    expect(puts[0]?.policy).toEqual({
      maxBytes: 500 * 1024 * 1024,
      maxAgeMs: 3 * 24 * 60 * 60 * 1000,
    });
  });

  it('maps 0 expiration days to never-expire (Infinity)', async () => {
    const { transport, puts } = cachingTransport();
    await service(transport, { ...config, cacheEnabled: true, cacheExpirationDays: 0 })
      .fetchImageBlob('asset-1');
    expect(puts[0]?.policy?.maxAgeMs).toBe(Infinity);
  });
});
