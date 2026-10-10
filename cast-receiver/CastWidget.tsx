import { useEffect, useMemo, useRef } from 'react';
import type { ReactWidgetProps } from '@/sandbox/react';
import { readCastConfig, resolveCastTarget } from './resolve';
import { useReceiver } from './useReceiver';
import de from './locales/de.json';

interface CastStrings { idleTitle: string; idleHint: string }
const EN: CastStrings = { idleTitle: 'Ready to cast', idleHint: 'Open the sender and enter this pairing code.' };

function castStrings(locale: string): CastStrings {
  return locale.split('-')[0] === 'de'
    ? { idleTitle: de.runtime.idleTitle, idleHint: de.runtime.idleHint }
    : EN;
}

export function CastWidget({ context }: ReactWidgetProps): React.JSX.Element {
  const config = useMemo(() => readCastConfig(context.config), [context.config]);
  const strings = useMemo(() => castStrings(context.locale), [context.locale]);
  const receiver = useReceiver(context);
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = videoRef.current;
    if (video) video.srcObject = receiver.stream;
    return () => { if (video) video.srcObject = null; };
  }, [receiver.stream]);
  if (receiver.stream) return <video ref={videoRef} className="cast-media" autoPlay muted playsInline />;
  const target = resolveCastTarget(receiver.command ? { ...config, ...receiver.command } : { ...config, sourceKind: 'idle' });
  if (target.kind === 'idle') {
    if (!config.showPairingWhenIdle) return <div className="cast-root cast-idle-blank" />;
    const senderUrl = config.senderUrl && receiver.roomCode
      ? `${config.senderUrl}?relay=${encodeURIComponent(config.relayUrl)}&code=${receiver.roomCode}` : '';
    return <div className="cast-root cast-idle"><div className="cast-idle-card">
      <span className="cast-idle-title">{strings.idleTitle}</span>
      <strong>{receiver.roomCode || receiver.status}</strong>
      <p className="cast-idle-hint">{receiver.error ?? strings.idleHint}</p>
      {senderUrl && <a href={senderUrl} target="_blank" rel="noreferrer">{senderUrl}</a>}
    </div></div>;
  }
  return <div className="cast-root cast-active" data-overlay={config.overlayMode}>
    {target.kind === 'media' ? <video className="cast-media" src={target.url} autoPlay loop muted={config.muted} playsInline controls /> : <iframe
      className="cast-frame" src={target.kind === 'website' ? target.url : target.embedUrl}
      title={target.kind === 'spotify' ? 'Spotify' : 'Cast'} allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
      referrerPolicy="no-referrer" />}
  </div>;
}
