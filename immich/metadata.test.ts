import { describe, expect, it } from 'vitest';
import { deriveMetadata, hasMetadata, type MetadataOptions } from '@/sandbox/photoframe';
import { readImmichConfig } from './config';
import type { ImmichAsset } from './types';

const ALL_ON: MetadataOptions = {
  showDate: true,
  showLocation: true,
  showDescription: true,
  showPeople: true,
  showAlbum: true,
  showTags: true,
};

const asset: ImmichAsset = {
  id: 'x',
  type: 'IMAGE',
  originalFileName: 'x.jpg',
  exifInfo: {
    city: 'Oslo',
    country: 'Norway',
    description: 'Fjord trip',
    dateTimeOriginal: '2023-06-01T10:00:00Z',
  },
  people: [{ id: 'p1', name: 'Alice' }],
  albumName: 'Vacations',
  tags: [{ id: 't1', name: 'nature', value: 'nature' }],
};

describe('deriveMetadata (shared SDK) with Immich assets', () => {
  it('includes enabled fields', () => {
    const meta = deriveMetadata(asset, ALL_ON);
    expect(meta.location).toContain('Oslo');
    expect(meta.description).toBe('Fjord trip');
    expect(meta.people).toBe('Alice');
    expect(meta.album).toBe('Vacations');
    expect(meta.tags).toBe('nature');
    expect(hasMetadata(meta)).toBe(true);
  });

  it('respects toggles', () => {
    const meta = deriveMetadata(asset, { ...ALL_ON, showLocation: false, showDescription: false, showAlbum: false });
    expect(meta.location).toBeNull();
    expect(meta.description).toBeNull();
    expect(meta.album).toBeNull();
    expect(meta.people).toBe('Alice');
    expect(meta.tags).toBe('nature');
  });

  it('reports no metadata when everything is off', () => {
    const meta = deriveMetadata(asset, {
      showDate: false,
      showLocation: false,
      showDescription: false,
      showPeople: false,
      showAlbum: false,
      showTags: false,
    });
    expect(hasMetadata(meta)).toBe(false);
  });
});

describe('readImmichConfig — connection + source', () => {
  it('coerces pool enum and defaults', () => {
    const cfg = readImmichConfig({ poolMode: 'bogus' });
    expect(cfg.poolMode).toBe('random');
    expect(cfg.serverUrl).toBe('');
    expect(cfg.apiKey).toBe('');
  });

  it('migrates legacy flat album/person/tag ids into the include filter', () => {
    const cfg = readImmichConfig({ albumIds: 'a1,a2', personIds: ['p1'] });
    expect(cfg.albums).toEqual({ include: ['a1', 'a2'], exclude: [] });
    expect(cfg.people).toEqual({ include: ['p1'], exclude: [] });
  });

  it('reads the tri-state include/exclude shape', () => {
    const cfg = readImmichConfig({ tags: { include: ['t1'], exclude: ['t2'] } });
    expect(cfg.tags).toEqual({ include: ['t1'], exclude: ['t2'] });
  });

  it('drops legacy albums/people/tags pool modes back to random', () => {
    expect(readImmichConfig({ poolMode: 'albums' }).poolMode).toBe('random');
  });
});
