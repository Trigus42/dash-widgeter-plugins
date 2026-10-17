import { generateAuthCode, type CastSessionOptions } from '@/cast-protocol';
import { parseCastRelayUrl } from '@/core/cast/setup-url';

interface CreatedRoom { roomId: string; reclaimToken: string; generation: string; expiresAt: number; websocketUrl: string }

export interface PairingSession {
  options: CastSessionOptions;
  roomCode: string;
  authCode: string;
  generation: string;
  expiresAt: number;
  renew(): Promise<number>;
  close(): Promise<void>;
}

export async function createPairingSession(baseUrl: string, signal: AbortSignal, validateOrigin: (url: string) => Promise<void>): Promise<PairingSession> {
  const base = parseCastRelayUrl(baseUrl, 'http');
  const response = await fetch(new URL('/room', base), { method: 'POST', signal });
  if (!response.ok) throw new Error(`Signaling service rejected room (${response.status})`);
  const value: unknown = await response.json();
  if (!value || typeof value !== 'object') throw new Error('Cast signaling service returned an invalid room');
  const room = value as Record<string, unknown>;
  if (typeof room.roomId !== 'string' || !/^\d{4,}$/.test(room.roomId) || typeof room.reclaimToken !== 'string'
    || !/^[A-Za-z0-9_-]{43}$/.test(room.reclaimToken) || typeof room.generation !== 'string' || typeof room.expiresAt !== 'number' || room.expiresAt <= Date.now()
    || typeof room.websocketUrl !== 'string') throw new Error('Cast signaling service returned an invalid room');
  const created = room as unknown as CreatedRoom;
  try { parseCastRelayUrl(created.websocketUrl, 'websocket'); }
  catch { throw new Error('Cast signaling service returned an invalid room'); }
  await validateOrigin(created.websocketUrl);
  const authCode = generateAuthCode();
  return {
    options: {
      relayUrl: created.websocketUrl,
      roomCode: created.roomId,
      authCode,
      generation: created.generation,
      reclaimToken: created.reclaimToken,
    },
    roomCode: `${created.roomId}${authCode}`,
    authCode,
    generation: created.generation,
    expiresAt: created.expiresAt,
    async renew() {
      const renewal = await fetch(new URL(`/room/${created.roomId}`, base), {
        method: 'POST',
        headers: { authorization: `Bearer ${created.reclaimToken}` },
        signal,
      });
      if (!renewal.ok) throw new Error(`Signaling renewal failed (${renewal.status})`);
      const value: unknown = await renewal.json();
      if (!value || typeof value !== 'object' || !('expiresAt' in value) || typeof value.expiresAt !== 'number' || value.expiresAt <= Date.now()) {
        throw new Error('Signaling renewal returned invalid expiry');
      }
      created.expiresAt = value.expiresAt;
      return created.expiresAt;
    },
    async close() {
      const cleanup = await fetch(new URL(`/room/${created.roomId}`, base), {
        method: 'DELETE',
        headers: { authorization: `Bearer ${created.reclaimToken}` },
      });
      if (!cleanup.ok && cleanup.status !== 404) throw new Error(`Signaling cleanup failed (${cleanup.status})`);
    },
  };
}
