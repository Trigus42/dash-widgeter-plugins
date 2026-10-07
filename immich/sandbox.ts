import { definePhotoFrameWidget, type FrameStrings } from '@/sandbox/photoframe';
import { ImmichBackend, loadImmichOptions } from './backend';
import de from './locales/de.json';

/**
 * Immich plugin sandbox entry. The whole slideshow — pooling, transitions,
 * overlay, blob caching, dynamic options — is the shared photo-frame SDK engine;
 * this plugin supplies only the Immich backend adapter and its strings. The
 * backend's image fetch + list pooling run through the host HTTP + blob-cache
 * capabilities; album/people/tag options resolve via the host over RPC.
 */
const EN: FrameStrings = {
  title: 'Immich Photo Frame',
  configure: 'Open settings to add your Immich server URL and API key.',
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
  widgetId: 'immich.photoframe',
  styleId: 'immich-style',
  strings,
  createBackend: (context, config) => new ImmichBackend(context, config),
  loadOptions: (context, fieldKey, config) => loadImmichOptions(context, fieldKey, config),
});
