import type { CastSessionOptions } from '@/cast-protocol';
import type { ReceiverResumeBinding } from '@/core/cast/setup/resume-binding';
import { castRelayHttpUrl } from '@/core/cast/setup/setup-url';
import type { PluginReceiver, ReceiverState } from '../receiver';

export interface ReceiverEntry {
  room: { options: CastSessionOptions; roomJoinCode: string; authCode: string; expiresAt: number; close(): Promise<void> };
  receiver?: PluginReceiver;
  state: ReceiverState;
  connected: boolean;
  trusted: boolean;
  retired?: boolean;
  resumeBinding?: ReceiverResumeBinding;
  bindingInstall?: Promise<void>;
  revokedEpoch: number;
  epochOffset: number;
}

export async function closeResumeRoom(relayUrl: string, binding: ReceiverResumeBinding): Promise<void> {
  const response = await fetch(new URL(`/v1/rooms/${binding.roomId}`, castRelayHttpUrl(relayUrl)), { method: 'DELETE', headers: { authorization: `DashRoom ${binding.ownerCapability}` } });
  if (!response.ok && response.status !== 404) throw new Error(`Relay cleanup failed (${response.status})`);
}

export function retireReceiver(entry: ReceiverEntry, connected: Set<ReceiverEntry>): void {
  entry.retired = true; entry.connected = false; entry.trusted = false; connected.delete(entry); entry.receiver?.close();
}

export async function closeRevokedReceivers(entries: ReceiverEntry[], bindings: ReceiverResumeBinding[], relayUrl: string, removeBinding: (id: string) => Promise<void>): Promise<void> {
  const dormant = bindings.filter((binding) => !entries.some((entry) => entry.resumeBinding?.bindingId === binding.bindingId));
  await Promise.all([...entries.map((entry) => entry.room.close()), ...dormant.map((binding) => closeResumeRoom(relayUrl, binding)), ...bindings.map((binding) => removeBinding(binding.bindingId))]);
}
