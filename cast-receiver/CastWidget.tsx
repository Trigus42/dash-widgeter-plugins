import { useMemo } from 'react';
import type { ReactWidgetProps } from '@/sandbox/react';
import { readCastConfig, resolveCastTarget } from './resolve';
import de from './locales/de.json';

interface CastStrings { idleTitle: string; idleHint: string }
const EN: CastStrings = {
  idleTitle: 'Ready to cast',
  idleHint: 'Open /cast on a phone and enter the pairing code shown by the host.',
};

function castStrings(locale: string): CastStrings {
  if (locale.split('-')[0] !== 'de') return EN;
  return { idleTitle: de.runtime.idleTitle, idleHint: de.runtime.idleHint };
}

export function CastWidget({ context }: ReactWidgetProps): React.JSX.Element {
  const config = useMemo(() => readCastConfig(context.config), [context.config]);
  const strings = useMemo(() => castStrings(context.locale), [context.locale]);
  const target = useMemo(() => resolveCastTarget(config), [config]);

  if (target.kind === 'idle') {
    if (!config.showPairingWhenIdle) return <div className="cast-root cast-idle-blank" />;
    return <div className="cast-root cast-idle"><div className="cast-idle-card">
      <span className="cast-idle-title">{strings.idleTitle}</span>
      <p className="cast-idle-hint">{strings.idleHint}</p>
    </div></div>;
  }

  return <div className="cast-root cast-active" data-overlay={config.overlayMode}>
    {target.kind === 'media' ? <video className="cast-media" src={target.url} autoPlay loop muted={config.muted} playsInline controls /> : <iframe
      className="cast-frame"
      src={target.kind === 'website' ? target.url : target.embedUrl}
      title={target.kind === 'spotify' ? 'Spotify' : 'Cast'}
      allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
      referrerPolicy="no-referrer"
    />}
  </div>;
}
