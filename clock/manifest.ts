import { WIDGET_Z, type PluginManifest } from '@/types';
import { CLOCK_DEFAULT_CONFIG } from './types';

/**
 * Static, host-side manifest for the clock plugin. Contains no code: the host
 * registers this to draw the palette, size the widget, and render settings
 * without executing anything. The render behavior lives in ./sandbox.ts, which
 * runs in the null-origin plugin sandbox. Clock needs no capabilities and no
 * network — the emptiest possible security surface, which is why it is the
 * migration exemplar.
 */
export const clockManifest: PluginManifest = {
  id: 'clock',
  name: 'Clock',
  version: '1.0.0',
  description: 'Date and time display',
  executionType: 'sandboxed',
  capabilities: [],
  network: [],
  widgets: [
    {
      id: 'clock.time',
      name: 'Clock',
      description: 'Current time and date',
      minW: 8,
      minH: 5,
      defaultW: 18,
      defaultH: 8,
      defaultZIndex: WIDGET_Z,
      defaultConfig: { ...CLOCK_DEFAULT_CONFIG },
      defaultAppearance: { background: 'none', backgroundOpacity: 0.55 },
      settings: [
        { key: 'use24Hour', label: '24-hour time', type: 'boolean', section: 'Time' },
        { key: 'showSeconds', label: 'Show seconds', type: 'boolean', section: 'Time' },
        { key: 'showDate', label: 'Show date', type: 'boolean', section: 'Date' },
        {
          key: 'dateStyle',
          label: 'Date format',
          type: 'select',
          section: 'Date',
          help: 'Weekday only shows e.g. "Monday"; full adds the month and day.',
          options: [
            { label: 'Full (weekday, month, day)', value: 'full' },
            { label: 'Weekday only', value: 'weekday' },
          ],
        },
        {
          key: 'fontWeight',
          label: 'Text weight',
          type: 'select',
          section: 'Style',
          options: [
            { label: 'Thin', value: '200' },
            { label: 'Light', value: '300' },
            { label: 'Regular', value: '400' },
            { label: 'Medium', value: '500' },
            { label: 'Semibold', value: '600' },
            { label: 'Bold', value: '700' },
            { label: 'Black', value: '900' },
          ],
        },
      ],
    },
  ],
};
