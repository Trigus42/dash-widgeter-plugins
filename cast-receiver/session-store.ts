import { useEffect, useState } from 'react';
import type { GuestWidgetContext } from '@/sandbox/sdk';
import type { ReceiverState } from './receiver';

export interface CastSessionState extends ReceiverState {
  roomCode: string;
  relayUrl: string;
  senderUrl: string;
  pairingReveal: number;
}

const INITIAL: CastSessionState = {
  status: 'connecting', command: null, presentationEpoch: 0, stream: null, peerCount: 0, error: null,
  roomCode: '', relayUrl: '', senderUrl: '', pairingReveal: 0,
};

let playbackState: CastSessionState = INITIAL;


export function useCastPlayback(context: GuestWidgetContext): CastSessionState {
  const [state, setState] = useState(playbackState);
  useEffect(() => {
    let cancelled = false;
    const refresh = async (): Promise<void> => {
      const next = await context.getCastState();
      if (!cancelled && next) { playbackState = next as unknown as CastSessionState; setState(playbackState); }
    };
    void refresh();
    const interval = window.setInterval(() => void refresh(), 200);
    return () => { cancelled = true; clearInterval(interval); };
  }, [context]);
  return state;
}
