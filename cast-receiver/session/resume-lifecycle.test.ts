import { afterEach, describe, expect, it, vi } from 'vitest';
import { provisionReceiverResume, restoreReceiverResume } from './resume-lifecycle';

const room = { roomId: 'R'.repeat(43), ownerCapability: 'O'.repeat(43), renew: async () => expiresAt, close: async () => undefined };
const expiresAt = Date.now() + 60_000;
const peer = { bindingId: 'B'.repeat(43), resumePassword: 'P'.repeat(43), expiresAt };
afterEach(() => vi.unstubAllGlobals());

describe('receiver resume lifecycle', () => {
  it('waits for relay provisioning and persists authoritative expiry', async () => {
    const response = Promise.withResolvers<Response>(); const fetchMock = vi.fn(() => response.promise); vi.stubGlobal('fetch', fetchMock);
    const replace = vi.fn((bindings: Array<typeof peer & typeof room>) => { structuredClone(bindings); return Promise.resolve(); }); const store = { get: vi.fn(() => Promise.resolve([])), replace };
    const pending = provisionReceiverResume('wss://relay.example', room, peer, store, new AbortController().signal);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce()); expect(replace).not.toHaveBeenCalled();
    const authoritative = expiresAt - 1_000; response.resolve(new Response(JSON.stringify({ bindingId: peer.bindingId, expiresAt: new Date(authoritative).toISOString() }), { status: 201 }));
    const provisioned = await pending;
    const expectedBinding = { ...peer, roomId: room.roomId, ownerCapability: room.ownerCapability, expiresAt: authoritative };
    expect(provisioned.binding).toEqual(expectedBinding);
    expect(structuredClone(replace.mock.calls[0]?.[0])).toEqual([expectedBinding]);
  });

  it('revokes invalid successful responses without persisting', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ bindingId: 'X'.repeat(43), expiresAt: new Date(expiresAt).toISOString() }), { status: 201 })).mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock); const replace = vi.fn();
    await expect(provisionReceiverResume('https://relay.example', room, peer, { get: vi.fn(), replace }, new AbortController().signal)).rejects.toThrow(/invalid resume binding/);
    expect(replace).not.toHaveBeenCalled(); expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]?.[0]).toEqual(new URL('https://relay.example/v1/resume/revoke'));
  });

  it('restores partial persistence and rollback is safe to repeat', async () => {
    const previous = [{ ...peer, roomId: room.roomId, ownerCapability: room.ownerCapability }]; let values = [...previous]; let first = true;
    const replace = vi.fn((next: typeof previous) => { values = [...next]; if (first) { first = false; return Promise.reject(new Error('write failed')); } return Promise.resolve(); });
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ bindingId: peer.bindingId, expiresAt: new Date(expiresAt).toISOString() }), { status: 201 })).mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(provisionReceiverResume('https://relay.example', room, peer, { get: () => Promise.resolve(previous), replace }, new AbortController().signal)).rejects.toThrow('write failed');
    expect(values).toEqual(previous); expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('restores and revokes using cleanup independent of the aborted session signal', async () => {
    const controller = new AbortController(); const fetchMock = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ bindingId: peer.bindingId, expiresAt: new Date(expiresAt).toISOString() }), { status: 201 })).mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock); const replace = vi.fn(() => Promise.resolve()); const store = { get: () => Promise.resolve([]), replace };
    const provisioned = await provisionReceiverResume('https://relay.example', room, peer, store, controller.signal); controller.abort();
    await Promise.all([restoreReceiverResume(store, provisioned), restoreReceiverResume(store, provisioned)]);
    expect(fetchMock.mock.calls[1]?.[1]).not.toHaveProperty('signal');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
