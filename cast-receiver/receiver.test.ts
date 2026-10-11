import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Room } from '@trystero-p2p/ws-relay';

const { joinRoom, room, command, stopAction } = vi.hoisted(() => {
  const command = { send: vi.fn(() => Promise.resolve()), onMessage: null as null | ((data: Record<string, string | boolean | number>, context: { peerId: string }) => void) };
  const stopAction = { send: vi.fn(() => Promise.resolve()), onMessage: null };
  const room = { makeAction: vi.fn((name: string) => name === 'cast-stop' ? stopAction : command), leave: vi.fn(),
    onPeerJoin: null, onPeerLeave: null, onPeerStream: null } as unknown as Room;
  return { joinRoom: vi.fn(() => room), room, command, stopAction };
});
vi.mock('@trystero-p2p/ws-relay', () => ({ joinRoom }));

import { createPluginReceiver } from './receiver';

const options = { relayUrl: 'wss://relay.test', roomCode: '123456', password: 'x'.repeat(43) };

describe('plugin Cast receiver', () => {
  beforeEach(() => {
    vi.clearAllMocks(); command.onMessage = null; room.onPeerJoin = null; room.onPeerLeave = null; room.onPeerStream = null;
  });

  it('accepts multiple senders and stops the previous owner when another starts', () => {
    const states: Array<{ peerCount: number; command: unknown }> = [];
    createPluginReceiver(options, (state) => states.push(state));
    room.onPeerJoin?.('sender-1'); room.onPeerJoin?.('sender-2');
    expect(states.at(-1)?.peerCount).toBe(2);
    command.onMessage?.({ sourceKind: 'youtube', sourceUrl: 'dQw4w9WgXcQ', muted: false }, { peerId: 'sender-1' });
    command.onMessage?.({ sourceKind: 'website', sourceUrl: 'https://example.com', muted: false }, { peerId: 'sender-2' });
    expect(stopAction.send).toHaveBeenCalledWith({}, { target: 'sender-1' });
    expect(states.at(-1)?.command).toMatchObject({ sourceKind: 'website' });
  });
});
