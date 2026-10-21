import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPairingSession } from './pairing';

const capability = (character: string) => character.repeat(43);
const room = { kind: 'anonymousRoomView', roomId: capability('R'), roomJoinCode: '123456', generation: capability('G'), expiresAt: new Date(Date.now() + 60_000).toISOString(), joinCodeExpiresAt: new Date(Date.now() + 30_000).toISOString(), receiverAttachmentTicket: capability('T'), ownerCapability: capability('O') };

describe('createPairingSession', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('generates PAKE authentication locally and validates the socket origin', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify(room), { status: 201 }))));
    vi.stubGlobal('crypto', { getRandomValues: (value: Uint32Array) => { value[0] = 384910; return value; } });
    const validate = vi.fn(() => Promise.resolve()); const result = await createPairingSession('https://relay.example', new AbortController().signal, validate);
    expect(validate).toHaveBeenCalledWith('wss://relay.example/v1/socket');
    expect(result.roomJoinCode).toBe('123456'); expect(result.authCode).toBe('384910');
    expect(result.options.mode).toBe('pairing');
    if (result.options.mode !== 'pairing') throw new Error('pairing mode required');
    expect(result.options.ownerCapability).toBe(capability('O'));
  });
  it('rejects anonymous renewal without extending lifetime', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify(room), { status: 201 }))));
    const result = await createPairingSession('https://relay.example', new AbortController().signal, vi.fn(() => Promise.resolve()));
    await expect(result.renew()).rejects.toThrow(/cannot be renewed/);
  });
  it('rejects an unapproved socket origin', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify(room), { status: 201 }))));
    await expect(createPairingSession('https://relay.example', new AbortController().signal, vi.fn(() => Promise.reject(new Error('not approved'))))).rejects.toThrow('not approved');
  });
});
