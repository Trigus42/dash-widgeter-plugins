import { WIDGET_Z, type PluginManifest } from '@/types';
import { CALENDAR_DEFAULT_CONFIG } from './types';
import de from './locales/de.json';

/**
 * Host-side manifest for the calendar plugin. The iCal feed URL is user-
 * configured, so the plugin declares two reviewable groups: "Internet" (any
 * host, any public IP) for cloud feeds, and "Local Networks" for self-hosted
 * feeds (e.g. Nextcloud) on the LAN. The non-overridable baseline
 * (metadata/link-local/…) is still refused regardless, and the user can turn
 * either group off.
 */
export const calendarManifest: PluginManifest = {
  id: 'calendar',
  name: 'Calendar',
  version: '1.4.0',
  description: 'Upcoming events from an iCal feed',
  translations: { de: de.manifest },
  executionType: 'sandboxed',
  capabilities: [],
  permissions: [
    {
      name: 'Internet',
      domains: ['*'],
      publicIps: ['0.0.0.0/0', '::/0'],
      properties: { defaultOn: true },
    },
    {
      name: 'Local Networks',
      privateIps: ['127.0.0.1/32', '10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16'],
      properties: { defaultOn: true },
    },
  ],
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
          key: 'refreshIntervalMinutes',
          label: 'Refresh interval',
          type: 'select',
          section: 'Feeds',
          options: [
            { label: '5 minutes', value: '5' },
            { label: '15 minutes', value: '15' },
            { label: '30 minutes', value: '30' },
            { label: '60 minutes', value: '60' },
          ],
        },
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
