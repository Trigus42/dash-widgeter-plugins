import { definePhotoFrameWidget, type FrameStrings } from '@/sandbox/photoframe';
import { GooglePhotosBackend, loadGooglePhotosAlbums } from './backend';
import de from './locales/de.json';

/**
 * Google Photos plugin sandbox entry. The slideshow engine — pooling,
 * transitions, overlay, blob caching — is the shared photo-frame SDK; this
 * plugin supplies only the Google Photos backend adapter and its strings. OAuth
 * token refresh + media listing run through the host HTTP capability; the
 * durable OAuth secrets are substituted by the host at egress, never seen here.
 */
const EN: FrameStrings = {
  title: 'Google Photos Frame',
  configure: 'Open settings to connect your Google Photos account.',
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
  widgetId: 'google-photos.photoframe',
  styleId: 'google-photos-style',
  strings,
  createBackend: (context, config) => new GooglePhotosBackend(context, config),
  loadOptions: (context, _fieldKey, config) => loadGooglePhotosAlbums(context, config),
});
