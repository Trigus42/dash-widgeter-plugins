import { describe, expect, it, vi } from 'vitest';
import type { PlatformRequest, PlatformResponse } from '@/protocol/platform';
import type { TelemetryRecord } from '@/protocol/telemetry';
import type { ReceiverEntry } from './receiver-entry';
import { ReceiverPlatformHandler } from './platform-handler';
import type { DataMessage } from '@/core/cast/protocol/data-message';

const read = { kind: 'execute', operation: 'volume.read' } as const;
const volume = { status: 'ok', operation: 'volume.read', value: { level: 0.4, max: 15 } } as const;
function fixture() {
  const records: TelemetryRecord[] = [];
  const request = vi.fn<(request: PlatformRequest) => Promise<PlatformResponse>>().mockResolvedValue(volume);
  const handler = new ReceiverPlatformHandler(request, (record) => records.push(record));
  const entry = { trusted: true, connected: true, retired: false } as ReceiverEntry;
  const send = vi.fn<(message: DataMessage) => void>();
  const current = (): boolean => entry.trusted && entry.connected && !entry.retired;
  const enqueue = (operation: PlatformRequest = read, id: string = crypto.randomUUID()): string => {
    handler.enqueue(entry, { type: 'platform-request', requestId: id, request: operation }, send, current);
    return id;
  };
  return { handler, request, records, entry, send, enqueue };
}
const tick = async (): Promise<void> => { await Promise.resolve(); await Promise.resolve(); };

describe('receiver platform session lane', () => {
  it('executes only current trusted owners and replies only to the requester', async () => {
    const { handler, request, entry, send, enqueue, records } = fixture();
    entry.trusted = false; enqueue();
    entry.trusted = true; entry.retired = true; enqueue();
    entry.retired = false; entry.connected = false; enqueue();
    expect(request).not.toHaveBeenCalled();
    entry.connected = true;
    const id = enqueue(); await tick();
    expect(request).toHaveBeenCalledExactlyOnceWith(read);
    expect(send).toHaveBeenCalledExactlyOnceWith({ type: 'platform-response', requestId: id, response: volume });
    expect(records).toEqual([]); handler.close();
  });

  it.each(['retire', 'disconnect', 'untrust', 'close'] as const)('drops queued work and late disclosure on %s', async (action) => {
    const { handler, request, entry, send, enqueue, records } = fixture();
    const pending = Promise.withResolvers<PlatformResponse>(); request.mockReturnValueOnce(pending.promise);
    enqueue(); enqueue();
    if (action === 'retire') { entry.retired = true; handler.retire(entry); }
    if (action === 'disconnect') { entry.connected = false; handler.retire(entry); }
    if (action === 'untrust') { entry.trusted = false; handler.retire(entry); }
    if (action === 'close') handler.close();
    pending.resolve(volume); await tick();
    expect(request).toHaveBeenCalledTimes(1); expect(send).not.toHaveBeenCalled(); expect(records).toEqual([]); handler.close();
  });

  it('never discloses an active old request after authority is restored', async () => {
    const { handler, request, entry, send, enqueue } = fixture();
    const pending = Promise.withResolvers<PlatformResponse>(); request.mockReturnValueOnce(pending.promise);
    enqueue(); handler.retire(entry); entry.trusted = false; entry.trusted = true;
    const nextId = enqueue(); pending.resolve(volume); await tick();
    expect(send).toHaveBeenCalledExactlyOnceWith({ type: 'platform-response', requestId: nextId, response: volume }); handler.close();
  });

  it('serializes and bounds device work and deduplicates in-flight request ids', async () => {
    const { handler, request, enqueue, records, send } = fixture();
    const pending = Promise.withResolvers<PlatformResponse>(); request.mockReturnValueOnce(pending.promise);
    const first = enqueue(); enqueue(read, first);
    for (let index = 0; index < 7; index += 1) enqueue();
    const overflow = enqueue();
    expect(request).toHaveBeenCalledTimes(1);
    expect(records).toHaveLength(1); expect(records[0]?.category).toBe('capacity_exceeded');
    expect(send).toHaveBeenCalledExactlyOnceWith({ type: 'platform-response', requestId: overflow,
      response: { status: 'error', category: 'capacity_exceeded', correlationId: records[0]?.correlationId } });
    pending.resolve(volume);
    for (let index = 0; index < 8; index += 1) await tick();
    expect(request).toHaveBeenCalledTimes(8); expect(send).toHaveBeenCalledTimes(9); handler.close();
  });

  it('queries read/write availability and executes independently of queue media', async () => {
    const { handler, request, enqueue, send } = fixture();
    request.mockImplementation(async (operation) => operation.kind === 'availability'
      ? operation.operation === 'volume.read' ? { status: 'available' } : { status: 'unavailable', reason: 'permission_denied' }
      : { status: 'ok', operation: operation.operation, value: volume.value });
    const readId = enqueue({ kind: 'availability', operation: 'volume.read' });
    const writeId = enqueue({ kind: 'availability', operation: 'volume.write' });
    const executeId = enqueue({ kind: 'execute', operation: 'volume.write', arguments: { level: 0.4 } });
    await tick(); await tick();
    expect(send.mock.calls.map(([message]) => message)).toEqual([
      { type: 'platform-response', requestId: readId, response: { status: 'available' } },
      { type: 'platform-response', requestId: writeId, response: { status: 'unavailable', reason: 'permission_denied' } },
      { type: 'platform-response', requestId: executeId, response: { ...volume, operation: 'volume.write' } },
    ]);
    handler.close();
  });

  it('passes safe host errors through without duplicate telemetry', async () => {
    const { handler, request, enqueue, send, records } = fixture();
    const response = { status: 'error', category: 'permission_denied', correlationId: crypto.randomUUID() } as const;
    request.mockResolvedValue(response); const id = enqueue(); await tick();
    expect(send).toHaveBeenCalledExactlyOnceWith({ type: 'platform-response', requestId: id, response }); expect(records).toEqual([]); handler.close();
  });

  it.each([
    { ...volume, operation: 'volume.write' },
    { ...volume, rawException: 'private URL https://secret.test' },
    { status: 'available' },
  ])('replaces invalid host responses with a canonical safe correlated error', async (response) => {
    const { handler, request, enqueue, send, records } = fixture();
    request.mockResolvedValue(response as PlatformResponse); enqueue(); await tick();
    expect(records).toHaveLength(1); expect(records[0]?.category).toBe('dependency_response');
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ response: {
      status: 'error', category: 'dependency_response', correlationId: records[0]?.correlationId,
    } }));
    expect(JSON.stringify(send.mock.calls)).not.toMatch(/private|secret|rawException/); handler.close();
  });

  it('does not call the SDK with malformed generic input', async () => {
    const { handler, request, enqueue, send, records } = fixture();
    enqueue({ kind: 'execute', operation: 'volume.write', arguments: { level: 2 } }); await tick();
    expect(request).not.toHaveBeenCalled(); expect(records).toHaveLength(1);
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ response: { status: 'error', category: 'invalid_input', correlationId: records[0]?.correlationId } }));
    handler.close();
  });

  it('logs transport rejection before a safe response without raw error details', async () => {
    const { request, records } = fixture();
    request.mockRejectedValue(new Error('https://secret.test?token=private'));
    const order: string[] = [];
    const sinkHandler = new ReceiverPlatformHandler(request, (record) => { records.push(record); order.push('log'); });
    const entry = { trusted: true } as ReceiverEntry;
    const send = vi.fn(() => { order.push('send'); });
    sinkHandler.enqueue(entry, { type: 'platform-request', requestId: crypto.randomUUID(), request: read }, send, () => true);
    await tick();
    expect(order).toEqual(['log', 'send']); expect(records).toHaveLength(1);
    expect(records[0]?.error?.message).toContain('secret.test');
    expect(JSON.stringify(send.mock.calls)).not.toMatch(/secret|token|private/);
    sinkHandler.close();
  });
});
