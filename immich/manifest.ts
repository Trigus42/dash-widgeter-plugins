import { BACKGROUND_Z, type PluginManifest, type WidgetSettingField } from '@/types';
import { FRAME_SETTINGS, FRAME_DEFAULT_CONFIG } from '@/sandbox/photoframe';
import { IMMICH_DEFAULT_CONFIG } from './types';
import de from './locales/de.json';

/**
 * Host-side manifest for the Immich photo frame. The server URL is user-
 * configured, so the plugin declares two reviewable groups: "Internet" (any
 * host, any public IP) for a cloud-hosted Immich, and "Local Networks" since
 * Immich is commonly self-hosted on the home LAN. The non-overridable baseline
 * (metadata/link-local/…) is still refused, and the user may disable either
 * group. The API key is a `secret` field: kept in the host-only store and
 * referenced via a placeholder, never delivered into the sandbox frame.
 */

const settings: WidgetSettingField[] = [
  // Connection
  {
    key: 'serverUrl',
    label: 'Immich Server URL',
    type: 'text',
    placeholder: 'http://localhost:2283',
    help: 'Base URL of your Immich instance (without /api).',
    section: 'Connection',
  },
  { key: 'apiKey', label: 'API Key', type: 'password', secret: true, help: 'Immich → Account Settings → API Keys.', section: 'Connection' },
  // Source pool
  {
    key: 'poolMode',
    label: 'Photo source',
    type: 'select',
    section: 'Source',
    options: [
      { label: 'All photos', value: 'random' },
      { label: 'Favorites', value: 'favorites' },
      { label: 'Memories (on this day)', value: 'memories' },
    ],
  },
  { key: 'albums', label: 'Albums', type: 'multiselect3', help: 'Tap once to include (✓), again to exclude (−). Albums, people and tags are combined.', section: 'Source', dynamicOptions: true, subpage: true },
  { key: 'people', label: 'People', type: 'multiselect3', help: 'Tap once to include (✓), again to exclude (−). Albums, people and tags are combined.', section: 'Source', dynamicOptions: true, subpage: true },
  { key: 'tags', label: 'Tags', type: 'multiselect3', help: 'Tap once to include (✓), again to exclude (−). Albums, people and tags are combined.', section: 'Source', dynamicOptions: true, subpage: true },
  { key: 'rating', label: 'Minimum rating (0 = any)', type: 'number', section: 'Source' },
  { key: 'showVideos', label: 'Include videos', type: 'boolean', section: 'Source' },
  { key: 'onlyWithPersons', label: 'Only photos with people', type: 'boolean', help: 'Filter out photos where no person or face is detected.', section: 'Source' },
  // Slideshow / Info overlay / Caching are the shared photo-frame SDK fields,
  // identical across every photo-source plugin and read by the SDK engine.
  ...FRAME_SETTINGS,
];

export const immichManifest: PluginManifest = {
  id: 'immich',
  name: 'Immich Photo Frame',
  version: '1.10.0',
  description: 'Digital photo frame backed by an Immich server, with offline caching and video playback',
  translations: { de: de.manifest },
  executionType: 'sandboxed',
  capabilities: [],
  permissions: [
    {
      name: 'Internet',
      domains: ['*'],
      publicIps: ['0.0.0.0/0', '::/0'],
      properties: { defaultOn: true },
    },
    {
      name: 'Local Networks',
      privateIps: ['127.0.0.1/32', '10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16'],
      properties: { defaultOn: true },
    },
  ],
  widgets: [
    {
      id: 'immich.photoframe',
      name: 'Photo Frame',
      description: 'ImmichFrame-style slideshow: pools, transitions, metadata, controls',
      minW: 3,
      minH: 3,
      defaultW: 30,
      defaultH: 25,
      defaultZIndex: BACKGROUND_Z,
      defaultConfig: { ...FRAME_DEFAULT_CONFIG, ...IMMICH_DEFAULT_CONFIG },
      defaultAppearance: { background: 'none', backgroundOpacity: 1 },
      sandboxPolicy: ['remote-media'],
      settings,
    },
  ],
};
