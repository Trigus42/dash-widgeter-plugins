import { useMemo } from 'react';
import type { ReactWidgetProps } from '@/sandbox/react';
import { readCastConfig, resolveCastTarget } from './resolve';
import de from './locales/de.json';

/** Strings the receiver shell needs, resolved for the host locale. */
export interface CastStrings {
  idleTitle: string;
  idleHint: string;
  pairingLabel: string;
}

const EN: CastStrings = {
  idleTitle: 'Ready to cast',
  idleHint: 'Set a cast target in settings, or send one from a paired device.',
  pairingLabel: 'Pairing code',
};

function castStrings(locale: string): CastStrings {
  if (locale.split('-')[0] !== 'de') return EN;
  return { idleTitle: de.runtime.idleTitle, idleHint: de.runtime.idleHint, pairingLabel: de.runtime.pairingLabel };
}

/**
 * Cast receiver widget. Renders the configured cast target full-bleed inside the
 * softened sandbox frame (an embedded site, a remote video stream, or a YouTube
 * embed), and otherwise shows just a pairing code so the widget is mostly
 * invisible until something is cast. The `data-overlay` attribute drives how the
 * content layers over the rest of the dashboard (host CSS cannot cross into the
 * frame, so the layering that matters here is within the widget's own cell).
 */
export function CastWidget({ context }: ReactWidgetProps): React.JSX.Element {
  const config = useMemo(() => readCastConfig(context.config), [context.config]);
  const strings = useMemo(() => castStrings(context.locale), [context.locale]);
  const target = useMemo(() => resolveCastTarget(config), [config]);

  if (target.kind === 'idle') {
    if (!config.showPairingWhenIdle) return <div className="cast-root cast-idle-blank" />;
    return (
      <div className="cast-root cast-idle">
        <div className="cast-idle-card">
          <span className="cast-idle-title">{strings.idleTitle}</span>
          <p className="cast-idle-hint">{strings.idleHint}</p>
          {config.pairingCode && (
            <div className="cast-pairing">
              <span className="cast-pairing-label">{strings.pairingLabel}</span>
              <span className="cast-pairing-code">{config.pairingCode}</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`cast-root cast-active`} data-overlay={config.overlayMode}>
      {target.kind === 'media' ? (
        <video
          className="cast-media"
          src={target.url}
          autoPlay
          loop
          muted={config.muted}
          playsInline
          controls={false}
        />
      ) : (
        <iframe
          className="cast-frame"
          src={target.kind === 'youtube' ? target.embedUrl : target.url}
          title="Cast"
          allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
          referrerPolicy="no-referrer"
        />
      )}
    </div>
  );
}
