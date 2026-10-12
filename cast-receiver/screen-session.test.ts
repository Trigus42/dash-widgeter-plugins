import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GuestWidgetContext } from '@/sandbox/sdk';

const mocks = vi.hoisted(() => ({ createPairingSession: vi.fn(), createPluginReceiver: vi.fn() }));
vi.mock('./pairing', () => ({ createPairingSession: mocks.createPairingSession }));
vi.mock('./receiver', () => ({ createPluginReceiver: mocks.createPluginReceiver }));
import { createScreenSession } from './screen-session';

describe('screen session room lifecycle', () => {
  afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); });
  it('rotates an unpaired room at expiry', async () => {
    vi.useFakeTimers(); vi.setSystemTime(1_000);
    const first = { roomCode: '1234111111', expiresAt: 32_000, options: {}, renew: vi.fn(), close: vi.fn(() => Promise.resolve()) };
    const second = { roomCode: '5678222222', expiresAt: 64_000, options: {}, renew: vi.fn(), close: vi.fn(() => Promise.resolve()) };
    mocks.createPairingSession.mockResolvedValueOnce(first).mockResolvedValueOnce(second);
    mocks.createPluginReceiver.mockReturnValue({ close: vi.fn(), confirmSas: vi.fn() });
    const context = { config: { relayUrl: 'https://relay.example', senderUrl: '/cast.html' }, validateNativeOrigin: vi.fn(() => Promise.resolve()),
      secureWebRtcCryptoAsset: vi.fn(() => Promise.resolve({ bytes: new Uint8Array(), sha256: 'x' })), setCastState: vi.fn(() => Promise.resolve()),
      reportStatus: vi.fn(), getCastSasDecision: vi.fn(() => Promise.resolve(null)) } as unknown as GuestWidgetContext;
    const session = createScreenSession(context); await vi.advanceTimersByTimeAsync(1);
    expect(session.state.roomCode).toBe(first.roomCode);
    await vi.advanceTimersByTimeAsync(1_001);
    expect(first.close).toHaveBeenCalledOnce(); expect(mocks.createPairingSession).toHaveBeenCalledTimes(2);
    expect(session.state.roomCode).toBe(second.roomCode); session.close();
  });
});
