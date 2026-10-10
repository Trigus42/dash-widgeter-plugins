import { joinRoom, type WsRelayRoomConfig } from '@trystero-p2p/ws-relay';
import type { CastCommand, CastSessionOptions } from '@/cast-protocol';
import { CAST_APP_ID, MAX_CAST_MESSAGE_BYTES, parseCastCommand, roleHandshake } from '@/cast-protocol';

export interface ReceiverState {
  status: 'connecting' | 'paired' | 'casting' | 'disconnected' | 'error';
  command: CastCommand | null;
  stream: MediaStream | null;
  peerCount: number;
  error: string | null;
}

export function createPluginReceiver(options: CastSessionOptions, onState: (state: ReceiverState) => void): () => void {
  const state: ReceiverState = { status: 'connecting', command: null, stream: null, peerCount: 0, error: null };
  let closed = false;
  let senderId: string | null = null;
  const emit = (): void => { if (!closed) onState({ ...state }); };
  const iceServers: RTCIceServer[] = options.turnUrl ? [{
    urls: options.turnUrl,
    ...(options.turnUsername ? { username: options.turnUsername } : {}),
    ...(options.turnCredential ? { credential: options.turnCredential } : {}),
  }] : [];
  const config: WsRelayRoomConfig = {
    appId: CAST_APP_ID, password: options.password, maxReceiveBytes: MAX_CAST_MESSAGE_BYTES,
    relayConfig: { urls: [options.relayUrl] }, rtcConfig: { iceServers },
  };
  const room = joinRoom(config, options.roomCode, {
    onPeerHandshake: roleHandshake('receiver'),
    onJoinError: ({ error }) => { state.status = 'error'; state.error = error; emit(); },
  });
  const action = room.makeAction<Record<string, string | boolean>>('cast-command');
  action.onMessage = (value, { peerId }) => {
    const command = parseCastCommand(value);
    if (!command || peerId !== senderId) return;
    state.command = command; state.stream = null;
    state.status = command.sourceKind === 'idle' ? 'paired' : 'casting'; emit();
  };
  room.onPeerJoin = (peerId) => {
    if (senderId) return;
    senderId = peerId; state.peerCount = 1; state.status = 'paired'; emit();
  };
  room.onPeerLeave = (peerId) => {
    if (peerId !== senderId) return;
    senderId = null; state.peerCount = 0; state.status = 'disconnected'; state.command = null; state.stream = null; emit();
  };
  room.onPeerStream = (stream, peerId) => {
    if (peerId !== senderId) return;
    state.stream = stream; state.command = null; state.status = 'casting'; emit();
  };
  emit();
  return () => {
    closed = true;
    for (const track of state.stream?.getTracks() ?? []) track.stop();
    senderId = null;
    void room.leave();
  };
}
