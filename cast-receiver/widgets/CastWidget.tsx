import { useEffect, useMemo, useState } from 'react';
import type { ReactWidgetProps } from '@/sandbox/react';
import { readCastConfig, resolveCastTarget } from '../config/resolve';
import { createCastQueueSnapshot } from '@/cast-protocol';
import { createScreenSession } from '../session/screen-session';
import type { ScreenSession } from '../session/session-publication';
import { publicFailure } from '@/protocol/telemetry';
import { isAudioPresentation, type MediaPresentation } from '@/protocol/media';

import { LivePlayback } from './LivePlayback';

export function CastWidget({ context }: ReactWidgetProps): React.JSX.Element {
  const config = useMemo(() => readCastConfig(context.config), [context.config]);
  const [receiver, setReceiver] = useState<ScreenSession['state']>(() => ({ status: 'connecting', command: null, presentationEpoch: 0, stream: null,
    peerCount: 0, error: null, roomJoinCode: '', authCode: '', relayUrl: config.relayUrl, senderUrl: config.senderUrl, queue: createCastQueueSnapshot(config.autoplay), pairingReveal: 0, pairingVisible: false }));
  useEffect(() => { const sessionContext = { ...context, config: { ...config } }; const session = createScreenSession(sessionContext); const unsubscribe = session.subscribe(setReceiver);
    return () => { unsubscribe(); session.close(); };
    // Session identity changes only with its connection settings; other render context updates must preserve the live peer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.relayUrl, config.senderUrl]);
  // A live sender command wins; otherwise fall back to the widget's own
  // statically configured source (sourceKind/sourceUrl). The default source is
  // 'idle', so an unconfigured receiver still just shows the pairing screen.
  const effectiveConfig = useMemo(() => receiver.command
    ? { ...config, ...receiver.command, adapter: receiver.command.adapter ?? 'video', outputMode: receiver.queue.outputMode }
    : { ...config, outputMode: receiver.queue.outputMode }, [config, receiver.command, receiver.queue.outputMode]);
  const target = useMemo(() => resolveCastTarget(effectiveConfig), [effectiveConfig]);
  const paused = effectiveConfig.paused ?? false;
  const volume = effectiveConfig.volume ?? 1;
  const liveMedia = Boolean(receiver.stream || receiver.relayMedia);
  const mediaPresentation = useMemo<MediaPresentation | null>(() => target.kind === 'media' ? {
    provider: 'media', adapter: target.adapter, src: target.url, paused, muted: effectiveConfig.muted, volume, outputMode: effectiveConfig.outputMode,
  } : null, [effectiveConfig.muted, effectiveConfig.outputMode, paused, target, volume]);
  const hasVisiblePresentation = effectiveConfig.outputMode !== 'audio-only' && (
    receiver.stream ? receiver.stream.getVideoTracks().length > 0 : receiver.relayMedia ? receiver.relayMedia.hasVideo
      : mediaPresentation ? !isAudioPresentation(mediaPresentation) : target.kind !== 'idle'
  );
  useEffect(() => {
    const stream = receiver.stream;
    if (!stream) return;
    const tracks = stream.getTracks();
    const describe = (): void => {
      // A screen share legitimately carries video with no audio track; that is
      // a normal state, not a failure, so it must not raise the error indicator.
      if (tracks.every((track) => track.readyState === 'ended')) context.reportStatus('error', 'The shared stream ended.');
      else context.reportStatus('ok', '');
    };
    tracks.forEach((track) => track.addEventListener('ended', describe)); describe();
    return () => tracks.forEach((track) => track.removeEventListener('ended', describe));
  }, [context, receiver.stream]);
  useEffect(() => {
    const next = liveMedia ? null : target.kind === 'youtube'
      ? { provider: 'youtube' as const, ...(target.videoId ? { videoId: target.videoId } : {}), muted: effectiveConfig.muted, paused, volume, outputMode: effectiveConfig.outputMode,
        ...(target.playlistId ? { playlistId: target.playlistId } : {}), ...(target.index ? { index: target.index } : {}) }
      : target.kind === 'website' ? { provider: 'website' as const, url: target.url } : mediaPresentation;
    const updatePresentation = async (): Promise<void> => {
      await context.setPresentation(next);
      await context.setPresentationMode(hasVisiblePresentation ? 'active' : 'normal');
    };
    void updatePresentation().catch((cause: unknown) => {
      context.telemetry.disclose({ operation: 'cast.presentation.update', category: 'dependency_transport', cause, publicMessage: publicFailure('dependency_transport', 'The plugin service is temporarily unavailable.').message });
    });
    return undefined;
  }, [context, effectiveConfig.muted, effectiveConfig.outputMode, hasVisiblePresentation, liveMedia, mediaPresentation, paused, target, volume]);
  if (liveMedia) {
    const media = <LivePlayback context={context} stream={receiver.stream} {...(receiver.relayMedia ? { relayUrl: receiver.relayMedia.url, relayHasAudio: receiver.relayMedia.hasAudio } : {})}
      paused={paused} volume={volume} muted={effectiveConfig.muted || effectiveConfig.outputMode === 'video-only'} visible={hasVisiblePresentation}
      audioOnly={receiver.stream ? receiver.stream.getVideoTracks().length === 0 : !receiver.relayMedia?.hasVideo} />;
    return <div className={`cast-root ${hasVisiblePresentation ? 'cast-active' : 'cast-empty'}`}
      aria-label={!hasVisiblePresentation ? context.locale.startsWith('de') ? 'Audioübertragung aktiv' : 'Audio casting active' : undefined}>{media}</div>;
  }
  if (target.kind === 'youtube' || target.kind === 'website' || target.kind === 'media') return <div className={`cast-root ${hasVisiblePresentation ? 'cast-active' : 'cast-empty'}`} data-overlay={config.overlayMode} />;
  return <div className="cast-root cast-empty" />;
}
