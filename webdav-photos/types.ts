/**
 * WebDAV photo-source connection + source config. The slideshow / overlay /
 * caching fields are owned by the shared photo-frame SDK (`FrameConfig`), read
 * from the same instance config, so they are not duplicated here.
 */
export interface WebDavConfig {
  /** Collection (folder) URL on the WebDAV server, e.g. a Nextcloud dav path. */
  folderUrl: string;
  /** Non-secret username for HTTP Basic auth (empty = anonymous). */
  username: string;
  /** Recurse into subfolders (PROPFIND Depth: infinity) vs. one level. */
  recursive: boolean;
}

export const WEBDAV_DEFAULT_CONFIG: WebDavConfig = {
  folderUrl: '',
  username: '',
  recursive: false,
};

/** One file entry parsed from a WebDAV PROPFIND multistatus response. */
export interface WebDavEntry {
  /** Absolute URL to the resource (resolved against the server origin). */
  href: string;
  /** Reported MIME type, when the server supplies getcontenttype. */
  contentType: string | null;
  /** True when the resource is a collection (folder), not a file. */
  isCollection: boolean;
  /** Last-modified epoch ms, when the server supplies getlastmodified. */
  lastModified: number | null;
}
