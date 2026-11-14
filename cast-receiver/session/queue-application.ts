import { applyCastQueueMutation, type CastQueueMutation, type CastQueueSnapshot } from '@/cast-protocol';
import type { PluginTelemetry } from '@/sandbox/telemetry';

export function applyReceivedQueueMutation(queue: CastQueueSnapshot, mutation: CastQueueMutation, telemetry: PluginTelemetry): CastQueueSnapshot | null {
  const next = applyCastQueueMutation(queue, mutation);
  if (!next) {
    telemetry.failure({ operation: 'cast.queue.apply', category: 'invalid_input', attributes: {
      stage: 'queue.apply', revision: queue.revision,
      ...(mutation.type === 'queue-add' ? { sourceKind: mutation.item.command.sourceKind, adapterPresent: mutation.item.command.adapter !== undefined } : {}),
    } });
  }
  return next;
}
