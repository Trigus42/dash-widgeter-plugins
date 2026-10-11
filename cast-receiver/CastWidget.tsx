import { useEffect, useMemo, useRef } from 'react';
import type { ReactWidgetProps } from '@/sandbox/react';
import { readCastConfig, resolveCastTarget } from './resolve';
import { useReceiver } from './useReceiver';
import de from './locales/de.json';

interface CastStrings { idleTitle: string; idleHint: string; pairingLabel: string; openSender: string }
const EN: CastStrings = {
  idleTitle: 'Ready to cast', idleHint: 'Open the sender and enter this pairing code.',
  pairingLabel: 'Pairing code', openSender: 'Open sender',
};

function castStrings(locale: string): CastStrings {
  return locale.split('-')[0] === 'de'
    ? { idleTitle: de.runtime.idleTitle, idleHint: de.runtime.idleHint,
      pairingLabel: de.runtime.pairingLabel, openSender: de.runtime.openSender }
    : EN;
}

export function CastWidget({ context }: ReactWidgetProps): React.JSX.Element {
  const config = useMemo(() => readCastConfig(context.config), [context.config]);
  const strings = useMemo(() => castStrings(context.locale), [context.locale]);
  const receiver = useReceiver(context);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const effectiveConfig = useMemo(() => receiver.command
    ? { ...config, ...receiver.command }
    : { ...config, sourceKind: 'idle' as const }, [config, receiver.command]);
  const target = useMemo(() => resolveCastTarget(effectiveConfig), [effectiveConfig]);
  useEffect(() => {
    if (target.kind === 'website' || target.kind === 'media') {
      context.log('info', 'Resolved Cast target', { kind: target.kind, url: target.url });
    }
  }, [context, target]);
  useEffect(() => {
    const media = receiver.stream?.getVideoTracks().length ? videoRef.current : audioRef.current;
    if (!media) return;
    media.srcObject = receiver.stream;
    void media.play().catch((error: unknown) => {
      if (error instanceof DOMException && error.name === 'NotAllowedError') {
        context.reportStatus('error', 'Press Play to enable shared audio.');
      }
    });
    return () => { media.srcObject = null; };
  }, [context, receiver.stream]);
  useEffect(() => {
    const stream = receiver.stream;
    if (!stream) return;
    const describe = (): void => {
      const audio = stream.getAudioTracks();
      const video = stream.getVideoTracks();
      if (stream.getTracks().every((track) => track.readyState === 'ended')) {
        context.reportStatus('error', 'The shared stream ended.');
      } else if (audio.length === 0) {
        context.reportStatus('error', 'This shared stream has no audio.');
      } else {
        context.reportStatus('ok', `${video.length ? 'Screen and audio' : 'Audio'} sharing active`);
      }
    };
    const tracks = stream.getTracks();
    tracks.forEach((track) => { track.addEventListener('ended', describe); track.addEventListener('mute', describe); track.addEventListener('unmute', describe); });
    describe();
    return () => tracks.forEach((track) => { track.removeEventListener('ended', describe); track.removeEventListener('mute', describe); track.removeEventListener('unmute', describe); });
  }, [context, receiver.stream]);
  useEffect(() => {
    const next = receiver.stream ? null : target.kind === 'youtube'
      ? { provider: 'youtube' as const, videoId: target.videoId, muted: effectiveConfig.muted }
      : target.kind === 'spotify'
        ? { provider: 'spotify' as const, kind: target.spotifyKind, id: target.spotifyId }
        : target.kind === 'website'
          ? { provider: 'website' as const, url: target.url }
          : null;
    void context.setPresentation(next).catch((error: unknown) =>
      context.reportStatus('error', error instanceof Error ? error.message : String(error)));
    return () => { void context.setPresentation(null).catch(() => undefined); };
  }, [context, target, effectiveConfig.muted, receiver.stream]);
  if (receiver.stream) return receiver.stream.getVideoTracks().length > 0
    ? <video ref={videoRef} className="cast-media" autoPlay muted={effectiveConfig.muted} playsInline controls />
    : <div className="cast-root cast-audio"><span>Shared audio</span><audio ref={audioRef} autoPlay muted={effectiveConfig.muted} controls /></div>;
  if (target.kind === 'youtube' || target.kind === 'spotify' || target.kind === 'website') return <div className="cast-root cast-active" data-overlay={config.overlayMode} />;
  if (target.kind === 'idle') {
    if (!config.showPairingWhenIdle) return <div className="cast-root cast-idle-blank" />;
    const senderUrl = config.senderUrl && receiver.roomCode
      ? `${config.senderUrl}?relay=${encodeURIComponent(config.relayUrl)}&code=${receiver.roomCode}` : '';
    return <div className="cast-root cast-idle"><div className="cast-idle-card">
      <span className="cast-idle-title">{strings.idleTitle}</span>
      <div className="cast-pairing">
        <span className="cast-pairing-label">{strings.pairingLabel}</span>
        <strong className="cast-pairing-code">{receiver.roomCode || receiver.status}</strong>
      </div>
      <p className="cast-idle-hint">{receiver.error ?? strings.idleHint}</p>
      {senderUrl && <a className="cast-sender-link" href={senderUrl} target="_blank" rel="noreferrer">{strings.openSender}</a>}
    </div></div>;
  }
  return <div className="cast-root cast-active" data-overlay={config.overlayMode}>
    <video className="cast-media" src={target.url} autoPlay loop muted={effectiveConfig.muted} playsInline controls />
  </div>;
}
