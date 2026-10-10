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
  const effectiveConfig = useMemo(() => receiver.command
    ? { ...config, ...receiver.command }
    : { ...config, sourceKind: 'idle' as const }, [config, receiver.command]);
  const target = useMemo(() => resolveCastTarget(effectiveConfig), [effectiveConfig]);
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = receiver.stream;
    return () => { video.srcObject = null; };
  }, [receiver.stream]);
  useEffect(() => {
    const next = receiver.stream ? null : target.kind === 'youtube'
      ? { provider: 'youtube' as const, videoId: target.videoId, muted: effectiveConfig.muted }
      : target.kind === 'spotify'
        ? { provider: 'spotify' as const, kind: target.spotifyKind, id: target.spotifyId }
        : null;
    void context.setPresentation(next).catch((error: unknown) =>
      context.reportStatus('error', error instanceof Error ? error.message : String(error)));
    return () => { void context.setPresentation(null).catch(() => undefined); };
  }, [context, target, effectiveConfig.muted, receiver.stream]);
  if (receiver.stream) return <video ref={videoRef} className="cast-media" autoPlay muted={effectiveConfig.muted} playsInline controls />;
  if (target.kind === 'youtube' || target.kind === 'spotify') return <div className="cast-root cast-active" data-overlay={config.overlayMode} />;
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
    {target.kind === 'media' ? <video className="cast-media" src={target.url} autoPlay loop muted={effectiveConfig.muted} playsInline controls /> : <iframe
      className="cast-frame" src={target.url} title="Cast" allow="autoplay; fullscreen; picture-in-picture"
      referrerPolicy="no-referrer" />}
  </div>;
}
