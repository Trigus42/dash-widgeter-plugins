import { describe, expect, it } from 'vitest';
import { WebDavService, isImageResource, type WebDavTransport } from './service';
import type { HttpRequest } from '@/types';
import { WEBDAV_DEFAULT_CONFIG, type WebDavConfig } from './types';

const config: WebDavConfig = {
  ...WEBDAV_DEFAULT_CONFIG,
  folderUrl: 'https://cloud.example.com/dav/Photos',
  username: 'alice',
};

function stubHttp(
  handler: (req: HttpRequest) => { status: number; data: unknown },
): { transport: WebDavTransport; calls: HttpRequest[] } {
  const calls: HttpRequest[] = [];
  const transport: WebDavTransport = {
    request: (req) => {
      calls.push(req);
      const r = handler(req);
      return Promise.resolve({ status: r.status, ok: r.status < 400, headers: {}, data: r.data });
    },
  };
  return { transport, calls };
}

const ONE_IMAGE = `<?xml version="1.0"?>
<d:multistatus xmlns:d="DAV:">
  <d:response><d:href>/dav/Photos/a.jpg</d:href>
    <d:propstat><d:prop><d:getcontenttype>image/jpeg</d:getcontenttype><d:resourcetype/></d:prop>
    <d:status>HTTP/1.1 200 OK</d:status></d:propstat>
  </d:response>
</d:multistatus>`;

describe('isImageResource', () => {
  it('accepts by content-type or extension, rejects others', () => {
    expect(isImageResource('/x/a.jpg', null)).toBe(true);
    expect(isImageResource('/x/a', 'image/png')).toBe(true);
    expect(isImageResource('/x/a.txt', 'text/plain')).toBe(false);
    expect(isImageResource('/x/a.JPG', null)).toBe(true);
  });
});

describe('WebDavService.listImages', () => {
  it('issues PROPFIND with Depth 1 and a composed Basic-auth placeholder', async () => {
    const { transport, calls } = stubHttp(() => ({ status: 207, data: ONE_IMAGE }));
    const images = await new WebDavService(transport, config).listImages();
    expect(calls[0]?.method).toBe('PROPFIND');
    expect(calls[0]?.headers?.depth).toBe('1');
    // The password is never present; only the placeholder the host substitutes.
    expect(calls[0]?.headers?.authorization).toBe('{{basic:username:password}}');
    expect(calls[0]?.proxy).toBe('always');
    expect(images).toHaveLength(1);
    expect(images[0]?.href).toBe('https://cloud.example.com/dav/Photos/a.jpg');
  });

  it('uses Depth infinity when recursive and ends the collection URL with a slash', async () => {
    const { transport, calls } = stubHttp(() => ({ status: 207, data: ONE_IMAGE }));
    await new WebDavService(transport, { ...config, recursive: true }).listImages();
    expect(calls[0]?.headers?.depth).toBe('infinity');
    expect(calls[0]?.url).toBe('https://cloud.example.com/dav/Photos/');
  });

  it('falls back to Depth 1 when the server refuses an infinity listing', async () => {
    const { transport, calls } = stubHttp((req) =>
      req.headers?.depth === 'infinity' ? { status: 403, data: '' } : { status: 207, data: ONE_IMAGE },
    );
    const images = await new WebDavService(transport, { ...config, recursive: true }).listImages();
    expect(calls.map((c) => c.headers?.depth)).toEqual(['infinity', '1']);
    expect(images).toHaveLength(1);
  });

  it('omits the auth header entirely for an anonymous share', async () => {
    const { transport, calls } = stubHttp(() => ({ status: 207, data: ONE_IMAGE }));
    await new WebDavService(transport, { ...config, username: '' }).listImages();
    expect(calls[0]?.headers?.authorization).toBeUndefined();
  });

  it('throws when the listing fails entirely so the data layer can fall back to cache', async () => {
    const { transport } = stubHttp(() => ({ status: 500, data: '' }));
    await expect(new WebDavService(transport, config).listImages()).rejects.toThrow(/listing failed/);
  });
});

describe('WebDavService.imageRequest', () => {
  it('addresses the file by its absolute href with the auth placeholder', () => {
    const req = new WebDavService(stubHttp(() => ({ status: 207, data: '' })).transport, config)
      .imageRequest('https://cloud.example.com/dav/Photos/a.jpg', 'preview');
    expect(req.url).toBe('https://cloud.example.com/dav/Photos/a.jpg');
    expect(req.headers?.authorization).toBe('{{basic:username:password}}');
    expect(req.proxy).toBe('always');
  });

  it('derives a pool key that changes with folder + recursion', () => {
    const a = new WebDavService(stubHttp(() => ({ status: 207, data: '' })).transport, config).poolCacheKey();
    const b = new WebDavService(
      stubHttp(() => ({ status: 207, data: '' })).transport,
      { ...config, recursive: true },
    ).poolCacheKey();
    expect(a).not.toBe(b);
  });
});
