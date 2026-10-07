import { BACKGROUND_Z, type PluginManifest, type WidgetSettingField } from '@/types';
import { FRAME_SETTINGS, FRAME_DEFAULT_CONFIG } from '@/sandbox/photoframe';
import { GOOGLE_PHOTOS_DEFAULT_CONFIG } from './types';
import de from './locales/de.json';

/**
 * Host-side manifest for the Google Photos frame. All endpoints are fixed Google
 * hosts, so the only reviewable group is "Google Photos" scoped to Google's API
 * domains over any public IP (no LAN reach). The OAuth client secret + refresh
 * token are `secret` fields kept in the host-only store; the plugin references
 * them via `{{secret:…}}` placeholders in the token-exchange body, so the host
 * substitutes them at egress and they never enter the sandbox frame. Image
 * baseUrls are pre-signed by Google and need no credential.
 *
 * The refresh token is obtained out-of-band (Google OAuth consent cannot run in
 * a null-origin sandbox) — see the field help. This mirrors how self-hosted
 * photo tools integrate Google Photos without shipping a confidential secret.
 */

const settings: WidgetSettingField[] = [
  // Connection
  {
    key: 'clientId',
    label: 'OAuth client ID',
    type: 'text',
    placeholder: 'xxxxx.apps.googleusercontent.com',
    help: 'Google Cloud console → Credentials → OAuth client ID (Desktop app).',
    section: 'Connection',
  },
  {
    key: 'clientSecret',
    label: 'OAuth client secret',
    type: 'password',
    secret: true,
    help: 'From the same OAuth client. Stored encrypted on the device, never sent to the widget.',
    section: 'Connection',
  },
  {
    key: 'refreshToken',
    label: 'Refresh token',
    type: 'password',
    secret: true,
    help: 'Obtain once via the OAuth consent flow (scope photoslibrary.readonly) and paste it here.',
    section: 'Connection',
  },
  {
    key: 'albumId',
    label: 'Album',
    type: 'select',
    help: 'Pick an album, or leave unset to show recent library photos.',
    section: 'Source',
    dynamicOptions: true,
    subpage: true,
  },
  // Slideshow / Info overlay / Caching are the shared photo-frame SDK fields.
  ...FRAME_SETTINGS,
];

export const googlePhotosManifest: PluginManifest = {
  id: 'google-photos',
  name: 'Google Photos Frame',
  version: '1.0.0',
  description: 'Digital photo frame backed by Google Photos, with offline caching',
  translations: { de: de.manifest },
  executionType: 'sandboxed',
  capabilities: [],
  permissions: [
    {
      name: 'Google Photos',
      domains: ['photoslibrary.googleapis.com', 'oauth2.googleapis.com', '*.googleusercontent.com'],
      publicIps: ['0.0.0.0/0', '::/0'],
      properties: { defaultOn: true },
    },
  ],
  widgets: [
    {
      id: 'google-photos.photoframe',
      name: 'Photo Frame',
      description: 'Slideshow of your Google Photos: albums or recent media, transitions, metadata',
      minW: 3,
      minH: 3,
      defaultW: 30,
      defaultH: 25,
      defaultZIndex: BACKGROUND_Z,
      defaultConfig: { ...FRAME_DEFAULT_CONFIG, ...GOOGLE_PHOTOS_DEFAULT_CONFIG },
      defaultAppearance: { background: 'none', backgroundOpacity: 1 },
      settings,
    },
  ],
};
