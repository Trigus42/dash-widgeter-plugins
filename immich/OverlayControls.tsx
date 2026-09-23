import { useEffect } from 'react';

interface Props {
  playing: boolean;
  onNext: () => void;
  onBack: () => void;
  onTogglePlay: () => void;
  /** Keyboard shortcuts + pointer interaction only when not being edited. */
  active: boolean;
}

/**
 * Interactive overlay: left/right tap zones step back/forward and the center
 * toggles play/pause. Icons reveal on hover so they stay out of the way. Arrow
 * keys / space mirror the actions. Fully inert while the widget is edited.
 */
export function OverlayControls({
  playing,
  onNext,
  onBack,
  onTogglePlay,
  active,
}: Props): React.JSX.Element {
  useEffect(() => {
    if (!active) return;
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'ArrowRight') onNext();
      else if (e.key === 'ArrowLeft') onBack();
      else if (e.key === ' ') {
        e.preventDefault();
        onTogglePlay();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [active, onNext, onBack, onTogglePlay]);

  return (
    <div className="immich-controls" data-active={active}>
      <button type="button" className="immich-zone immich-zone-side" onClick={onBack} aria-label="Previous">
        <span className="immich-zone-btn">
          <ChevronLeft />
        </span>
      </button>
      <button
        type="button"
        className="immich-zone immich-zone-center"
        onClick={onTogglePlay}
        aria-label={playing ? 'Pause' : 'Play'}
      >
        <span className="immich-zone-btn immich-zone-btn-lg">
          {playing ? <PauseIcon /> : <PlayIcon />}
        </span>
      </button>
      <button type="button" className="immich-zone immich-zone-side" onClick={onNext} aria-label="Next">
        <span className="immich-zone-btn">
          <ChevronRight />
        </span>
      </button>
    </div>
  );
}

function ChevronLeft(): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function ChevronRight(): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function PlayIcon(): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}
function PauseIcon(): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M7 5h4v14H7zM13 5h4v14h-4z" />
    </svg>
  );
}
