import { describe, expect, it } from 'vitest';
import {
  isHttpsUrl,
  readCastConfig,
  resolveCastTarget,
  youTubeEmbedUrl,
  youTubeVideoId,
} from './resolve';
import { CAST_DEFAULT_CONFIG } from './types';

describe('readCastConfig', () => {
  it('defaults to idle and coerces unknown enums', () => {
    expect(readCastConfig({}).sourceKind).toBe('idle');
    expect(readCastConfig({ sourceKind: 'bogus' }).sourceKind).toBe('idle');
    expect(readCastConfig({ overlayMode: 'bogus' }).overlayMode).toBe('cover');
    expect(readCastConfig({ sourceKind: 'youtube' }).sourceKind).toBe('youtube');
  });
});

describe('youTubeVideoId', () => {
  it('accepts a bare 11-char id', () => {
    expect(youTubeVideoId('dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });
  it('extracts from watch, youtu.be, embed and shorts URLs', () => {
    expect(youTubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(youTubeVideoId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(youTubeVideoId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(youTubeVideoId('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });
  it('returns null for junk', () => {
    expect(youTubeVideoId('')).toBeNull();
    expect(youTubeVideoId('not a video')).toBeNull();
  });
});

describe('youTubeEmbedUrl', () => {
  it('uses the privacy-friendly nocookie host and honors mute', () => {
    const url = youTubeEmbedUrl('dQw4w9WgXcQ', true);
    expect(url).toContain('youtube-nocookie.com/embed/dQw4w9WgXcQ');
    expect(url).toContain('mute=1');
    expect(youTubeEmbedUrl('dQw4w9WgXcQ', false)).toContain('mute=0');
  });
});

describe('isHttpsUrl', () => {
  it('accepts only https', () => {
    expect(isHttpsUrl('https://example.com')).toBe(true);
    expect(isHttpsUrl('http://example.com')).toBe(false);
    expect(isHttpsUrl('javascript:alert(1)')).toBe(false);
    expect(isHttpsUrl('not a url')).toBe(false);
  });
});

describe('resolveCastTarget', () => {
  const base = CAST_DEFAULT_CONFIG;

  it('idle when source is idle', () => {
    expect(resolveCastTarget(base)).toEqual({ kind: 'idle' });
  });

  it('website requires an https url, else idle', () => {
    expect(resolveCastTarget({ ...base, sourceKind: 'website', sourceUrl: 'https://a.test' })).toEqual({
      kind: 'website',
      url: 'https://a.test',
    });
    expect(resolveCastTarget({ ...base, sourceKind: 'website', sourceUrl: 'http://a.test' })).toEqual({
      kind: 'idle',
    });
  });

  it('media requires an https url, else idle', () => {
    expect(resolveCastTarget({ ...base, sourceKind: 'media', sourceUrl: 'https://a.test/v.mp4' })).toEqual({
      kind: 'media',
      url: 'https://a.test/v.mp4',
    });
    expect(resolveCastTarget({ ...base, sourceKind: 'media', sourceUrl: '' })).toEqual({ kind: 'idle' });
  });

  it('youtube resolves to a nocookie embed, else idle', () => {
    const target = resolveCastTarget({ ...base, sourceKind: 'youtube', sourceUrl: 'https://youtu.be/dQw4w9WgXcQ' });
    expect(target.kind).toBe('youtube');
    if (target.kind === 'youtube') expect(target.embedUrl).toContain('youtube-nocookie.com');
    expect(resolveCastTarget({ ...base, sourceKind: 'youtube', sourceUrl: 'garbage' })).toEqual({ kind: 'idle' });
  });
});
