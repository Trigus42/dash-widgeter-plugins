import { WIDGET_Z, type PluginManifest } from '@/types';
import { CALENDAR_DEFAULT_CONFIG } from './types';

/**
 * Host-side manifest for the calendar plugin. The iCal feed URL is user-
 * configured, so the plugin's network reach is `*` (any host) — surfaced
 * honestly in the manifest. Self-hosted feeds (e.g. Nextcloud) may live on the
 * LAN, so `ipExceptions` opens loopback + RFC1918; the non-overridable baseline
 * (metadata/link-local/multicast/…) is still refused, so `*` cannot pivot to
 * cloud-metadata or infra regardless.
 */
export const calendarManifest: PluginManifest = {
  id: 'calendar',
  name: 'Calendar',
  version: '1.0.0',
  description: 'Upcoming events from an iCal feed',
  executionType: 'sandboxed',
  capabilities: [],
  network: ['*'],
  ipExceptions: ['127.0.0.1/32', '10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16'],
  widgets: [
    {
      id: 'calendar.agenda',
      name: 'Calendar Agenda',
      description: 'Upcoming events from any iCal (.ics) feed',
      minW: 5,
      minH: 8,
      defaultW: 8,
      defaultH: 13,
      defaultZIndex: WIDGET_Z,
      defaultConfig: { ...CALENDAR_DEFAULT_CONFIG },
      settings: [
        {
          key: 'sources',
          label: 'Calendars',
          type: 'list',
          section: 'Feeds',
          addLabel: 'Add calendar',
          help: 'Each feed is merged into one agenda. Basic auth in the URL and webcal:// are supported.',
          itemFields: [
            {
              key: 'icalUrl',
              label: 'iCal URL',
              type: 'text',
              placeholder: 'https://example.com/calendar.ics',
            },
            { key: 'color', label: 'Color', type: 'color' },
          ],
        },
        { key: 'daysAhead', label: 'Days ahead', type: 'number', section: 'Feeds' },
        {
          key: 'showTitle',
          label: 'Show title',
          type: 'boolean',
          section: 'Appearance',
          help: 'A heading above the agenda. Usually unnecessary once feeds are merged.',
        },
        {
          key: 'title',
          label: 'Title text',
          type: 'text',
          placeholder: 'My week',
          section: 'Appearance',
        },
      ],
    },
  ],
};
