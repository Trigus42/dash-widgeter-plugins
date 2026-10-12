import { describe, expect, it, vi } from 'vitest';

const { createCastReceiver } = vi.hoisted(() => ({ createCastReceiver: vi.fn((_options: object, _callback: (state: object) => void) => vi.fn()) }));
vi.mock('@/core/cast/session', () => ({ createCastReceiver }));
import { createPluginReceiver } from './receiver';

describe('plugin cast receiver facade', () => {
  it('maps the shared receiver stream shape without duplicating transport logic', () => {
    const states: Array<{ stream: MediaStream | null }> = [];
    createPluginReceiver({ relayUrl: 'wss://relay.test', roomCode: '1234', authCode: '123456', generation: 'abcdefghijklmnop' },
      { bytes: new Uint8Array(), sha256: 'digest' }, (state) => states.push(state));
    const callback = createCastReceiver.mock.calls[0]?.[1];
    callback?.({ status: 'paired', command: null, screenStream: null, peerCount: 1, error: null });
    expect(states).toEqual([{ status: 'paired', command: null, screenStream: null, stream: null, peerCount: 1, error: null }]);
  });
});
