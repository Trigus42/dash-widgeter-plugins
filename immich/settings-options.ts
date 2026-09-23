import type { SettingOption } from '@/types';
import type { OptionsContext } from '@/sandbox/sdk';
import { ImmichService, type ImmichTransport } from './service';
import { readImmichConfig } from './config';

/**
 * Dynamic option loader for the Immich album/person/tag multiselects, running in
 * the plugin sandbox. Uses the server URL + API key already entered in the same
 * settings form (routed through the host HTTP capability) to query live lists so
 * users pick real entities instead of pasting UUIDs. No blob caching is needed
 * for option lists, so the transport's cache is a no-op.
 */
export async function loadImmichOptions(
  context: OptionsContext,
  kind: 'albums' | 'people' | 'tags',
  rawConfig: Record<string, unknown>,
): Promise<SettingOption[]> {
  const config = readImmichConfig(rawConfig);
  if (!config.serverUrl || !config.apiKey) {
    throw new Error('Enter the server URL and API key first.');
  }
  const transport: ImmichTransport = {
    request: (req) => context.http(req),
    cacheGet: () => Promise.resolve(null),
    cachePut: () => Promise.resolve(),
  };
  const service = new ImmichService(transport, config);
  if (kind === 'albums') return service.listAlbums();
  if (kind === 'people') return service.listPeople();
  return service.listTags();
}
