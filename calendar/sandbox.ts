import { definePlugin, injectStyle } from '@/sandbox/sdk';
import { defineReactWidget } from '@/sandbox/react';
import { CalendarWidget } from './CalendarWidget';
import { CALENDAR_SANDBOX_CSS } from './calendar-styles';

/**
 * Calendar plugin sandbox entry: one React agenda widget in the plugin's
 * null-origin iframe. iCal parsing (ical.js) runs inside the sandbox; the feed
 * is fetched through the host (proxy for CORS), allowlisted to any host by the
 * manifest (user-configured URL) with SSRF guards still enforced natively.
 */
injectStyle('calendar-style', CALENDAR_SANDBOX_CSS);

export default definePlugin({
  widgets: {
    'calendar.agenda': defineReactWidget(CalendarWidget),
  },
});
