import { useMemo, useState } from 'react';
import type { ReactWidgetProps } from '@/sandbox/react';
import { useCastPlayback } from './session-store';
import { readCastConfig } from './resolve';
const EN = { title: 'Cast pairing', devices: 'Connected devices' };
const DE = { title: 'Cast-Kopplung', devices: 'Verbundene Geräte' };


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
  const roomCode = receiver.roomCode;
  const url = useMemo(() => senderLink(config.senderUrl, config.relayUrl, roomCode),
    [config.relayUrl, config.senderUrl, roomCode]);
  const toggleDetails = (): void => {
    const next = !open; setOpen(next); void context.setPairingDetails(next && roomCode && url ? { code: roomCode, url } : null);
  };
  return <button type="button" className="cast-pairing-icon" onClick={toggleDetails} disabled={!roomCode}
    aria-label={strings.title} title={`${strings.title} · ${roomCode} · ${strings.devices}: ${receiver.peerCount}`}>
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M1 18v3h3a3 3 0 0 0-3-3Zm0-5v3a5 5 0 0 1 5 5h3a8 8 0 0 0-8-8Zm0-5v3c5.5 0 10 4.5 10 10h3C14 13.8 8.2 8 1 8Zm3-5a3 3 0 0 0-3 3v1h3V6h16v12h-5v3h5a3 3 0 0 0 3-3V6a3 3 0 0 0-3-3H4Z" /></svg>
  </button>;
}
