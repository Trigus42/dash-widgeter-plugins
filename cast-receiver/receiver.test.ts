import { describe, expect, it, vi } from 'vitest';
import { parseAuthCode, parseRoomJoinCode } from '@/cast-protocol';

const { controller, createCastReceiver } = vi.hoisted(() => {
  const controller = { listening: Promise.resolve(), close: vi.fn(), confirmSas: vi.fn(), revokePresenter: vi.fn(), send: vi.fn() };
  return { controller, createCastReceiver: vi.fn((_options: object, _callback: (state: object) => void) => controller) };
});
vi.mock('@/core/cast/session', () => ({ createCastReceiver }));
import { createPluginReceiver } from './receiver';

describe('plugin cast receiver facade', () => {
  it('maps the shared receiver stream shape without duplicating transport logic', () => {
    const states: Array<{ stream: MediaStream | null }> = [];
    const result = createPluginReceiver({ mode: 'pairing', relayUrl: 'wss://relay.test', roomJoinCode: parseRoomJoinCode('123456'), authCode: parseAuthCode('654321'), generation: 'abcdefghijklmnop', attachmentTicket: 'T'.repeat(43) },
      { bytes: new Uint8Array(), sha256: 'digest' }, (state) => states.push(state));
    const callback = createCastReceiver.mock.calls[0]?.[1];
    callback?.({ status: 'paired', command: null, presentationEpoch: 7, screenStream: null, peerCount: 1, error: null });
    expect(states).toEqual([{ status: 'paired', command: null, presentationEpoch: 7, stream: null, peerCount: 1, error: null }]);
    result.confirmSas(true); expect(controller.confirmSas).toHaveBeenCalledWith(true); result.revokePresenter(7); expect(controller.revokePresenter).toHaveBeenCalledWith(7);
  });

  it('preserves the receiver SAS for plugin consumers', () => {
    const states: object[] = [];
    createPluginReceiver({ mode: 'pairing', relayUrl: 'wss://relay.test', roomJoinCode: parseRoomJoinCode('123456'), authCode: parseAuthCode('654321'), generation: 'abcdefghijklmnop', attachmentTicket: 'T'.repeat(43) },
      { bytes: new Uint8Array(), sha256: 'digest' }, (state) => states.push(state));
    const callback = createCastReceiver.mock.calls.at(-1)?.[1];
    callback?.({ status: 'paired', command: null, presentationEpoch: 0, screenStream: null, peerCount: 1, error: null, sas: '654321', sasTrusted: false });
    expect(states).toEqual([{ status: 'paired', command: null, presentationEpoch: 0, stream: null, peerCount: 1, error: null, sas: '654321', sasTrusted: false }]);
  });
});
