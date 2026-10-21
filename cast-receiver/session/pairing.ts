import { generateAuthCode, parseAuthCode, parseRoomJoinCode, type CastSessionOptions } from '@/cast-protocol';
import { parseCastRelayUrl } from '@/core/cast/setup/setup-url';

interface CreatedRoom { roomId: string; roomJoinCode: string; generation: string; expiresAt: string; receiverAttachmentTicket: string; ownerCapability: string }
export interface PairingSession { options: CastSessionOptions; roomId: string; ownerCapability: string; roomJoinCode: string; authCode: string; generation: string; expiresAt: number; renew(): Promise<number>; close(): Promise<void> }

export async function createPairingSession(baseUrl: string, signal: AbortSignal, validateOrigin: (url: string) => Promise<void>): Promise<PairingSession> {
  const base = parseCastRelayUrl(baseUrl, 'http');
  const response = await fetch(new URL('/v1/rooms', base), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind: 'createRoomRequest', mode: 'anonymous' }), signal });
  if (!response.ok) throw new Error(`Relay rejected room (${response.status})`);
  const value: unknown = await response.json(); if (!validRoom(value)) throw new Error('Relay returned an invalid room');
  const created = value; const websocket = new URL('/v1/socket', base); websocket.protocol = websocket.protocol === 'https:' ? 'wss:' : 'ws:';
  await validateOrigin(websocket.href); const authCode = parseAuthCode(generateAuthCode()); const roomJoinCode = parseRoomJoinCode(created.roomJoinCode);
  return {
    options: { mode: 'pairing', relayUrl: websocket.href, roomJoinCode, authCode, generation: created.generation, attachmentTicket: created.receiverAttachmentTicket, ownerCapability: created.ownerCapability },
    roomId: created.roomId, ownerCapability: created.ownerCapability, roomJoinCode, authCode, generation: created.generation, expiresAt: Date.parse(created.expiresAt),
    renew() { return Promise.reject(new Error('Anonymous relay rooms cannot be renewed')); },
    async close() {
      const cleanup = await fetch(new URL(`/v1/rooms/${created.roomId}`, base), { method: 'DELETE', headers: { authorization: `DashRoom ${created.ownerCapability}` } });
      if (!cleanup.ok && cleanup.status !== 404) throw new Error(`Relay cleanup failed (${cleanup.status})`);
    },
  };
}
function validRoom(value: unknown): value is CreatedRoom {
  if (!value || typeof value !== 'object') return false; const room = value as Record<string, unknown>;
  return room.kind === 'anonymousRoomView' && typeof room.roomId === 'string' && /^[A-Za-z0-9_-]{43}$/.test(room.roomId)
    && typeof room.roomJoinCode === 'string' && /^\d{6}$/.test(room.roomJoinCode)
    && typeof room.generation === 'string' && /^[A-Za-z0-9_-]{43}$/.test(room.generation)
    && typeof room.receiverAttachmentTicket === 'string' && /^[A-Za-z0-9_-]{43}$/.test(room.receiverAttachmentTicket)
    && typeof room.ownerCapability === 'string' && /^[A-Za-z0-9_-]{43}$/.test(room.ownerCapability)
    && typeof room.expiresAt === 'string' && Date.parse(room.expiresAt) > Date.now();
}
