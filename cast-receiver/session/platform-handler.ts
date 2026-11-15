import { parsePlatformRequest, parsePlatformResponse, type PlatformRequest, type PlatformResponse } from '@/protocol/platform';
import type { DataMessage } from '@/core/cast/protocol/data-message';
import { createLogger, type Logger, type TelemetryCategory, type TelemetrySink } from '@/protocol/telemetry';
import type { ReceiverEntry } from './receiver-entry';

const MAX_PENDING_PLATFORM_WORK = 8;
interface PlatformWork {
  entry: ReceiverEntry;
  message: Extract<DataMessage, { type: 'platform-request' }>;
  send: (message: DataMessage) => void;
  current: () => boolean;
  cancelled?: boolean;
}

/** One bounded device lane; an entry's authority is rechecked across every await. */
export class ReceiverPlatformHandler {
  private readonly queue: PlatformWork[] = [];
  private active: PlatformWork | undefined;
  private closed = false;
  private readonly logger: Logger;
  constructor(private readonly request: (request: PlatformRequest) => Promise<PlatformResponse>, sink: TelemetrySink) {
    this.logger = createLogger('cast-receiver', sink);
  }

  enqueue(entry: ReceiverEntry, message: PlatformWork['message'], send: PlatformWork['send'], current: () => boolean): void {
    if (this.closed || !current()) return;
    const request = parsePlatformRequest(message.request);
    if (!request) { this.respond({ entry, message, send, current }, this.failure('invalid_input')); return; }
    if (this.active?.entry === entry && this.active.message.requestId === message.requestId
      || this.queue.some((work) => work.entry === entry && work.message.requestId === message.requestId)) return;
    const work = { entry, message: { ...message, request }, send, current };
    if (this.queue.length + Number(Boolean(this.active)) >= MAX_PENDING_PLATFORM_WORK) {
      this.respond(work, this.failure('capacity_exceeded'));
      return;
    }
    this.queue.push(work);
    void this.drain();
  }

  retire(entry: ReceiverEntry): void {
    for (let index = this.queue.length - 1; index >= 0; index -= 1) if (this.queue[index]?.entry === entry) this.queue.splice(index, 1);
    if (this.active?.entry === entry) this.active.cancelled = true;
  }

  close(): void { this.closed = true; this.queue.length = 0; }

  private async drain(): Promise<void> {
    if (this.active || this.closed) return;
    while (!this.closed && this.queue.length > 0) {
      const work = this.queue.shift()!;
      if (!work.current()) continue;
      this.active = work;
      try {
        const result = await this.request(work.message.request);
        if (this.closed || work.cancelled || !work.current()) continue;
        const response = parsePlatformResponse(result);
        this.respond(work, response && this.matches(work.message.request, response) ? response : this.failure('dependency_response'));
      } catch (error) {
        if (!this.closed && !work.cancelled && work.current()) this.respond(work, this.failure('dependency_transport', error));
      } finally { this.active = undefined; }
    }
  }

  private matches(request: PlatformRequest, response: PlatformResponse): boolean {
    if (response.status === 'error') return true;
    if (request.kind === 'availability') return response.status === 'available' || response.status === 'unavailable';
    return response.status === 'unavailable' || response.status === 'ok' && response.operation === request.operation;
  }

  private respond(work: PlatformWork, response: PlatformResponse): void {
    if (this.closed || work.cancelled || !work.current()) return;
    try { work.send({ type: 'platform-response', requestId: work.message.requestId, response }); }
    catch (error) { this.logger.failure({ operation: 'platform.response.send', category: 'dependency_transport', error }); }
  }
  private failure(category: TelemetryCategory, error?: unknown): PlatformResponse {
    const correlationId = crypto.randomUUID();
    const failure = this.logger.failure({ operation: 'platform.request', category, correlationId, ...(error === undefined ? {} : { error }) });
    return { status: 'error', category, correlationId: failure.correlationId ?? correlationId };
  }
}
