import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactWidgetProps } from '@/sandbox/react';
import { createCastPairingUrl } from '@/core/cast/setup/pairing-url';
import { useCastPlayback } from '../session/session-store';
import { readCastConfig } from '../config/resolve';
import { publicFailure } from '@/protocol/telemetry';
const EN = { title: 'Cast pairing', devices: 'Connected devices' };
const DE = { title: 'Cast-Kopplung', devices: 'Verbundene Geräte' };

export function PairingWidget({ context }: ReactWidgetProps): React.JSX.Element {
  const receiver = useCastPlayback(context); const config = useMemo(() => readCastConfig(context.config), [context.config]);
  const strings = context.locale.startsWith('de') ? DE : EN; const [defaultSenderUrl, setDefaultSenderUrl] = useState('');
  const { roomJoinCode, authCode } = receiver; const relayUrl = receiver.relayUrl || config.relayUrl; const senderUrl = receiver.senderUrl || config.senderUrl || defaultSenderUrl;
  const url = useMemo(() => roomJoinCode && authCode && senderUrl && relayUrl ? createCastPairingUrl(senderUrl, relayUrl, { roomJoinCode, authCode }) : '', [authCode, relayUrl, roomJoinCode, senderUrl]);
  const observedReveal = useRef(receiver.pairingReveal); const observedDismissal = useRef(receiver.dismissSas);
  useEffect(() => { if (!receiver.senderUrl && !config.senderUrl) void context.castDefaultSenderUrl().then(setDefaultSenderUrl).catch((cause: unknown) => context.telemetry.disclose({ operation: 'cast.sender_url.load', category: 'dependency_transport', cause, publicMessage: publicFailure('dependency_transport', 'The plugin service is temporarily unavailable.').message })); }, [config.senderUrl, context, receiver.senderUrl]);
  useEffect(() => { if (receiver.dismissSas && receiver.dismissSas !== observedDismissal.current && receiver.sas) { observedDismissal.current = receiver.dismissSas; void context.dismissCastSas(); } }, [context, receiver]);
  useEffect(() => { if (receiver.sasTrusted === true && receiver.pairingReveal === 0) void context.setPairingDetails(null); }, [context, receiver.pairingReveal, receiver.sasTrusted]);
  const details = useMemo(() => url && roomJoinCode && authCode ? { roomJoinCode, authCode, url, ...(receiver.sas ? { sas: receiver.sas } : {}) } : null, [authCode, receiver.sas, roomJoinCode, url]);
  useEffect(() => { if (receiver.sas && receiver.sasTrusted !== true && details) void context.setPairingDetails(details); }, [context, details, receiver.sas, receiver.sasTrusted]);
  useEffect(() => { if (receiver.pairingVisible === false && !receiver.sas) void context.setPairingDetails(null); }, [context, receiver.pairingVisible, receiver.sas]);
  useEffect(() => { const prior = observedReveal.current; observedReveal.current = receiver.pairingReveal; if (receiver.pairingReveal > prior && !receiver.sas && details) void context.setPairingDetails(details); }, [context, details, receiver.pairingReveal, receiver.sas]);
  const label = `${strings.title}. ${strings.devices}: ${receiver.peerCount}`; const connected = receiver.peerCount > 0;
  return <div className="cast-pairing-root">
    <button type="button" className="cast-pairing-button" onClick={() => {
      if (details) void context.setPairingDetails(details);
    }} disabled={!details} aria-label={label} title={label}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M1 18v3h3a3 3 0 0 0-3-3Zm0-5v3a5 5 0 0 1 5 5h3a8 8 0 0 0-8-8Zm0-5v3c5.5 0 10 4.5 10 10h3C14 13.8 8.2 8 1 8Zm3-5a3 3 0 0 0-3 3v1h3V6h16v12h-5v3h5a3 3 0 0 0 3-3V6a3 3 0 0 0-3-3H4Z" /></svg>
      <span className={`cast-pairing-status ${connected ? 'cast-pairing-status-connected' : ''}`} aria-hidden="true" />
    </button>
  </div>;
}
