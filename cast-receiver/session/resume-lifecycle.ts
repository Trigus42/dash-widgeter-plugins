import type { ReceiverResumeBinding } from '@/core/cast/setup/resume-binding';
import { castRelayHttpUrl } from '@/core/cast/setup/setup-url';

interface ResumeStore {
  get(): Promise<ReceiverResumeBinding[]>;
  replace(bindings: ReceiverResumeBinding[]): Promise<void>;
}
interface PeerBinding { bindingId: string; resumePassword: string; expiresAt: number }
interface RoomAuthority { roomId: string; ownerCapability: string }

export interface ProvisionedResumeBinding {
  binding: ReceiverResumeBinding;
  previous: ReceiverResumeBinding[];
  rollback(): Promise<void>;
}

export async function provisionReceiverResume(relayUrl: string, room: RoomAuthority, peer: PeerBinding,
  store: ResumeStore, signal: AbortSignal): Promise<ProvisionedResumeBinding> {
  const base = castRelayHttpUrl(relayUrl);
  const response = await fetch(new URL('/v1/resume/provision', base), { method: 'POST', headers: headers(room),
    body: JSON.stringify({ kind: 'provisionResumeRequest', roomId: room.roomId, bindingId: peer.bindingId, expiresAt: peer.expiresAt }), signal });
  if (!response.ok) throw new Error(`Relay resume provisioning failed (${response.status})`);
  let rollbackPromise: Promise<void> | undefined;
  const rollback = () => rollbackPromise ??= revoke(base, room, peer.bindingId);
  let expiresAt: number;
  try { expiresAt = parseProvisioned(await response.json(), peer); } catch (error) { await rollback(); throw error; }
  const binding = { bindingId: peer.bindingId, resumePassword: peer.resumePassword, roomId: room.roomId,
    ownerCapability: room.ownerCapability, expiresAt }; const previous = await store.get();
  try { await store.replace([...previous.filter((item) => item.bindingId !== peer.bindingId), binding]); }
  catch (error) { await store.replace(previous).catch(() => undefined); await rollback(); throw error; }
  return { binding, previous, rollback };
}

export async function restoreReceiverResume(store: ResumeStore, provisioned: ProvisionedResumeBinding): Promise<void> {
  await store.replace(provisioned.previous).catch(() => undefined);
  await provisioned.rollback();
}

function parseProvisioned(value: unknown, requested: PeerBinding): number {
  if (!value || typeof value !== 'object') throw new Error('Relay returned an invalid resume binding');
  const record = value as Record<string, unknown>; const expiresAt = typeof record.expiresAt === 'string' ? Date.parse(record.expiresAt) : Number.NaN;
  if (record.bindingId !== requested.bindingId || !Number.isSafeInteger(expiresAt) || expiresAt <= Date.now() || expiresAt > requested.expiresAt) throw new Error('Relay returned an invalid resume binding');
  return expiresAt;
}
function headers(room: RoomAuthority): HeadersInit { return { authorization: `DashRoom ${room.ownerCapability}`, 'content-type': 'application/json' }; }
async function revoke(base: URL, room: RoomAuthority, bindingId: string): Promise<void> {
  await fetch(new URL('/v1/resume/revoke', base), { method: 'POST', headers: headers(room), body: JSON.stringify({ kind: 'revokeResumeRequest', bindingId }) }).catch(() => undefined);
}
