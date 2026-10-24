import { describe, expect, it } from 'vitest';
import {
  isHttpsUrl,
  readCastConfig,
  resolveCastTarget,
  youTubeEmbedUrl,
  youTubeVideoId,
} from './resolve';
import { CAST_DEFAULT_CONFIG } from '../types';

describe('readCastConfig', () => {
  it('defaults to idle and coerces unknown enums', () => {
    expect(readCastConfig({}).sourceKind).toBe('idle');
    expect(readCastConfig({ sourceKind: 'bogus' }).sourceKind).toBe('idle');
    expect(readCastConfig({ sourceKind: 'spotify' }).sourceKind).toBe('idle');
    expect(readCastConfig({ sourceKind: 'youtube' }).sourceKind).toBe('youtube');
  });


  it('bounds the SAS timeout and defaults to 60 seconds', () => {
    expect(readCastConfig({}).sasTimeoutSeconds).toBe(60);
    expect(readCastConfig({ sasTimeoutSeconds: 10 }).sasTimeoutSeconds).toBe(10);
    expect(readCastConfig({ sasTimeoutSeconds: 300 }).sasTimeoutSeconds).toBe(300);
    expect(readCastConfig({ sasTimeoutSeconds: 9 }).sasTimeoutSeconds).toBe(60);
    expect(readCastConfig({ sasTimeoutSeconds: 301 }).sasTimeoutSeconds).toBe(60);
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

describe('YouTube playlists', () => {
  it('preserves validated list and index parameters in the embed URL', () => {
    const target = resolveCastTarget({ ...CAST_DEFAULT_CONFIG, sourceKind: 'youtube', sourceUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PL1234567890abc&index=12' });
    expect(target).toMatchObject({ kind: 'youtube', videoId: 'dQw4w9WgXcQ', playlistId: 'PL1234567890abc', index: 12 });
    if (target.kind === 'youtube') { expect(target.embedUrl).toContain('list=PL1234567890abc'); expect(target.embedUrl).toContain('index=11'); }
  });
  it('resolves playlist-only URLs with zero-based provider indexes', () => {
    const target = resolveCastTarget({ ...CAST_DEFAULT_CONFIG, sourceKind: 'youtube', sourceUrl: 'https://www.youtube.com/playlist?list=PL1234567890abc&index=12' });
    expect(target).toMatchObject({ kind: 'youtube', playlistId: 'PL1234567890abc', index: 12 });
    if (target.kind === 'youtube') {
      expect(target.videoId).toBeUndefined();
      expect(target.embedUrl).toContain('/embed/videoseries?');
      expect(target.embedUrl).toContain('listType=playlist');
      expect(target.embedUrl).toContain('index=11');
    }
  });
  it('normalizes YouTube Music watch URLs and rejects insecure or lookalike hosts', () => {
    expect(resolveCastTarget({ ...CAST_DEFAULT_CONFIG, sourceKind: 'youtube', sourceUrl: 'https://music.youtube.com/watch?v=dQw4w9WgXcQ&list=PL1234567890abc' }))
      .toMatchObject({ kind: 'youtube', videoId: 'dQw4w9WgXcQ', playlistId: 'PL1234567890abc' });
    expect(resolveCastTarget({ ...CAST_DEFAULT_CONFIG, sourceKind: 'youtube', sourceUrl: 'http://music.youtube.com/watch?v=dQw4w9WgXcQ' })).toEqual({ kind: 'idle' });
    expect(resolveCastTarget({ ...CAST_DEFAULT_CONFIG, sourceKind: 'youtube', sourceUrl: 'https://music.youtube.com.example/watch?v=dQw4w9WgXcQ' })).toEqual({ kind: 'idle' });
  });
  it('drops malformed navigation and rejects lookalike hosts', () => {
    expect(youTubeVideoId('https://youtube.example/watch?v=dQw4w9WgXcQ')).toBeNull();
    const url = youTubeEmbedUrl('dQw4w9WgXcQ', false, false);
    expect(url).toContain('autoplay=0');
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


  it('preserves an HTTPS website URL exactly', () => {
    expect(resolveCastTarget({ ...base, sourceKind: 'website', sourceUrl: 'https://jellyfin.arr.taube.ovh/web/' }))
      .toEqual({ kind: 'website', url: 'https://jellyfin.arr.taube.ovh/web/' });
  });
});
