import { useEffect, useMemo, useState } from 'react';
import type { ReactWidgetProps } from '@/sandbox/react';
import { useCastPlayback } from './session-store';
import { readCastConfig } from './resolve';

interface Strings { title: string; pairingCode: string; devices: string; details: string; senderUrl: string; close: string }
const EN: Strings = { title: 'Cast pairing', pairingCode: 'Pairing code', devices: 'Connected devices', details: 'Pairing details', senderUrl: 'Cast URL', close: 'Close' };
const DE: Strings = { title: 'Cast-Kopplung', pairingCode: 'Kopplungscode', devices: 'Verbundene Geräte', details: 'Kopplungsdetails', senderUrl: 'Cast-URL', close: 'Schließen' };

function senderLink(senderUrl: string, relayUrl: string, roomCode: string): string {
  if (!senderUrl || !relayUrl || !roomCode) return '';
  const url = new URL(senderUrl, new URL(relayUrl));
  url.searchParams.set('relay', relayUrl);
  url.searchParams.set('code', roomCode);
  return url.href;
}

export function PairingWidget({ context }: ReactWidgetProps): React.JSX.Element {
  const receiver = useCastPlayback(context);
  const config = useMemo(() => readCastConfig(context.config), [context.config]);
  const strings = context.locale.startsWith('de') ? DE : EN;
  const [open, setOpen] = useState(false);
  const [qrCode, setQrCode] = useState('');
  const roomCode = receiver.roomCode;
  const url = useMemo(() => senderLink(config.senderUrl, config.relayUrl, roomCode),
    [config.relayUrl, config.senderUrl, roomCode]);
  useEffect(() => {
    let cancelled = false;
    if (!open || !url) { setQrCode(''); return; }
    void import('qrcode').then(({ default: QRCode }) => QRCode.toDataURL(url, { width: 320, margin: 1, errorCorrectionLevel: 'M' }))
      .then((dataUrl) => { if (!cancelled) setQrCode(dataUrl); })
      .catch((error: unknown) => context.reportStatus('error', error instanceof Error ? error.message : String(error)));
    return () => { cancelled = true; };
  }, [context, open, url]);
  return <div className="cast-pairing-root">
    <button type="button" className="cast-pairing-card" onClick={() => setOpen(true)} disabled={!roomCode}>
      <span className="cast-idle-title">{strings.title}</span>
      <span className="cast-pairing-label">{strings.pairingCode}</span>
      <strong className="cast-pairing-code">{roomCode || receiver.status}</strong>
      <span className="cast-peer-count">{strings.devices}: {receiver.peerCount}</span>
    </button>
    {open && <div className="cast-dialog-backdrop" role="presentation" onClick={() => setOpen(false)}>
      <section className="cast-dialog" role="dialog" aria-modal="true" aria-label={strings.details} onClick={(event) => event.stopPropagation()}>
        <h2>{strings.details}</h2>
        {qrCode && <img src={qrCode} alt={`${strings.pairingCode} ${roomCode}`} />}
        <strong className="cast-pairing-code">{roomCode}</strong>
        <label>{strings.senderUrl}<output>{url}</output></label>
        {url && <a href={url} target="_blank" rel="noreferrer">{url}</a>}
        <button type="button" onClick={() => setOpen(false)}>{strings.close}</button>
      </section>
    </div>}
  </div>;
}
