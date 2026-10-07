import { WEBDAV_DEFAULT_CONFIG, type WebDavConfig } from './types';

function str(raw: unknown, fallback: string): string {
  return typeof raw === 'string' ? raw : fallback;
}
function bool(raw: unknown, fallback: boolean): boolean {
  return typeof raw === 'boolean' ? raw : fallback;
}

/** Coerce persisted config (unknown JSON) into validated WebDAV fields. */
export function readWebDavConfig(raw: Record<string, unknown>): WebDavConfig {
  const d = WEBDAV_DEFAULT_CONFIG;
  return {
    folderUrl: str(raw.folderUrl, d.folderUrl),
    username: str(raw.username, d.username),
    recursive: bool(raw.recursive, d.recursive),
  };
}
