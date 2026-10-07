import { BACKGROUND_Z, type PluginManifest, type WidgetSettingField } from '@/types';
import { FRAME_SETTINGS, FRAME_DEFAULT_CONFIG } from '@/sandbox/photoframe';
import { WEBDAV_DEFAULT_CONFIG } from './types';
import de from './locales/de.json';

/**
 * Host-side manifest for the WebDAV photo frame. The collection URL is user-
 * configured, so the plugin declares two reviewable groups: "Internet" (any
 * host, any public IP) for a cloud WebDAV (Nextcloud, Box, …) and "Local
 * Networks" since WebDAV is commonly self-hosted on the home LAN. The password
 * is a `secret` field kept in the host-only store; the plugin references it via
 * the `{{basic:username:password}}` placeholder, so the host composes the Basic
 * auth header at egress and the password never enters the sandbox frame.
 */

const settings: WidgetSettingField[] = [
  // Connection
  {
    key: 'folderUrl',
    label: 'Folder URL',
    type: 'text',
    placeholder: 'https://cloud.example.com/remote.php/dav/files/me/Photos',
    help: 'WebDAV collection (folder) URL. Nextcloud: Files → ⋯ → details shows the dav path.',
    section: 'Connection',
  },
  {
    key: 'username',
    label: 'Username',
    type: 'text',
    help: 'Leave blank for a public (anonymous) share.',
    section: 'Connection',
  },
  {
    key: 'password',
    label: 'Password',
    type: 'password',
    secret: true,
    help: 'Use an app password where your provider offers one.',
    section: 'Connection',
  },
  {
    key: 'recursive',
    label: 'Include subfolders',
    type: 'boolean',
    help: 'List photos in nested folders too (the server may decline deep listings).',
    section: 'Connection',
  },
  // Slideshow / Info overlay / Caching are the shared photo-frame SDK fields.
  ...FRAME_SETTINGS,
];

export const webdavManifest: PluginManifest = {
  id: 'webdav-photos',
  name: 'WebDAV Photo Frame',
  version: '1.0.0',
  description: 'Digital photo frame backed by a WebDAV folder (Nextcloud, ownCloud, …), with offline caching',
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
      id: 'webdav-photos.photoframe',
      name: 'Photo Frame',
      description: 'Slideshow of photos from a WebDAV folder: transitions, metadata, controls',
      minW: 3,
      minH: 3,
      defaultW: 30,
      defaultH: 25,
      defaultZIndex: BACKGROUND_Z,
      defaultConfig: { ...FRAME_DEFAULT_CONFIG, ...WEBDAV_DEFAULT_CONFIG },
      defaultAppearance: { background: 'none', backgroundOpacity: 1 },
      settings,
    },
  ],
};
