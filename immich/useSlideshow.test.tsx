import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { GuestWidgetContext } from '@/sandbox/sdk';
import { IMMICH_DEFAULT_CONFIG, type ImmichAsset, type ImmichConfig } from './types';

/**
 * Regression for the offline-window bug: showAt loaded each pick with a single
 * Promise.all, so ONE uncached/failed image (offline) rejected the whole window
 * and silently froze the slideshow. It must instead skip the failed pick and
 * still render whatever loaded.
 */

// `vi.hoisted` so both the pool and the spy exist when the hoisted vi.mock
// factories reference them (factories are lifted above module-top consts).
const { POOL, fetchImageBlob, refetch } = vi.hoisted(() => ({
  POOL: [
    { id: 'ok-1', type: 'IMAGE', originalFileName: 'ok1.jpg' },
    { id: 'fail-2', type: 'IMAGE', originalFileName: 'fail2.jpg' },
  ] as ImmichAsset[],
  // 'fail-*' ids reject (simulating an offline/uncached image); any other id
  // (incl. undefined from an out-of-range window) resolves to a blob.
  fetchImageBlob: vi.fn((assetId?: string) =>
    assetId?.startsWith('fail')
      ? Promise.reject(new Error('offline: not cached'))
      : Promise.resolve(new Blob(['img'], { type: 'image/jpeg' })),
  ),
  refetch: vi.fn(),
}));

// useWidgetData → return our fixed pool synchronously as the query snapshot.
vi.mock('@/sandbox/react', () => ({
  useWidgetData: () => ({ data: POOL, error: null, isLoading: false, isStale: false, refetch }),
}));
vi.mock('./service', () => ({
  ImmichService: class {
    fetchImageBlob = fetchImageBlob;
    fetchFaceBox = () => Promise.resolve(null);
    poolCacheKey = () => 'test-pool-key';
  },
}));

import { useSlideshow } from './useSlideshow';

function ctx(): GuestWidgetContext {
  return {
    instanceId: 'i1',
    widgetId: 'immich.photoframe',
    isEditing: false,
    config: {},
    http: vi.fn(),
    useData: vi.fn(),
    callService: vi.fn(),
    log: vi.fn(),
    cacheGet: () => Promise.resolve(null),
    cachePut: () => Promise.resolve(),
    updateConfig: vi.fn(),
    reportStatus: vi.fn(),
  } as unknown as GuestWidgetContext;
}

function config(overrides: Partial<ImmichConfig> = {}): ImmichConfig {
  return { ...IMMICH_DEFAULT_CONFIG, serverUrl: 'https://x', apiKey: 'k', ...overrides };
}

describe('useSlideshow — offline window resilience', () => {
  beforeEach(() => {
    fetchImageBlob.mockClear();
    refetch.mockClear();
  });

  it('renders the loadable photo even when another pick fails (single layout)', async () => {
    const { result } = renderHook(() => useSlideshow(ctx(), config({ layout: 'single' }), 0));
    // First window is the single ok-1 asset.
    await waitFor(() => expect(result.current.slides).toHaveLength(1));
    expect(result.current.slides[0]!.asset.id).toBe('ok-1');
  });

  it('a failing pick is skipped, not fatal, in a split window', async () => {
    // Split layout pairs two panes: ok-1 + fail-2. Old code rejected the whole
    // window; now it must render just ok-1.
    const { result } = renderHook(() => useSlideshow(ctx(), config({ layout: 'split' }), 0));
    await waitFor(() => expect(result.current.slides.length).toBeGreaterThan(0));
    expect(result.current.slides.map((s) => s.asset.id)).toEqual(['ok-1']);
  });

  it('refetches a fresh batch when the pool is exhausted instead of looping', async () => {
    const { result } = renderHook(() => useSlideshow(ctx(), config({ layout: 'single' }), 0));
    await waitFor(() => expect(result.current.slides).toHaveLength(1)); // showing index 0
    expect(refetch).not.toHaveBeenCalled();

    // Pool has 2 assets: next() → index 1 (still in range, no refetch).
    await act(async () => result.current.next());
    expect(refetch).not.toHaveBeenCalled();

    // next() again would pass the end (index 2 of 2) → refetch + restart at 0.
    await act(async () => result.current.next());
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});
