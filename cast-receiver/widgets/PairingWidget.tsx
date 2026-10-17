import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactWidgetProps } from '@/sandbox/react';
import { useCastPlayback } from '../session/session-store';
import { readCastConfig } from '../config/resolve';
const EN = { title: 'Cast pairing', devices: 'Connected devices', sas: 'Security code' };
const DE = { title: 'Cast-Kopplung', devices: 'Verbundene Geräte', sas: 'Sicherheitscode' };


function senderLink(senderUrl: string, relayUrl: string, roomCode: string): string {
  if (!senderUrl || !relayUrl || !roomCode) return '';
  const url = new URL(senderUrl);
  url.searchParams.set('relay', relayUrl);
  url.searchParams.set('code', roomCode);
  return url.href;
}

export function PairingWidget({ context }: ReactWidgetProps): React.JSX.Element {
  const receiver = useCastPlayback(context);
  const config = useMemo(() => readCastConfig(context.config), [context.config]);
  const strings = context.locale.startsWith('de') ? DE : EN;
  const [defaultSenderUrl, setDefaultSenderUrl] = useState('');
  const roomCode = receiver.roomCode;
  const relayUrl = receiver.relayUrl || config.relayUrl;
  const senderUrl = receiver.senderUrl || config.senderUrl || defaultSenderUrl;
  const url = useMemo(() => senderLink(senderUrl, relayUrl, roomCode),
    [relayUrl, roomCode, senderUrl]);
  const observedReveal = useRef(receiver.pairingReveal);
  const observedDismissal = useRef(receiver.dismissSas);
  useEffect(() => {
    if (receiver.senderUrl || config.senderUrl) return;
    void context.castDefaultSenderUrl().then(setDefaultSenderUrl)
      .catch((error: unknown) => context.reportStatus('error', error instanceof Error ? error.message : String(error)));
  }, [config.senderUrl, context, receiver.senderUrl]);
  useEffect(() => {
    if (!receiver.dismissSas || receiver.dismissSas === observedDismissal.current || !receiver.sas) return;
    observedDismissal.current = receiver.dismissSas;
    void context.dismissCastSas();
  }, [context, receiver]);
  useEffect(() => {
    if (receiver.sasTrusted !== true || receiver.pairingReveal !== 0) return;
    void context.setPairingDetails(null)
      .catch((error: unknown) => context.reportStatus('error', error instanceof Error ? error.message : String(error)));
  }, [context, receiver.pairingReveal, receiver.sasTrusted]);
  useEffect(() => {
    if (!receiver.sas || receiver.sasTrusted === true || !roomCode || !url) return;
    void context.setPairingDetails({ code: roomCode, url, sas: receiver.sas })
      .catch((error: unknown) => context.reportStatus('error', error instanceof Error ? error.message : String(error)));
  }, [context, receiver.sas, receiver.sasTrusted, roomCode, url]);
  useEffect(() => {
    if (receiver.pairingVisible !== false || receiver.sas) return;
    void context.setPairingDetails(null)
      .catch((error: unknown) => context.reportStatus('error', error instanceof Error ? error.message : String(error)));
  }, [context, receiver.pairingVisible, receiver.sas]);
  useEffect(() => {
    const prior = observedReveal.current;
    observedReveal.current = receiver.pairingReveal;
    if (receiver.pairingReveal <= prior || receiver.sas || !roomCode || !url) return;
    void context.setPairingDetails({ code: roomCode, url })
      .catch((error: unknown) => context.reportStatus('error', error instanceof Error ? error.message : String(error)));
  }, [context, receiver.pairingReveal, receiver.sas, roomCode, url]);
  const showDetails = (): void => {
    if (roomCode && url) void context.setPairingDetails({ code: roomCode, url, ...(receiver.sas ? { sas: receiver.sas } : {}) })
      .catch((error: unknown) => context.reportStatus('error', error instanceof Error ? error.message : String(error)));
  };
  return <button type="button" className="cast-pairing-button" onClick={showDetails} disabled={!roomCode}
    aria-label={`${strings.title}. ${strings.devices}: ${receiver.peerCount}`}>
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M1 18v3h3a3 3 0 0 0-3-3Zm0-5v3a5 5 0 0 1 5 5h3a8 8 0 0 0-8-8Zm0-5v3c5.5 0 10 4.5 10 10h3C14 13.8 8.2 8 1 8Zm3-5a3 3 0 0 0-3 3v1h3V6h16v12h-5v3h5a3 3 0 0 0 3-3V6a3 3 0 0 0-3-3H4Z" /></svg>
    <span>{strings.title}</span><strong>{receiver.peerCount}</strong>
  </button>;
}
