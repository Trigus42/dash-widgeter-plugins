import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useWidgetData } from '@/sandbox/react';
import type { GuestWidgetContext } from '@/sandbox/sdk';
import { ImmichService, type ImmichTransport } from './service';
import { thumbhashToDataUrl } from './thumbhash';
import { panesForLayout, type FaceBox, type ImmichAsset, type ImmichConfig } from './types';

/** A slide ready to render: the decoded image blob plus display extras. */
export interface LoadedSlide {
  asset: ImmichAsset;
  blob: Blob;
  placeholder: string | null;
  face: FaceBox | null;
}

export interface SlideshowApi {
  slides: LoadedSlide[];
  playing: boolean;
  error: string | null;
  isLoading: boolean;
  progressKey: number;
  next: () => void;
  back: () => void;
  togglePlay: () => void;
}

const BATCH = 25;

/** Build an ImmichService bound to the sandbox host capabilities. */
function makeService(context: GuestWidgetContext, config: ImmichConfig): ImmichService {
  const transport: ImmichTransport = {
    request: (req) => context.http(req),
    cacheGet: (key) => context.cacheGet(key),
    cachePut: (key, blob, policy) => context.cachePut(key, blob, policy),
  };
  return new ImmichService(transport, config);
}

/**
 * Drives the Immich slideshow inside the plugin sandbox. The asset LIST comes
 * from the shared host data layer (cached, deduped, offline-resilient) via
 * useWidgetData. This hook owns the slideshow concerns the data layer doesn't:
 * the visible window, play/pause, next/back, thumbhash placeholders, split-
 * layout pairing, and loading the current window's image blobs.
 */
export function useSlideshow(
  context: GuestWidgetContext,
  config: ImmichConfig,
  tick: number,
): SlideshowApi {
  const configured = config.serverUrl !== '' && config.apiKey !== '';
  const panes = panesForLayout(config.layout);

  const service = useMemo(() => makeService(context, config), [context, config]);

  const poolKey = useMemo(() => service.poolCacheKey(), [service]);

  const listTtlMs = config.listTtlMinutes * 60 * 1000;
  const {
    data: assets,
    error,
    isLoading,
    refetch,
  } = useWidgetData<ImmichAsset[]>(context, {
    key: ['immich', poolKey],
    fetcher: () => service.fetchAssets(BATCH),
    enabled: configured,
    staleTimeMs: listTtlMs,
    staleMessage: 'Offline — showing cached photos',
    errorMessage: 'No photos found',
  });

  const pool = useMemo(() => assets ?? [], [assets]);

  const cursor = useRef(0);
  const [playing, setPlaying] = useState(true);
  const [slides, setSlides] = useState<LoadedSlide[]>([]);
  const [progressKey, setProgressKey] = useState(0);
  const generation = useRef(0);

  const showAt = useCallback(
    async (index: number) => {
      if (pool.length === 0) return;
      const gen = ++generation.current;
      const picks: ImmichAsset[] = [];
      for (let i = 0; i < panes; i += 1) {
        const asset = pool[(index + i) % pool.length];
        if (asset) picks.push(asset);
      }
      // Load each pick independently: a photo whose bytes aren't cached and
      // can't be fetched (offline) must be SKIPPED, not allowed to reject the
      // whole window — otherwise one uncached asset silently freezes the
      // slideshow. `settled` drops the failures; the next tick tries the next
      // window, so an offline gap self-heals as soon as a cached asset comes up.
      const settled = await Promise.all(
        picks.map(async (asset): Promise<LoadedSlide | null> => {
          try {
            const blob = await service.fetchImageBlob(asset.id);
            const placeholder = asset.thumbhash ? thumbhashToDataUrl(asset.thumbhash) : null;
            const face =
              config.transition === 'kenburns'
                ? await service.fetchFaceBox(asset.id).catch(() => null)
                : null;
            return { asset, blob, placeholder, face };
          } catch {
            return null;
          }
        }),
      );
      if (gen !== generation.current) return; // a newer navigation superseded us
      const loaded = settled.filter((slide): slide is LoadedSlide => slide !== null);
      // Nothing in this window loaded (all offline/uncached): keep the current
      // slide on screen rather than blanking; the timer advances to try again.
      if (loaded.length === 0) return;
      setSlides(loaded);
      setProgressKey((k) => k + 1);
    },
    [pool, service, panes, config.transition],
  );

  // Show the first window whenever the pool (re)loads.
  useEffect(() => {
    cursor.current = 0;
    if (pool.length > 0) void showAt(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poolKey, pool.length]);

  const next = useCallback(() => {
    const nextCursor = cursor.current + panes;
    // Reached the end of the batch: pull a fresh one (a new random selection
    // for the 'random' pool) and restart, so the slideshow doesn't loop the
    // same photos in the same order forever. The pool-reload effect resets the
    // cursor and shows the first window once the new batch arrives; until then
    // keep cycling the current batch so playback never stalls waiting on it.
    if (nextCursor >= pool.length) {
      refetch();
      cursor.current = 0;
    } else {
      cursor.current = nextCursor;
    }
    void showAt(cursor.current);
  }, [panes, showAt, pool.length, refetch]);

  const back = useCallback(() => {
    cursor.current = Math.max(0, cursor.current - panes);
    void showAt(cursor.current);
  }, [panes, showAt]);

  const togglePlay = useCallback(() => setPlaying((p) => !p), []);

  // Advance when the parent tick increments (parent owns the timer/progress).
  const lastTick = useRef(tick);
  useEffect(() => {
    if (tick !== lastTick.current) {
      lastTick.current = tick;
      if (playing && configured) next();
    }
  }, [tick, playing, configured, next]);

  return { slides, playing, error, isLoading, progressKey, next, back, togglePlay };
}
