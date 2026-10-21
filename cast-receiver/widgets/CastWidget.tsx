import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactWidgetProps } from '@/sandbox/react';
import { readCastConfig, resolveCastTarget } from '../config/resolve';
import { createCastQueueSnapshot } from '@/cast-protocol';
import { createScreenSession, type ScreenSession } from '../session/screen-session';

function applyPlayback(media: HTMLMediaElement, paused: boolean, volume: number, muted: boolean): void {
  media.volume = volume;
  media.muted = muted;
  if (paused) media.pause();
  else void media.play().catch(() => undefined);
}

export function CastWidget({ context }: ReactWidgetProps): React.JSX.Element {
  const config = useMemo(() => readCastConfig(context.config), [context.config]);
  const [receiver, setReceiver] = useState<ScreenSession['state']>(() => ({ status: 'connecting', command: null, presentationEpoch: 0, stream: null,
    peerCount: 0, error: null, roomJoinCode: '', authCode: '', relayUrl: config.relayUrl, senderUrl: config.senderUrl, queue: createCastQueueSnapshot(config.autoplay), pairingReveal: 0, pairingVisible: false }));
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => { const sessionContext = { ...context, config: { ...config } }; const session = createScreenSession(sessionContext); const unsubscribe = session.subscribe(setReceiver);
    return () => { unsubscribe(); session.close(); };
    // Session identity changes only with its connection settings; other render context updates must preserve the live peer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.relayUrl, config.senderUrl]);
  const effectiveConfig = useMemo(() => receiver.command
    ? { ...config, ...receiver.command, outputMode: receiver.queue.outputMode }
    : { ...config, sourceKind: 'idle' as const, outputMode: receiver.queue.outputMode }, [config, receiver.command, receiver.queue.outputMode]);
  const target = useMemo(() => resolveCastTarget(effectiveConfig), [effectiveConfig]);
  const paused = effectiveConfig.paused ?? false;
  const volume = effectiveConfig.volume ?? 1;
  const hasVisiblePresentation = effectiveConfig.outputMode !== 'audio-only' && (
    receiver.stream ? receiver.stream.getVideoTracks().length > 0 : target.kind !== 'idle'
  );
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
      ? { provider: 'youtube' as const, ...(target.videoId ? { videoId: target.videoId } : {}), muted: effectiveConfig.muted, paused, volume, outputMode: effectiveConfig.outputMode,
        ...(target.playlistId ? { playlistId: target.playlistId } : {}), ...(target.index ? { index: target.index } : {}) }
      : target.kind === 'website' ? { provider: 'website' as const, url: target.url } : null;
    const updatePresentation = async (): Promise<void> => {
      await context.setPresentation(next);
      await context.setPresentationMode(hasVisiblePresentation ? 'active' : 'normal');
    };
    void updatePresentation().catch((error: unknown) =>
      context.reportStatus('error', error instanceof Error ? error.message : String(error)));
    return undefined;
  }, [context, effectiveConfig.muted, effectiveConfig.outputMode, hasVisiblePresentation, paused, receiver.stream, target, volume]);
  useEffect(() => {
    const video = videoRef.current;
    if (video && target.kind === 'media') applyPlayback(video, paused, volume,
      effectiveConfig.muted || effectiveConfig.outputMode === 'video-only');
  }, [effectiveConfig.muted, effectiveConfig.outputMode, paused, target, volume]);
  if (receiver.stream) return effectiveConfig.outputMode !== 'audio-only' && receiver.stream.getVideoTracks().length > 0
    ? <video ref={videoRef} className="cast-media" autoPlay muted={effectiveConfig.muted || effectiveConfig.outputMode === 'video-only'} playsInline controls />
    : <div className="cast-root cast-empty" aria-label={context.locale.startsWith('de') ? 'Audioübertragung aktiv' : 'Audio casting active'} />;
  if (target.kind === 'youtube' || target.kind === 'website') return <div className="cast-root cast-active" data-overlay={config.overlayMode} />;
  if (target.kind === 'media') return <div className={`cast-root cast-active ${effectiveConfig.outputMode === 'audio-only' ? 'cast-audio-only' : ''}`} data-overlay={config.overlayMode}>
    <video ref={videoRef} className="cast-media" src={target.url} autoPlay muted={effectiveConfig.muted || effectiveConfig.outputMode === 'video-only'} playsInline controls />
  </div>;
  return <div className="cast-root cast-empty" />;
}
