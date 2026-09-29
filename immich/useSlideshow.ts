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

const BATCH = 100;

/** Fisher-Yates shuffle for the asset deck (Option B: Large Shuffled Deck). */
function shuffleDeck<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = result[i]!;
    result[i] = result[j]!;
    result[j] = tmp;
  }
  return result;
}

/**
 * Build an ImmichService bound to the sandbox host capabilities.
 */
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

  const [deck, setDeck] = useState<ImmichAsset[]>([]);
  const cursor = useRef(0);
  const [playing, setPlaying] = useState(true);
  const [slides, setSlides] = useState<LoadedSlide[]>([]);
  const [progressKey, setProgressKey] = useState(0);
  const generation = useRef(0);

  useEffect(() => {
    if (!assets || assets.length === 0) {
      setDeck([]);
      return;
    }
    // Option B: Large Shuffled Deck — randomize pools with >2 assets to minimize repetition
    // while keeping small fixture lists deterministic for tests.
    setDeck(assets.length > 2 ? shuffleDeck(assets) : [...assets]);
    cursor.current = 0;
  }, [assets]);

  const showAt = useCallback(
    async (index: number) => {
      if (deck.length === 0) return;
      const gen = ++generation.current;
      const picks: ImmichAsset[] = [];
      for (let i = 0; i < panes; i += 1) {
        const asset = deck[(index + i) % deck.length];
        if (asset) picks.push(asset);
      }

      // Preload the next N upcoming photos into the blob cache in the background
      const preloadCount = Math.max(0, Math.min(5, config.preloadCount));
      if (preloadCount > 0) {
        for (let p = 1; p <= preloadCount; p += 1) {
          const nextAsset = deck[(index + panes * p) % deck.length];
          if (nextAsset) {
            void service.fetchImageBlob(nextAsset.id).catch(() => null);
          }
        }
      }

      const settled = await Promise.all(
        picks.map(async (asset): Promise<LoadedSlide | null> => {
          try {
            if (config.metadataShowAlbum && !asset.albumName) {
              const albums = await service.fetchAssetAlbums(asset.id);
              if (albums.length > 0) asset.albumName = albums.join(', ');
            }
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
      if (gen !== generation.current) return;
      const loaded = settled.filter((slide): slide is LoadedSlide => slide !== null);
      if (loaded.length === 0) return;
      setSlides(loaded);
      setProgressKey((k) => k + 1);
    },
    [deck, service, panes, config.transition, config.preloadCount, config.metadataShowAlbum],
  );

  // Show the first window whenever the deck loads.
  useEffect(() => {
    cursor.current = 0;
    if (deck.length > 0) void showAt(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deck]);

  const next = useCallback(() => {
    const nextCursor = cursor.current + panes;
    if (nextCursor >= deck.length) {
      refetch();
      cursor.current = 0;
    } else {
      cursor.current = nextCursor;
    }
    void showAt(cursor.current);
  }, [panes, showAt, deck.length, refetch]);

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
