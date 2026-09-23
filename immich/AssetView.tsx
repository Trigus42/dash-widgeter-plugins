import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { LoadedSlide } from './useSlideshow';
import type { ImageFit, TransitionMode } from './types';

/**
 * Map a transition mode to its CSS motion class. Kept pure + exported so a
 * regression test can assert zoom/pan/kenburns each get their own class (a
 * prior bug applied only a plain fade for all of them).
 */
export function transitionClass(transition: TransitionMode): string {
  switch (transition) {
    case 'kenburns':
      return 'immich-kenburns';
    case 'zoom':
      return 'immich-zoom';
    case 'pan':
      return 'immich-pan';
    case 'none':
      return 'immich-none';
    default:
      return 'immich-fadeonly';
  }
}

interface Props {
  slide: LoadedSlide;
  fit: ImageFit;
  transition: TransitionMode;
  durationSeconds: number;
  intervalSeconds: number;
}

/**
 * Renders one photo with its thumbhash blur-up backdrop and the configured
 * motion. Ken Burns pans toward the detected face when available so the
 * subject stays framed during the zoom.
 */
export function AssetView({
  slide,
  fit,
  transition,
  durationSeconds,
  intervalSeconds,
}: Props): React.JSX.Element {
  const origin = slide.face
    ? `${(slide.face.cx * 100).toFixed(1)}% ${(slide.face.cy * 100).toFixed(1)}%`
    : 'center';

  const motionClass = transitionClass(transition);

  const style = {
    '--immich-origin': origin,
    '--immich-motion-duration': `${intervalSeconds + durationSeconds}s`,
    '--immich-fade-duration': `${durationSeconds}s`,
  } as CSSProperties;

  // Own the object-URL lifecycle here: create it from the blob when the slide
  // mounts/changes and revoke it on cleanup. Because the URL lives and dies with
  // this element, there is no revoke-before-load race and no timers — it is
  // correct under React StrictMode's mount/unmount/remount by construction.
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  useEffect(() => {
    const url = URL.createObjectURL(slide.blob);
    setImageUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [slide.blob]);

  // Only reveal + animate the photo once its bytes are decoded. Before that we
  // show just the thumbhash backdrop — no half-loaded blur, no drifting alt.
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    setLoaded(false);
    if (imgRef.current?.complete && imgRef.current.naturalWidth > 0) setLoaded(true);
  }, [imageUrl]);

  return (
    <div className="immich-asset" style={style}>
      {slide.placeholder && (
        <img className="immich-backdrop" src={slide.placeholder} alt="" aria-hidden />
      )}
      {imageUrl && (
        <img
          key={slide.asset.id}
          ref={imgRef}
          className={`immich-photo immich-fit-${fit} ${loaded ? motionClass : ''}`}
          data-loaded={loaded}
          src={imageUrl}
          alt=""
          aria-hidden
          onLoad={() => setLoaded(true)}
        />
      )}
    </div>
  );
}
