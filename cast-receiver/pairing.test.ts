import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPairingSession } from './pairing';

const session = {
  roomCode: '123456', password: 'p'.repeat(43), managementToken: 'm'.repeat(43),
  expiresAt: Date.now() + 60_000, websocketUrl: 'wss://socket.example/ws',
};

afterEach(() => vi.unstubAllGlobals());

describe('createPairingSession', () => {
  it('accepts an advertised WebSocket URL only after host approval', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify(session), { status: 201 }))));
    const validate = vi.fn(() => Promise.resolve());
    const result = await createPairingSession('https://relay.example', new AbortController().signal, validate);
    expect(validate).toHaveBeenCalledWith(session.websocketUrl);
    expect(result.options.relayUrl).toBe(session.websocketUrl);
  });

  it('rejects an advertised WebSocket URL denied by the host', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify(session), { status: 201 }))));
    const validate = vi.fn(() => Promise.reject(new Error('Native network origin is not approved')));
    await expect(createPairingSession('https://relay.example', new AbortController().signal, validate))
      .rejects.toThrow('not approved');
  });
});
