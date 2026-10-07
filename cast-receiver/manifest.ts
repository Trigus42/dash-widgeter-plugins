import { BACKGROUND_Z, type PluginManifest, type WidgetSettingField } from '@/types';
import { CAST_DEFAULT_CONFIG } from './types';
import de from './locales/de.json';

/**
 * Host-side manifest for the Cast receiver. This is the showcase for the
 * declarative sandbox-softening model: the widget DECLARES `sandboxPolicy`
 * (embed-sites + remote-media) so the user can grant — default-off, reviewed
 * before first run — the specific CSP widenings a receiver needs to show a
 * remote site or play a remote stream. `connect-src` stays `'none'`, so the
 * plugin's own code still has no silent network path; only the browser's media/
 * frame loaders reach the cast target, and only for granted profiles.
 *
 * No network permission groups: the receiver fetches nothing through
 * `context.http`; the softened frame's own media/frame loaders handle the target.
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
    ],
  },
  {
    key: 'sourceUrl',
    label: 'Cast target',
    type: 'text',
    placeholder: 'https://… or a YouTube link/id',
    help: 'An https website or media URL, or a YouTube link/id (per the type above).',
    section: 'Cast',
  },
  {
    key: 'pairingCode',
    label: 'Pairing code',
    type: 'text',
    help: 'Shown while idle so a sender knows which screen it controls.',
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
  version: '1.0.0',
  description: 'Mostly-invisible screen receiver: cast a website, media stream, or YouTube video to this display',
  translations: { de: de.manifest },
  executionType: 'sandboxed',
  capabilities: [],
  permissions: [],
  widgets: [
    {
      id: 'cast-receiver.screen',
      name: 'Cast Receiver',
      description: 'Full-bleed receiver that shows cast content and a pairing code when idle',
      minW: 3,
      minH: 3,
      defaultW: 30,
      defaultH: 25,
      defaultZIndex: BACKGROUND_Z,
      defaultConfig: { ...CAST_DEFAULT_CONFIG },
      defaultAppearance: { background: 'none', backgroundOpacity: 1 },
      // Declares the sandbox softening a receiver needs; inert until the user
      // grants these (default-off) in the permission review.
      sandboxPolicy: ['embed-sites', 'remote-media'],
      settings,
    },
  ],
};
