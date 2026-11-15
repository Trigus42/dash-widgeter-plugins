import { BACKGROUND_Z, OVERLAY_Z, type PluginManifest, type WidgetSettingField } from '@/types';
import { CAST_DEFAULT_CONFIG } from './types';
import de from './locales/de.json';

/**
 * Host-side manifest for the Cast receiver. Linked websites and media use the
 * host presentation interface; live WebRTC and encrypted relay streams retain
 * plugin-local playback under the existing reviewed sandbox grants.
 */

const settings: WidgetSettingField[] = [
  { key: 'relayUrl', label: 'Signaling URL', type: 'text', placeholder: 'https://signal.example', help: 'Must match the signaling origin approved in plugin permissions.', section: 'Connection' },
  { key: 'senderUrl', label: 'Sender URL', type: 'text', hidden: true, section: 'Connection' },
  {
    key: 'sourceUrl',
    label: 'Cast target',
    type: 'text',
    placeholder: 'https://… or a YouTube link',
    help: 'Shown on this display even without a paired sender. Paste an HTTPS website or media URL, or a YouTube link/id. The source and playback adapter are recognized automatically. Leave blank to show pairing instead.',
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
  { key: 'autoplay', label: 'Autoplay', type: 'boolean', help: 'Start queued and YouTube presentations automatically.', section: 'Presentation' },
  { key: 'sasTimeoutSeconds', label: 'Security code timeout (seconds)', type: 'number', help: 'Hide the verification code after 10–300 seconds without trusting automatically.', section: 'Connection' },
  { key: 'hidePairingWhileInactive', label: 'Auto-hide while Cast is inactive', type: 'boolean', help: 'Hide the Cast button until you interact with the dashboard, even when nothing is casting.', section: 'Pairing' },
  { key: 'neverHidePairing', label: 'Never hide Cast button', type: 'boolean', help: 'Keep the Cast button visible at all times. This takes precedence over auto-hide.', section: 'Pairing' },
];

export const castManifest: PluginManifest = {
  id: 'cast-receiver',
  name: 'Cast Receiver',
  version: '4.8.0',
  description: 'Remote receiver for YouTube, screen sharing, websites, and media',
  translations: { de: de.manifest },
  executionType: 'sandboxed',
  capabilities: ['device.volume.read', 'device.volume.write'],
  nativeNetwork: [{ id: 'signaling', label: 'Cast relay connection', purpose: 'Pair senders and carry end-to-end encrypted playback control and screen/audio fallback', surface: 'connect', origins: [], allowCustomOrigins: true }],
  webRtc: { label: 'Direct peer connection', purpose: 'Receive screen and audio directly when available; encrypted relay fallback remains available' },
  widgets: [
    {
      id: 'cast-receiver.screen',
      name: 'Cast Receiver',
      description: 'Transparent presentation surface for links, media, and live screen sharing',
      minW: 3,
      minH: 3,
      defaultW: 30,
      defaultH: 25,
      defaultZIndex: BACKGROUND_Z,
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
      defaultConfig: { relayUrl: '', senderUrl: '', sasTimeoutSeconds: CAST_DEFAULT_CONFIG.sasTimeoutSeconds, hidePairingWhileInactive: false, neverHidePairing: false },
      defaultAppearance: { background: 'none', backgroundOpacity: 0 },
      nativeNetwork: [],
      webRtc: false,
      sandboxPolicy: [],
      settings: settings.filter((field) => field.section === 'Connection' || field.section === 'Pairing'),
    },
  ],
};
