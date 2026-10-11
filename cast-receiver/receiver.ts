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
  const peers = new Set<string>();
  let activePeerId: string | null = null;
  let closed = false;
  const emit = (): void => { if (!closed) onState({ ...state }); };
  const stopActiveStream = (): void => {
    for (const track of state.stream?.getTracks() ?? []) track.stop();
    state.stream = null;
  };
  const activate = (peerId: string): void => {
    if (activePeerId && activePeerId !== peerId) void stop.send({}, { target: activePeerId });
    activePeerId = peerId;
    stopActiveStream();
  };
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
  const command = room.makeAction<Record<string, string | boolean | number>>('cast-command');
  const stop = room.makeAction<Record<string, never>>('cast-stop');
  command.onMessage = (value, { peerId }) => {
    const next = parseCastCommand(value);
    if (!next || !peers.has(peerId)) return;
    activate(peerId); state.command = next;
    state.status = next.sourceKind === 'idle' ? 'paired' : 'casting'; emit();
  };
  room.onPeerJoin = (peerId) => {
    peers.add(peerId); state.peerCount = peers.size; state.status = state.command || state.stream ? 'casting' : 'paired'; emit();
  };
  room.onPeerLeave = (peerId) => {
    peers.delete(peerId); state.peerCount = peers.size;
    if (peerId === activePeerId) {
      activePeerId = null;
      if (state.stream) { stopActiveStream(); state.command = null; }
    }
    state.status = state.command || state.stream ? 'casting' : peers.size === 0 ? 'disconnected' : 'paired'; emit();
  };
  room.onPeerStream = (stream, peerId) => {
    if (!peers.has(peerId)) return;
    activate(peerId); state.stream = stream; state.command = null; state.status = 'casting'; emit();
  };
  emit();
  return () => {
    closed = true; stopActiveStream(); peers.clear(); activePeerId = null; void room.leave();
  };
}
