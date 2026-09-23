import { describe, expect, it } from 'vitest';
import { deriveMetadata, hasMetadata, type MetadataOptions } from './metadata';
import { readImmichConfig } from './config';
import type { ImmichAsset } from './types';

const ALL_ON: MetadataOptions = {
  showDate: true,
  showLocation: true,
  showDescription: true,
  showPeople: true,
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
};

describe('deriveMetadata', () => {
  it('includes enabled fields', () => {
    const meta = deriveMetadata(asset, ALL_ON);
    expect(meta.location).toContain('Oslo');
    expect(meta.description).toBe('Fjord trip');
    expect(meta.people).toBe('Alice');
    expect(hasMetadata(meta)).toBe(true);
  });

  it('respects toggles', () => {
    const meta = deriveMetadata(asset, { ...ALL_ON, showLocation: false, showDescription: false });
    expect(meta.location).toBeNull();
    expect(meta.description).toBeNull();
    expect(meta.people).toBe('Alice');
  });

  it('reports no metadata when everything is off', () => {
    const meta = deriveMetadata(asset, {
      showDate: false,
      showLocation: false,
      showDescription: false,
      showPeople: false,
    });
    expect(hasMetadata(meta)).toBe(false);
  });
});

describe('readImmichConfig — metadata overlay', () => {
  it('defaults the overlay to a bottom corner with location + date on', () => {
    const cfg = readImmichConfig({});
    expect(cfg.metadataPosition).toBe('bottom-right');
    expect(cfg.metadataShowLocation).toBe(true);
    expect(cfg.metadataShowDate).toBe(true);
  });

  it('validates the overlay position enum and can hide it', () => {
    expect(readImmichConfig({ metadataPosition: 'bogus' }).metadataPosition).toBe('bottom-right');
    expect(readImmichConfig({ metadataPosition: 'top-left' }).metadataPosition).toBe('top-left');
    expect(readImmichConfig({ metadataPosition: 'none' }).metadataPosition).toBe('none');
  });

  it('coerces pool/transition/layout enums', () => {
    const cfg = readImmichConfig({ poolMode: 'bogus', transition: 'zoom', layout: 'split' });
    expect(cfg.poolMode).toBe('random');
    expect(cfg.transition).toBe('zoom');
    expect(cfg.layout).toBe('split');
  });

  it('parses comma-joined multiselect strings into arrays', () => {
    expect(readImmichConfig({ albumIds: 'a1,a2' }).albumIds).toEqual(['a1', 'a2']);
  });
});
