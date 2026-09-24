import { BACKGROUND_Z, type PluginManifest, type WidgetSettingField } from '@/types';
import { IMMICH_DEFAULT_CONFIG } from './types';

/**
 * Host-side manifest for the Immich photo frame. The server URL is user-
 * configured, so network reach is `*` (any host) — surfaced honestly. Immich is
 * commonly self-hosted on the home LAN, so `ipExceptions` opens loopback + the
 * RFC1918 private ranges (checked against the resolved IP); the non-overridable
 * baseline (metadata/link-local/multicast/…) is still refused. The API key is a
 * `secret` field: kept in the host-only store and referenced via a placeholder,
 * never delivered into the sandbox frame or shared with other plugins.
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
  { key: 'albums', label: 'Albums', type: 'multiselect3', help: 'Tap to include (+), tap again to exclude (−). Combined with people & tags.', section: 'Source', dynamicOptions: true },
  { key: 'people', label: 'People', type: 'multiselect3', help: 'Tap to include (+), tap again to exclude (−).', section: 'Source', dynamicOptions: true },
  { key: 'tags', label: 'Tags', type: 'multiselect3', help: 'Tap to include (+), tap again to exclude (−).', section: 'Source', dynamicOptions: true },
  { key: 'rating', label: 'Minimum rating (0 = any)', type: 'number', section: 'Source' },
  { key: 'showVideos', label: 'Include videos', type: 'boolean', section: 'Source' },
  // Slideshow
  { key: 'intervalSeconds', label: 'Seconds per photo', type: 'number', section: 'Slideshow' },
  {
    key: 'layout',
    label: 'Layout',
    type: 'select',
    section: 'Slideshow',
    options: [
      { label: 'Single', value: 'single' },
      { label: 'Split (two photos)', value: 'split' },
    ],
  },
  {
    key: 'transition',
    label: 'Transition',
    type: 'select',
    section: 'Slideshow',
    options: [
      { label: 'Ken Burns', value: 'kenburns' },
      { label: 'Zoom', value: 'zoom' },
      { label: 'Pan', value: 'pan' },
      { label: 'Fade', value: 'fade' },
      { label: 'None', value: 'none' },
    ],
  },
  { key: 'transitionSeconds', label: 'Transition seconds', type: 'number', section: 'Slideshow' },
  {
    key: 'imageFit',
    label: 'Image fit',
    type: 'select',
    section: 'Slideshow',
    options: [
      { label: 'Cover (fill)', value: 'cover' },
      { label: 'Contain (letterbox)', value: 'contain' },
    ],
  },
  { key: 'showControls', label: 'Show play/next controls', type: 'boolean', section: 'Slideshow' },
  {
    key: 'progressBar',
    label: 'Progress bar',
    type: 'select',
    section: 'Slideshow',
    options: [
      { label: 'Bottom', value: 'bottom' },
      { label: 'Top', value: 'top' },
      { label: 'Hidden', value: 'none' },
    ],
  },
  // Info overlay
  {
    key: 'metadataPosition',
    label: 'Info overlay',
    type: 'select',
    section: 'Info overlay',
    help: 'Show a caption (location, date, people) in a corner of the photo.',
    options: [
      { label: 'Bottom right', value: 'bottom-right' },
      { label: 'Bottom left', value: 'bottom-left' },
      { label: 'Top right', value: 'top-right' },
      { label: 'Top left', value: 'top-left' },
      { label: 'Hidden', value: 'none' },
    ],
  },
  { key: 'metadataShowLocation', label: 'Show location', type: 'boolean', section: 'Info overlay' },
  { key: 'metadataShowDate', label: 'Show date', type: 'boolean', section: 'Info overlay' },
  { key: 'metadataShowPeople', label: 'Show people', type: 'boolean', section: 'Info overlay' },
  { key: 'metadataShowDescription', label: 'Show description', type: 'boolean', section: 'Info overlay' },
  // Caching
  { key: 'cacheEnabled', label: 'Cache photos locally', type: 'boolean', section: 'Caching' },
  { key: 'cacheMaxMB', label: 'Cache size limit (MB)', type: 'number', help: 'Oldest images are evicted first when the limit is reached.', section: 'Caching' },
  { key: 'cacheExpirationDays', label: 'Cache image expiration (days)', type: 'number', help: 'Cached images older than this are removed (0 = never expire).', section: 'Caching' },
  { key: 'listTtlMinutes', label: 'Offline list validity (minutes)', type: 'number', section: 'Caching' },
];

export const immichManifest: PluginManifest = {
  id: 'immich',
  name: 'Immich Photo Frame',
  version: '1.1.0',
  description: 'Digital photo frame backed by an Immich server, with offline caching',
  executionType: 'sandboxed',
  capabilities: [],
  network: ['*'],
  ipExceptions: ['127.0.0.1/32', '10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16'],
  widgets: [
    {
      id: 'immich.photoframe',
      name: 'Photo Frame',
      description: 'ImmichFrame-style slideshow: pools, transitions, metadata, controls',
      minW: 5,
      minH: 5,
      defaultW: 30,
      defaultH: 25,
      defaultZIndex: BACKGROUND_Z,
      defaultConfig: { ...IMMICH_DEFAULT_CONFIG },
      defaultAppearance: { background: 'none', backgroundOpacity: 1 },
      settings,
    },
  ],
};
