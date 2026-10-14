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
  { key: 'relayUrl', label: 'Signaling URL', type: 'text', placeholder: 'https://signal.example', help: 'Must match the signaling origin approved in plugin permissions.', section: 'Connection' },
  { key: 'senderUrl', label: 'Sender URL', type: 'text', hidden: true, section: 'Connection' },
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
    ],
  },
  {
    key: 'sourceUrl',
    label: 'Cast target',
    type: 'text',
    placeholder: 'https://… or a YouTube link',
    help: 'An HTTPS website/media URL or YouTube link/id.',
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
  { key: 'muted', label: 'Start muted', type: 'boolean', section: 'Presentation' },
];

export const castManifest: PluginManifest = {
  id: 'cast-receiver',
  name: 'Cast Receiver',
  version: '4.4.7',
  description: 'Remote receiver for YouTube, screen sharing, websites, and media',
  translations: { de: de.manifest },
  executionType: 'sandboxed',
  capabilities: [],
  nativeNetwork: [{ id: 'signaling', label: 'Cast signaling', purpose: 'Pair peers and exchange WebRTC connection details', surface: 'connect', origins: [], allowCustomOrigins: true }],
  webRtc: { label: 'Direct peer connection', purpose: 'Receive commands and media directly from paired senders' },
  widgets: [
    {
      id: 'cast-receiver.screen',
      name: 'Cast Receiver',
      description: 'Transparent presentation surface for links, media, and live screen sharing',
      minW: 3,
      minH: 3,
      defaultW: 30,
      defaultH: 25,
      defaultZIndex: 10,
      defaultConfig: { ...CAST_DEFAULT_CONFIG },
      defaultAppearance: { background: 'none', backgroundOpacity: 0 },
      nativeNetwork: ['signaling'],
      webRtc: true,
      sandboxPolicy: ['embed-sites', 'remote-media', 'secure-webrtc'],
      settings,
    },
    {
      id: 'cast-receiver.pairing',
      name: 'Cast Pairing',
      description: 'Pair devices and open Cast sender details',
      minW: 1,
      minH: 1,
      defaultW: 2,
      defaultH: 2,
      defaultZIndex: OVERLAY_Z,
      defaultConfig: { relayUrl: '', senderUrl: '' },
      defaultAppearance: { background: 'glass', backgroundOpacity: 0.55 },
      nativeNetwork: [],
      webRtc: false,
      sandboxPolicy: [],
      settings: settings.filter((field) => field.section === 'Connection'),
    },
  ],
};
