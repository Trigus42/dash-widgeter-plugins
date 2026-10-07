import { OVERLAY_Z, type PluginManifest, type WidgetSettingField } from '@/types';
import { CAST_DEFAULT_CONFIG } from './types';
import de from './locales/de.json';

/**
 * Host-side manifest for the Cast receiver. URL content renders in this
 * null-origin sandbox with explicit website/media grants. WebRTC screen streams
 * are rendered by the host inside the same movable, resizable grid item because
 * MediaStream objects do not cross the plugin RPC boundary.
 */

const settings: WidgetSettingField[] = [
  {
    key: 'sourceKind',
    label: 'What to cast',
    type: 'select',
    section: 'Cast',
    options: [
      { label: 'Nothing (show pairing code)', value: 'idle' },
      { label: 'Website', value: 'website' },
      { label: 'Media stream (video/audio URL)', value: 'media' },
      { label: 'YouTube video', value: 'youtube' },
      { label: 'Spotify', value: 'spotify' },
    ],
  },
  {
    key: 'sourceUrl',
    label: 'Cast target',
    type: 'text',
    placeholder: 'https://… or a YouTube/Spotify link',
    help: 'An HTTPS website/media URL, YouTube link/id, or Spotify share URL/URI.',
    section: 'Cast',
  },
  {
    key: 'overlayMode',
    label: 'Overlay style',
    type: 'select',
    section: 'Presentation',
    options: [
      { label: 'Cover (opaque)', value: 'cover' },
      { label: 'Dim backdrop', value: 'dim' },
      { label: 'Inline (transparent)', value: 'inline' },
    ],
  },
  { key: 'showPairingWhenIdle', label: 'Show pairing code when idle', type: 'boolean', section: 'Presentation' },
  { key: 'muted', label: 'Start muted', type: 'boolean', section: 'Presentation' },
];

export const castManifest: PluginManifest = {
  id: 'cast-receiver',
  name: 'Cast Receiver',
  version: '2.0.0',
  description: 'Remote receiver for YouTube, Spotify, screen sharing, websites, and media',
  translations: { de: de.manifest },
  executionType: 'sandboxed',
  capabilities: [],
  permissions: [],
  widgets: [
    {
      id: 'cast-receiver.screen',
      name: 'Cast Receiver',
      description: 'Movable overlay receiver for links, media, and live screen sharing',
      minW: 3,
      minH: 3,
      defaultW: 30,
      defaultH: 25,
      defaultZIndex: OVERLAY_Z,
      defaultConfig: { ...CAST_DEFAULT_CONFIG },
      defaultAppearance: { background: 'none', backgroundOpacity: 1 },
      // Declares the sandbox softening a receiver needs; inert until the user
      // grants these (default-off) in the permission review.
      sandboxPolicy: ['embed-sites', 'remote-media'],
      settings,
    },
  ],
};
