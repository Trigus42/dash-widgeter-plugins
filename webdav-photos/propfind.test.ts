import { describe, expect, it } from 'vitest';
import { parsePropfind } from './propfind';

const COLLECTION = 'https://cloud.example.com/dav/Photos/';

// A realistic Nextcloud-style multistatus with the collection self-entry, two
// images and one subfolder, using the `d:` prefix for the DAV namespace.
const MULTISTATUS = `<?xml version="1.0"?>
<d:multistatus xmlns:d="DAV:">
  <d:response>
    <d:href>/dav/Photos/</d:href>
    <d:propstat>
      <d:prop><d:resourcetype><d:collection/></d:resourcetype></d:prop>
      <d:status>HTTP/1.1 200 OK</d:status>
    </d:propstat>
  </d:response>
  <d:response>
    <d:href>/dav/Photos/beach.jpg</d:href>
    <d:propstat>
      <d:prop>
        <d:getcontenttype>image/jpeg</d:getcontenttype>
        <d:getlastmodified>Wed, 01 Jun 2023 10:00:00 GMT</d:getlastmodified>
        <d:resourcetype/>
      </d:prop>
      <d:status>HTTP/1.1 200 OK</d:status>
    </d:propstat>
  </d:response>
  <d:response>
    <d:href>/dav/Photos/notes.txt</d:href>
    <d:propstat>
      <d:prop><d:getcontenttype>text/plain</d:getcontenttype><d:resourcetype/></d:prop>
      <d:status>HTTP/1.1 200 OK</d:status>
    </d:propstat>
  </d:response>
  <d:response>
    <d:href>/dav/Photos/sub/</d:href>
    <d:propstat>
      <d:prop><d:resourcetype><d:collection/></d:resourcetype></d:prop>
      <d:status>HTTP/1.1 200 OK</d:status>
    </d:propstat>
  </d:response>
</d:multistatus>`;

describe('parsePropfind', () => {
  it('drops the collection self-entry and returns children', () => {
    const entries = parsePropfind(MULTISTATUS, COLLECTION);
    const paths = entries.map((e) => e.href);
    expect(paths).not.toContain('https://cloud.example.com/dav/Photos/');
    expect(paths).toContain('https://cloud.example.com/dav/Photos/beach.jpg');
  });

  it('resolves relative hrefs against the server origin', () => {
    const entries = parsePropfind(MULTISTATUS, COLLECTION);
    const beach = entries.find((e) => e.href.endsWith('beach.jpg'));
    expect(beach?.href).toBe('https://cloud.example.com/dav/Photos/beach.jpg');
  });

  it('marks collections and parses content type + last-modified', () => {
    const entries = parsePropfind(MULTISTATUS, COLLECTION);
    const beach = entries.find((e) => e.href.endsWith('beach.jpg'));
    expect(beach?.isCollection).toBe(false);
    expect(beach?.contentType).toBe('image/jpeg');
    expect(beach?.lastModified).toBe(Date.parse('Wed, 01 Jun 2023 10:00:00 GMT'));
    const sub = entries.find((e) => e.href.endsWith('/sub/'));
    expect(sub?.isCollection).toBe(true);
  });

  it('tolerates an unprefixed DAV namespace', () => {
    const xml = `<?xml version="1.0"?>
      <multistatus xmlns="DAV:">
        <response><href>/dav/Photos/a.png</href>
          <propstat><prop><getcontenttype>image/png</getcontenttype><resourcetype/></prop>
          <status>HTTP/1.1 200 OK</status></propstat>
        </response>
      </multistatus>`;
    const entries = parsePropfind(xml, COLLECTION);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.contentType).toBe('image/png');
  });

  it('returns nothing for malformed XML instead of throwing', () => {
    expect(parsePropfind('<not-xml', COLLECTION)).toEqual([]);
  });
});
