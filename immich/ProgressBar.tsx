import type { CSSProperties } from 'react';
import type { ProgressBarPosition } from './types';

interface Props {
  position: ProgressBarPosition;
  durationSeconds: number;
  playing: boolean;
  /** Changing this remounts the bar, restarting the fill animation. */
  cycleKey: number;
}

/**
 * Slideshow progress bar. A CSS animation fills over the slide interval; the
 * `cycleKey` in the element key restarts it each slide, and pausing freezes it
 * via animation-play-state.
 */
export function ProgressBar({
  position,
  durationSeconds,
  playing,
  cycleKey,
}: Props): React.JSX.Element | null {
  if (position === 'none') return null;
  const style = {
    '--immich-progress-duration': `${durationSeconds}s`,
    animationPlayState: playing ? 'running' : 'paused',
  } as CSSProperties;
  return (
    <div className={`immich-progress immich-progress-${position}`}>
      <span key={cycleKey} className="immich-progress-fill" style={style} />
    </div>
  );
}
