import { definePhotoFrameWidget, type FrameStrings } from '@/sandbox/photoframe';
import { WebDavBackend } from './backend';
import de from './locales/de.json';

/**
 * WebDAV plugin sandbox entry. The slideshow engine — pooling, transitions,
 * overlay, blob caching — is the shared photo-frame SDK; this plugin supplies
 * only the WebDAV backend adapter and its strings. The backend lists the folder
 * (PROPFIND) and fetches image bytes through the host HTTP + blob-cache
 * capabilities; the Basic-auth password is substituted by the host at egress.
 */
const EN: FrameStrings = {
  title: 'WebDAV Photo Frame',
  configure: 'Open settings to add your WebDAV folder URL and credentials.',
  loading: 'Loading photos…',
  previous: 'Previous',
  next: 'Next',
  play: 'Play',
  pause: 'Pause',
};

function strings(locale: string): FrameStrings {
  if (locale.split('-')[0] === 'de') {
    const r = de.runtime;
    return {
      title: r.title,
      configure: r.configure,
      loading: r.loading,
      previous: r.previous,
      next: r.next,
      play: r.play,
      pause: r.pause,
    };
  }
  return EN;
}

export default definePhotoFrameWidget({
  widgetId: 'webdav-photos.photoframe',
  styleId: 'webdav-photos-style',
  strings,
  createBackend: (context, config) => new WebDavBackend(context, config),
});
