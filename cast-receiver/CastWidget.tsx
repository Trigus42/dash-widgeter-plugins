import { useEffect, useMemo, useRef } from 'react';
import type { ReactWidgetProps } from '@/sandbox/react';
import { readCastConfig, resolveCastTarget } from './resolve';
import { useCastSession } from './session-store';

function applyPlayback(media: HTMLMediaElement, paused: boolean, volume: number, muted: boolean): void {
  media.volume = volume;
  media.muted = muted;
  if (paused) media.pause();
  else void media.play().catch(() => undefined);
}

export function CastWidget({ context }: ReactWidgetProps): React.JSX.Element {
  const config = useMemo(() => readCastConfig(context.config), [context.config]);
  const receiver = useCastSession(context);
  const videoRef = useRef<HTMLVideoElement>(null);
  const effectiveConfig = useMemo(() => receiver.command
    ? { ...config, ...receiver.command }
    : { ...config, sourceKind: 'idle' as const }, [config, receiver.command]);
  const target = useMemo(() => resolveCastTarget(effectiveConfig), [effectiveConfig]);
  const paused = effectiveConfig.paused ?? false;
  const volume = effectiveConfig.volume ?? 1;
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !receiver.stream) return;
    video.srcObject = receiver.stream;
    applyPlayback(video, paused, volume, effectiveConfig.muted);
    return () => { video.srcObject = null; };
  }, [effectiveConfig.muted, paused, receiver.stream, volume]);
  useEffect(() => {
    const stream = receiver.stream;
    if (!stream) return;
    const tracks = stream.getTracks();
    const describe = (): void => {
      if (tracks.every((track) => track.readyState === 'ended')) context.reportStatus('error', 'The shared stream ended.');
      else if (stream.getAudioTracks().length === 0) context.reportStatus('error', 'This shared stream has no audio.');
      else context.reportStatus('ok', '');
    };
    tracks.forEach((track) => track.addEventListener('ended', describe)); describe();
    return () => tracks.forEach((track) => track.removeEventListener('ended', describe));
  }, [context, receiver.stream]);
  useEffect(() => {
    const next = receiver.stream ? null : target.kind === 'youtube'
      ? { provider: 'youtube' as const, videoId: target.videoId, muted: effectiveConfig.muted, paused, volume, outputMode: effectiveConfig.outputMode }
      : target.kind === 'website' ? { provider: 'website' as const, url: target.url } : null;
    void context.setPresentation(next).catch((error: unknown) =>
      context.reportStatus('error', error instanceof Error ? error.message : String(error)));
    return () => { void context.setPresentation(null).catch(() => undefined); };
  }, [context, effectiveConfig.muted, effectiveConfig.outputMode, paused, receiver.stream, target, volume]);
  useEffect(() => {
    const video = videoRef.current;
    if (video && target.kind === 'media') applyPlayback(video, paused, volume,
      effectiveConfig.muted || effectiveConfig.outputMode === 'video-only');
  }, [effectiveConfig.muted, effectiveConfig.outputMode, paused, target, volume]);
  if (receiver.stream) return effectiveConfig.outputMode !== 'audio-only' && receiver.stream.getVideoTracks().length > 0
    ? <video ref={videoRef} className="cast-media" autoPlay muted={effectiveConfig.muted || effectiveConfig.outputMode === 'video-only'} playsInline controls />
    : <div className="cast-root cast-empty" aria-label="Audio casting active" />;
  if (target.kind === 'youtube' || target.kind === 'website') return <div className="cast-root cast-active" data-overlay={config.overlayMode} />;
  if (target.kind === 'media') return <div className={`cast-root cast-active ${effectiveConfig.outputMode === 'audio-only' ? 'cast-audio-only' : ''}`} data-overlay={config.overlayMode}>
    <video ref={videoRef} className="cast-media" src={target.url} autoPlay muted={effectiveConfig.muted || effectiveConfig.outputMode === 'video-only'} playsInline controls />
  </div>;
  return <div className="cast-root cast-empty" />;
}
