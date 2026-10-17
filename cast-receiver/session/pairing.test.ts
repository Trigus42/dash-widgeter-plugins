import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPairingSession } from './pairing';

const room = { roomId: '1234', reclaimToken: 'm'.repeat(43), generation: 'generation', expiresAt: Date.now() + 60_000, websocketUrl: 'wss://socket.example/ws' };

describe('createPairingSession', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('generates authentication locally and validates the advertised WebSocket origin', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify(room), { status: 201 }))));
    vi.stubGlobal('crypto', { getRandomValues: (value: Uint32Array) => { value[0] = 384910; return value; } });
    const validate = vi.fn(() => Promise.resolve());
    const result = await createPairingSession('https://relay.example', new AbortController().signal, validate);
    expect(validate).toHaveBeenCalledWith(room.websocketUrl);
    expect(result.roomCode).toBe('1234384910');
    expect(result.options).not.toHaveProperty('password');
    expect(result.options.reclaimToken).toBe(room.reclaimToken);
  });

  it('uses the relay-authoritative renewed expiry', async () => {
    const renewed = Date.now() + 120_000;
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(room), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ expiresAt: renewed }), { status: 200 }));
    vi.stubGlobal('fetch', fetcher);
    const result = await createPairingSession('https://relay.example', new AbortController().signal, vi.fn(() => Promise.resolve()));
    await expect(result.renew()).resolves.toBe(renewed);
  });

  it('rejects an unapproved advertised origin', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify(room), { status: 201 }))));
    const validate = vi.fn(() => Promise.reject(new Error('Native network origin is not approved')));
    await expect(createPairingSession('https://relay.example', new AbortController().signal, validate)).rejects.toThrow('not approved');
  });
});
