import { definePlugin, injectStyle } from '@/sandbox/sdk';
import { defineReactWidget } from '@/sandbox/react';
import { PhotoFrameWidget } from './PhotoFrameWidget';
import { loadImmichOptions } from './settings-options';
import { IMMICH_SANDBOX_CSS } from './photoframe-styles';

/**
 * Immich plugin sandbox entry: the photo-frame widget in the plugin's
 * null-origin iframe. Image fetch + blob caching + iCal-style pooling all run
 * through the host HTTP + blob-cache capabilities; dynamic album/people/tag
 * options resolve via the host over RPC (loadOptions).
 */
injectStyle('immich-style', IMMICH_SANDBOX_CSS);

export default definePlugin({
  widgets: {
    'immich.photoframe': defineReactWidget(PhotoFrameWidget),
  },
  loadOptions(context, _widgetId, fieldKey, config) {
    const kind =
      fieldKey === 'albumIds' ? 'albums' : fieldKey === 'personIds' ? 'people' : 'tags';
    return loadImmichOptions(context, kind, config);
  },
});
