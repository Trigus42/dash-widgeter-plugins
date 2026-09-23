import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactWidgetProps } from '@/sandbox/react';
import { readImmichConfig } from './config';
import { useSlideshow } from './useSlideshow';
import { AssetView } from './AssetView';
import { OverlayControls } from './OverlayControls';
import { ProgressBar } from './ProgressBar';
import { MetadataOverlay } from './MetadataOverlay';

/** Full ImmichFrame-equivalent slideshow widget with strong local caching. */
export function PhotoFrameWidget({ context }: ReactWidgetProps): React.JSX.Element {
  const config = useMemo(() => readImmichConfig(context.config), [context.config]);
  const configured = config.serverUrl !== '' && config.apiKey !== '';

  const [tick, setTick] = useState(0);
  const show = useSlideshow(context, config, tick);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Parent owns the advance timer so play/pause and manual next stay in sync
  // with the progress bar. Manual navigation also resets the timer.
  const resetTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (!show.playing || !configured) return;
    timerRef.current = setInterval(
      () => setTick((t) => t + 1),
      Math.max(3, config.intervalSeconds) * 1000,
    );
  }, [show.playing, configured, config.intervalSeconds]);

  useEffect(() => {
    resetTimer();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [resetTimer, show.progressKey]);

  const handleNext = useCallback(() => {
    show.next();
    resetTimer();
  }, [show, resetTimer]);

  const handleBack = useCallback(() => {
    show.back();
    resetTimer();
  }, [show, resetTimer]);

  const metadataOptions = {
    showDate: config.metadataShowDate,
    showLocation: config.metadataShowLocation,
    showDescription: config.metadataShowDescription,
    showPeople: config.metadataShowPeople,
  };

  if (!configured) {
    return (
      <div className="immich-frame immich-empty">
        <div>
          <strong>Immich Photo Frame</strong>
          <p>Open settings to add your Immich server URL and API key.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`immich-frame immich-layout-${config.layout}`}>
      <div className="immich-panes">
        {show.slides.map((slide) => (
          <div className="immich-pane" key={slide.asset.id}>
            <AssetView
              slide={slide}
              fit={config.imageFit}
              transition={config.transition}
              durationSeconds={config.transitionSeconds}
              intervalSeconds={config.intervalSeconds}
            />
            <MetadataOverlay
              asset={slide.asset}
              position={config.metadataPosition}
              options={metadataOptions}
            />
          </div>
        ))}
      </div>

      <ProgressBar
        position={config.progressBar}
        durationSeconds={Math.max(3, config.intervalSeconds)}
        playing={show.playing}
        cycleKey={show.progressKey}
      />

      {config.showControls && (
        <OverlayControls
          playing={show.playing}
          onNext={handleNext}
          onBack={handleBack}
          onTogglePlay={show.togglePlay}
          active={context.isEditing === false}
        />
      )}

      {show.isLoading && show.slides.length === 0 && (
        <div className="immich-status">Loading photos…</div>
      )}
      {show.error && show.slides.length === 0 && (
        <div className="immich-status immich-error" role="alert">
          {show.error}
        </div>
      )}
    </div>
  );
}
