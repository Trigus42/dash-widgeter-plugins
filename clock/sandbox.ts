import { definePlugin, injectStyle } from '@/sandbox/sdk';
import { defineReactWidget } from '@/sandbox/react';
import { ClockWidget } from './ClockWidget';
import { CLOCK_SANDBOX_CSS } from './clock-styles';

/**
 * Clock plugin sandbox entry: one React widget in the plugin's null-origin
 * iframe. No capabilities, no network — the emptiest security surface, which is
 * why it stays the migration exemplar.
 */
injectStyle('clock-style', CLOCK_SANDBOX_CSS);

export default definePlugin({
  widgets: {
    'clock.time': defineReactWidget(ClockWidget),
  },
});
