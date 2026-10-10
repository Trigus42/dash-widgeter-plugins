import type { CastSessionOptions } from '@/cast-protocol';

interface CreatedSession {
  roomCode: string;
  password: string;
  managementToken: string;
  expiresAt: number;
  websocketUrl: string;
}

function parseSession(value: unknown): CreatedSession {
  if (!value || typeof value !== 'object') throw new Error('Cast signaling service returned an invalid session');
  const session = value as Record<string, unknown>;
  if (typeof session.roomCode !== 'string' || !/^\d{6}$/.test(session.roomCode) ||
      typeof session.password !== 'string' || session.password.length < 32 ||
      typeof session.managementToken !== 'string' || session.managementToken.length < 32 ||
      typeof session.expiresAt !== 'number' || session.expiresAt <= Date.now() ||
      typeof session.websocketUrl !== 'string' || !/^wss?:\/\//.test(session.websocketUrl)) {
    throw new Error('Cast signaling service returned an invalid session');
  }
  return session as unknown as CreatedSession;
}

export interface PairingSession {
  options: CastSessionOptions;
  roomCode: string;
  expiresAt: number;
  close(): Promise<void>;
}

export async function createPairingSession(baseUrl: string, signal: AbortSignal, validateOrigin: (url: string) => Promise<void>): Promise<PairingSession> {
  const base = new URL(baseUrl);
  if (base.username || base.password || base.search || base.hash) throw new Error('Invalid signaling URL');
  const response = await fetch(new URL('/session', base), { method: 'POST', signal });
  if (!response.ok) throw new Error(`Signaling service rejected session (${response.status})`);
  const session = parseSession(await response.json());
  const websocket = new URL(session.websocketUrl);
  await validateOrigin(websocket.href);
  return {
    options: { relayUrl: websocket.href, roomCode: session.roomCode, password: session.password },
    roomCode: session.roomCode,
    expiresAt: session.expiresAt,
    async close() {
      const cleanup = await fetch(new URL(`/session/${session.roomCode}`, base), {
        method: 'DELETE', headers: { authorization: `Bearer ${session.managementToken}` },
      });
      if (!cleanup.ok && cleanup.status !== 404) throw new Error(`Signaling cleanup failed (${cleanup.status})`);
    },
  };
}
