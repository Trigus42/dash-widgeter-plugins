import { definePlugin, injectStyle } from '@/sandbox/sdk';
import { defineReactWidget } from '@/sandbox/react';
import { CastWidget } from './CastWidget';
import { CAST_SANDBOX_CSS } from './styles';

/**
 * Cast receiver sandbox entry. Runs in the plugin's null-origin iframe like any
 * widget — but when the user has granted its declared `sandboxPolicy`, the host
 * serves this frame a softened CSP so its <iframe>/<video> may load the remote
 * cast target. The plugin's own code still has no network (`connect-src 'none'`).
 */
injectStyle('cast-receiver-style', CAST_SANDBOX_CSS);

export default definePlugin({
  widgets: {
    'cast-receiver.screen': defineReactWidget(CastWidget),
  },
});
